const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const { prepareGoogleSheet, syncAllToGoogleSheets, runTriggeredSync, appendVote, getVoteRows, toDateTimeString, nowIso } = require('./googleSheetsSync')

admin.initializeApp()

const geminiApiKey = defineSecret('GEMINI_API_KEY')
const googleServiceAccountEmail = defineSecret('GOOGLE_SERVICE_ACCOUNT_EMAIL')
const googlePrivateKey = defineSecret('GOOGLE_PRIVATE_KEY')
const googleSheetId = defineSecret('GOOGLE_SHEET_ID')
const db = admin.firestore()
const sheetSecrets = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: googleServiceAccountEmail,
  GOOGLE_PRIVATE_KEY: googlePrivateKey,
  GOOGLE_SHEET_ID: googleSheetId,
}
const sheetSecretList = [googleServiceAccountEmail, googlePrivateKey, googleSheetId]

function tokenDocId(token) {
  return Buffer.from(String(token || '')).toString('base64url')
}

function safeText(value, fallback = '') {
  return String(value || fallback).trim()
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

async function getBrevoApiKey() {
  const snap = await db.collection('config').doc('secrets').get()
  const key = snap.exists ? safeText(snap.data().brevoApiKey) : ''
  if (!key) throw new HttpsError('failed-precondition', 'Brevo API key is not configured')
  return key
}

async function sendBrevoEmail({ to, subject, htmlContent }) {
  const apiKey = await getBrevoApiKey()
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Young For Christ Itaosy', email: 'contact@young-for-christ.com' },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Brevo error ${res.status}`)
  }

  return res.json()
}

function buildPushBody(notification) {
  return safeText(notification.detail, 'Ouvre l’application pour voir les détails.')
}

function buildPushLink(notification) {
  const route = safeText(notification.route, '/notifications')
  const metadata = notification.metadata || {}
  if (route === '/tasks' && metadata.taskId) return `/tasks?task=${encodeURIComponent(metadata.taskId)}`
  if (route === '/evenements' && metadata.eventId) return `/evenements?event=${encodeURIComponent(metadata.eventId)}`
  if (route === '/membres' && metadata.membreId) return `/membres?membre=${encodeURIComponent(metadata.membreId)}`
  return route
}

async function listPushTokensForUser(uid) {
  if (!uid) return []
  const snap = await db.collection('users').doc(uid).collection('pushTokens').get()
  return snap.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data(), uid }))
    .filter(item => item.token)
}

async function findUserIdByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null

  const direct = await db.collection('users').where('email', '==', email).limit(1).get()
  if (!direct.empty) return direct.docs[0].id

  const all = await db.collection('users').get()
  const found = all.docs.find(docSnap => String(docSnap.data().email || '').trim().toLowerCase() === normalized)
  return found ? found.id : null
}

async function listPushTargets(notification) {
  if (notification.targetUserId) return listPushTokensForUser(notification.targetUserId)

  if (notification.targetUserEmail) {
    const userId = await findUserIdByEmail(notification.targetUserEmail)
    return userId ? listPushTokensForUser(userId) : []
  }

  const approvedUsers = await db.collection('users').where('approuve', '==', true).get()
  const tokenGroups = await Promise.all(approvedUsers.docs.map(docSnap => listPushTokensForUser(docSnap.id)))
  return tokenGroups.flat()
}

function normalizeAccessText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

async function requireSheetSyncAccess(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login required')

  const userSnap = await db.collection('users').doc(request.auth.uid).get()
  const user = userSnap.exists ? userSnap.data() : {}
  const email = String(user.email || request.auth.token.email || '').trim().toLowerCase()
  if (email === 'lterazaf@gmail.com') return

  const allowed = new Set(['president', 'vice president', 'vice-president', 'responsable financier', 'tresorier', 'admin'])
  const directRole = normalizeAccessText(user.staffRole || user.role)
  if (allowed.has(directRole)) return

  if (email) {
    const memberSnap = await db.collection('membres').where('email', '==', email).limit(1).get()
    if (!memberSnap.empty) {
      const memberRole = normalizeAccessText(memberSnap.docs[0].data().staffRole)
      if (allowed.has(memberRole)) return
    }
  }

  throw new HttpsError('permission-denied', 'Google Sheets sync is restricted to YFC leaders')
}

function voteKey(value) {
  const match = String(value || '').match(/([1-5])\s*$/)
  return match ? match[1] : ''
}

function emptyVoteCounts() {
  return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
}

function voteWinner(counts = {}) {
  return Object.entries({ ...emptyVoteCounts(), ...counts })
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || Number(a[0]) - Number(b[0]))[0]?.[0] || '1'
}

function publicVoteStats(data = {}) {
  const first = { ...emptyVoteCounts(), ...(data.first || {}) }
  const second = { ...emptyVoteCounts(), ...(data.second || {}) }
  return {
    first,
    second,
    firstWinner: voteWinner(first),
    secondWinner: voteWinner(second),
    total: Number(data.total || 0),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
  }
}

function voteStatsFromRows(rows = []) {
  const first = emptyVoteCounts()
  const second = emptyVoteCounts()

  for (const row of rows) {
    const firstKey = voteKey(row[2])
    const secondKey = voteKey(row[3])
    if (firstKey) first[firstKey] += 1
    if (secondKey) second[secondKey] += 1
  }

  return {
    first,
    second,
    firstWinner: voteWinner(first),
    secondWinner: voteWinner(second),
    total: rows.length,
    updatedAt: new Date().toISOString(),
  }
}

async function callGemini(prompt, { temperature = 0.7, maxOutputTokens = 900 } = {}) {
  const apiKey = geminiApiKey.value()
  if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY is not configured')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )

  if (!res.ok) throw new HttpsError('unavailable', `Gemini ${res.status}`)

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) throw new HttpsError('internal', 'Gemini returned an empty response')
  return text
}

exports.generateVerse = onCall({ secrets: [geminiApiKey] }, async () => {
  const prompt = `Tu es un assistant biblique pour Young For Christ (YFC) Madagascar.
Génère un verset biblique inspirant pour aujourd'hui.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou après. Format exact :
{"text":"texte complet du verset en français","ref":"Livre chapitre:verset","explanation":"explication inspirante et profonde en 4 à 5 phrases, adaptée à de jeunes chrétiens malgaches, qui développe le contexte biblique et l'application pratique dans la vie quotidienne"}
Choisis un verset qui apporte encouragement, foi ou sagesse. Varie les livres bibliques.`

  const raw = await callGemini(prompt, { temperature: 0.8, maxOutputTokens: 1024 })
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new HttpsError('internal', 'Invalid verse format')

  try {
    return JSON.parse(match[0])
  } catch {
    throw new HttpsError('internal', 'Invalid verse JSON')
  }
})

function formatAr(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' Ar'
}

function categoryLines(obj = {}) {
  const lines = Object.entries(obj)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([name, amount]) => `  - ${name} : ${formatAr(amount)}`)
  return lines.length ? lines.join('\n') : '  Aucune'
}

function buildBudgetPrompt(data, month) {
  const periode = month
    ? new Date(month + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
    : 'toute la période'

  return `Tu es un assistant financier pour Young For Christ (YFC) Madagascar.
Analyse ces données budgétaires et génère un résumé narratif clair en français.

PÉRIODE : ${periode}
Entrées  : ${formatAr(data.totalEntrees)} (${data.nbEntrees} transactions)
Dépenses : ${formatAr(data.totalDepenses)} (${data.nbDepenses} transactions)
Solde    : ${formatAr(data.solde)} (${data.solde >= 0 ? 'excédentaire' : 'déficitaire'})

Détail entrées :
${categoryLines(data.entreesParCat)}

Détail dépenses :
${categoryLines(data.depensesParCat)}

Génère un résumé structuré en 3 parties numérotées, sans markdown ni symboles # :
1. Vue d'ensemble (1-2 phrases sur la santé financière globale)
2. Points clés (2-3 observations sur les catégories principales)
3. Recommandation (1 phrase d'encouragement ou conseil pratique)

Ton : professionnel, bienveillant, adapté à une association chrétienne jeune malgache.`
}

exports.summarizeBudget = onCall({ secrets: [geminiApiKey] }, async request => {
  const { data, month } = request.data || {}
  if (!data || Number(data.nbEntrees || 0) + Number(data.nbDepenses || 0) === 0) {
    throw new HttpsError('invalid-argument', 'No budget data to summarize')
  }

  const text = await callGemini(buildBudgetPrompt(data, month), {
    temperature: 0.6,
    maxOutputTokens: 800,
  })

  return { text }
})

exports.savePushToken = onCall(async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login required')

  const token = safeText(request.data?.token)
  if (!token) throw new HttpsError('invalid-argument', 'Token is required')

  await db
    .collection('users')
    .doc(request.auth.uid)
    .collection('pushTokens')
    .doc(tokenDocId(token))
    .set({
      token,
      platform: safeText(request.data?.platform),
      userAgent: safeText(request.data?.userAgent),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

  return { ok: true }
})

exports.removePushToken = onCall(async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login required')

  const token = safeText(request.data?.token)
  if (!token) throw new HttpsError('invalid-argument', 'Token is required')

  await db
    .collection('users')
    .doc(request.auth.uid)
    .collection('pushTokens')
    .doc(tokenDocId(token))
    .delete()

  return { ok: true }
})

function plainDate(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value.toDate) return value.toDate().toISOString()
  if (value.seconds) return new Date(value.seconds * 1000).toISOString()
  return null
}

function safeDoc(doc) {
  const data = doc.data() || {}
  return { id: doc.id, ...data }
}

function totalByType(transactions, type) {
  return transactions
    .filter(t => t.type === type)
    .reduce((sum, t) => sum + Number(t.montant || 0), 0)
}

async function listCollection(name, { orderBy, direction = 'asc', limit = 80 } = {}) {
  let ref = db.collection(name)
  if (orderBy) ref = ref.orderBy(orderBy, direction)
  if (limit) ref = ref.limit(limit)
  const snap = await ref.get()
  return snap.docs.map(safeDoc)
}

async function buildAppContext(uid) {
  const [
    userSnap, allUsers, membres, transactions,
    agendaEvents, presenceEvents, presences,
    documents, notifications, motifs,
  ] = await Promise.all([
    db.collection('users').doc(uid).get(),
    listCollection('users', { limit: 300 }),
    listCollection('membres', { orderBy: 'nom', limit: 500 }),
    listCollection('transactions', { orderBy: 'date', direction: 'desc', limit: 300 }),
    listCollection('evenements_agenda', { orderBy: 'dateDebut', limit: 200 }),
    listCollection('evenements', { orderBy: 'date', direction: 'desc', limit: 200 }),
    listCollection('presences', { limit: 3000 }),
    listCollection('documents', { orderBy: 'uploadedAt', direction: 'desc', limit: 200 }),
    listCollection('notifications', { orderBy: 'createdAt', direction: 'desc', limit: 100 }),
    listCollection('motifs', { limit: 200 }),
  ])

  const user = userSnap.exists ? userSnap.data() : {}
  const currentUserEmail = String(user.email || '').trim().toLowerCase()
  const currentMember = membres.find(m => String(m.email || '').trim().toLowerCase() === currentUserEmail) || null
  const totalEntrees = totalByType(transactions, 'entree')
  const totalDepenses = totalByType(transactions, 'depense')

  // Group presences by eventId with full member details (presents & absents)
  const presenceByEvent = {}
  for (const p of presences) {
    const eid = p.eventId || p.evenementId
    if (!eid) continue
    if (!presenceByEvent[eid]) presenceByEvent[eid] = { presents: [], absents: [] }
    const info = {
      membreId: p.membreId || p.memberId || null,
      nom: p.membreNom || null,
      prenoms: p.membrePrenoms || null,
      nomPrefere: p.membreNomPrefere || null,
    }
    if (p.present === false) presenceByEvent[eid].absents.push(info)
    else presenceByEvent[eid].presents.push(info)
  }

  return {
    generatedAt: new Date().toISOString(),
    currentUser: {
      uid,
      nom: user.nom || null,
      email: user.email || null,
      role: user.role || (user.admin ? 'admin' : 'membre'),
      staff: currentMember?.staff === true,
      staffRole: currentMember?.staffRole || null,
      approuve: user.approuve === true,
      dateInscription: user.dateInscription || null,
      photoURL: user.photoURL || null,
    },
    stats: {
      membres: membres.length,
      utilisateurs: allUsers.length,
      transactions: transactions.length,
      totalEntrees,
      totalDepenses,
      solde: totalEntrees - totalDepenses,
      evenementsAgenda: agendaEvents.length,
      evenementsPresence: presenceEvents.length,
      enregistrementsPresence: presences.length,
      documents: documents.length,
      notifications: notifications.length,
      motifs: motifs.length,
    },
    utilisateurs: allUsers.map(u => ({
      id: u.id,
      nom: u.nom || u.displayName || null,
      prenom: u.prenom || null,
      email: u.email || null,
      role: u.role || (u.admin ? 'admin' : 'membre'),
      approuve: u.approuve === true,
      dateInscription: u.dateInscription || null,
      photoURL: u.photoURL || null,
    })),
    membres: membres.map(m => ({
      id: m.id,
      nom: m.nom || null,
      prenoms: m.prenoms || null,
      nomPrefere: m.nomPrefere || null,
      adresse: m.adresse || null,
      telephone: m.telephone || m.tel || null,
      email: m.email || null,
      tailleTshirt: m.tailleTshirt || null,
      staff: m.staff === true,
      staffRole: m.staffRole || null,
      dateAjout: m.dateAjout || m.dateInscription || null,
    })),
    transactions: transactions.map(t => ({
      id: t.id,
      type: t.type || null,
      date: t.date || null,
      montant: Number(t.montant || 0),
      motif: t.motif || null,
      note: t.note || null,
      createdBy: t.createdBy ? {
        uid: t.createdBy.uid || null,
        nom: t.createdBy.nom || null,
        email: t.createdBy.email || null,
      } : null,
      createdAt: plainDate(t.createdAt),
    })),
    evenements: agendaEvents.map(e => ({
      id: e.id,
      nom: e.nom || e.titre || e.title || null,
      dateDebut: e.dateDebut || null,
      dateFin: e.dateFin || null,
      heureDebut: e.heureDebut || null,
      heureFin: e.heureFin || null,
      lieu: e.lieu || null,
      description: e.description || null,
    })),
    presences: presenceEvents.map(e => {
      const data = presenceByEvent[e.id] || { presents: [], absents: [] }
      return {
        id: e.id,
        titre: e.titre || e.nom || null,
        date: e.date || null,
        createdAt: plainDate(e.createdAt),
        nbPresents: data.presents.length,
        nbAbsents: data.absents.length,
        presents: data.presents,
        absents: data.absents,
      }
    }),
    documents: documents.map(d => ({
      id: d.id,
      nom: d.nom || d.name || d.title || null,
      type: d.type || null,
      taille: d.taille || null,
      description: d.description || null,
      url: d.url || d.downloadURL || null,
      storagePath: d.storagePath || null,
      uploadedBy: d.uploadedBy
        ? (typeof d.uploadedBy === 'object' ? (d.uploadedBy.nom || d.uploadedBy.email || null) : d.uploadedBy)
        : null,
      uploadedAt: plainDate(d.uploadedAt),
    })),
    notifications: notifications.map(n => ({
      id: n.id,
      type: n.type || null,
      titre: n.titre || null,
      detail: n.detail || null,
      cible: n.cible || null,
      route: n.route || null,
      actor: n.actor ? {
        nom: n.actor.nom || null,
        email: n.actor.email || null,
      } : null,
      nbLecteurs: Array.isArray(n.readBy) ? n.readBy.length : 0,
      createdAt: plainDate(n.createdAt),
    })),
    motifs: motifs.map(m => ({
      id: m.id,
      nom: m.name || m.nom || null,
      type: m.type || null,
    })),
  }
}

function buildAssistantPrompt(message, context) {
  return `Tu es l'assistante virtuelle officielle de l'application YFC (Young For Christ) Madagascar.
Tu parles français ou malgache selon la langue de l'utilisateur.

---

DONNÉES DISPONIBLES DANS LE CONTEXTE JSON

Tu as accès à TOUTES les données réelles de l'application :

• currentUser — l'utilisateur connecté (uid, nom, email, role, staff, staffRole, approuve, dateInscription, photoURL)
• stats — chiffres globaux (nb membres, transactions, solde, présences, documents, etc.)
• utilisateurs — tous les comptes de l'app (id, nom, prenom, email, role, approuve, dateInscription)
• membres — liste complète (id, nom, prenoms, nomPrefere, adresse, telephone, email, tailleTshirt, staff, staffRole, dateAjout)
• transactions — toutes les transactions budget (id, type[entree/depense], date, montant, motif, note, createdBy{uid,nom,email}, createdAt)
• evenements — agenda YFC (id, nom, dateDebut, dateFin, heureDebut, heureFin, lieu, description)
• presences — par événement Alimbavaka (id, titre, date, createdAt, nbPresents, nbAbsents, presents[{membreId,nom,prenoms,nomPrefere}], absents[...])
• documents — fichiers partagés (id, nom, type, taille, description, url, storagePath, uploadedBy, uploadedAt)
• notifications — historique des annonces (id, type, titre, detail, cible, route, actor{nom,email}, nbLecteurs, createdAt)
• motifs — catégories budget prédéfinies (id, nom, type[entree/depense])

---

RÈGLES STRICTES

1. Ne jamais inventer de données. Utilise UNIQUEMENT ce qui est dans le contexte JSON.
2. Si un champ est null dans le contexte, affiche "(non renseigné)" — ne dis pas "Je n'ai pas accès".
3. Si une collection entière est vide ou absente → "Aucune donnée disponible pour le moment."
3. Ne réponds qu'aux sujets liés à l'application.
4. Si hors sujet → "Je peux seulement aider avec les données de l'application YFC."
5. Sois précis, clair et utile. Utilise les vraies valeurs (noms, montants, dates) du contexte.

---

ACTIONS DISPONIBLES

Quand l'utilisateur demande de créer ou modifier quelque chose, réponds UNIQUEMENT avec ce JSON exact, sans aucun texte autour, sans markdown, sans \`\`\` :

{"action":"<type>","data":{...},"needsConfirmation":true}

Types d'actions :
• create_member        → data: { nom, prenoms, nomPrefere, adresse, telephone, email, tailleTshirt, staff, staffRole }
• update_member        → data: { id, <champs modifiés>, staffRole }
• create_event         → data: { nom, dateDebut, dateFin, heureDebut, heureFin, lieu, description }
• update_event         → data: { id, <champs modifiés> }
• create_expense       → data: { motif, montant, date, note }
• create_contribution  → data: { motif, montant, date, note }
• send_message         → data: { sujet, corps, destinataires }

Règles pour les actions :
- Remplis toujours la date avec la date actuelle si non précisée.
- Si un champ essentiel manque (nom, motif, montant…), pose UNE seule question pour l'obtenir.
- Pour update_member / update_event, retrouve l'id dans le contexte à partir du nom mentionné.

---

RÉPONDRE AUX QUESTIONS

Réponds directement avec les données réelles du contexte. Exemples :
- "Combien de membres ?" → donne le nombre exact depuis stats.membres
- "Qui était présent à l'événement X ?" → liste les noms depuis presences[x].presents
- "Quel est le solde ?" → stats.solde en Ariary
- "Liste les dépenses de ce mois" → filtre transactions par date et type

Format de réponse pour les questions :
- Réponse directe (1-2 phrases)
- Détails si nécessaire : utilise des retours à la ligne et des tirets simples (-)
- Suggestion d'action (optionnel)

IMPORTANT FORMAT :
- N'utilise JAMAIS de markdown : pas de **, pas de *, pas de #, pas de __, pas de code blocks
- Utilise uniquement du texte brut avec des tirets (-) et des retours à la ligne
- Les listes se font avec "- item" sur chaque ligne

---

SÉCURITÉ
- Toujours demander confirmation avant toute modification
- Pour create_expense et create_contribution, l'utilisateur doit avoir currentUser.staffRole égal à Président, Vice-président ou Trésorier. Sinon, réponds qu'il peut consulter le budget mais pas le modifier.
- Si demande ambiguë → UNE question simple

---

CONTEXTE JSON COMPLET :
${JSON.stringify(context)}

MESSAGE :
${message}`
}

exports.generateAppAssistant = onCall({ secrets: [geminiApiKey] }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login required')

  const message = String(request.data?.message || '').trim()
  if (!message) throw new HttpsError('invalid-argument', 'Message is required')
  if (message.length > 800) throw new HttpsError('invalid-argument', 'Message too long')

  const context = await buildAppContext(request.auth.uid)
  const text = await callGemini(buildAssistantPrompt(message, context), {
    temperature: 0.35,
    maxOutputTokens: 1500,
  })

  return { text }
})

exports.prepareGoogleSheets = onCall({ secrets: sheetSecretList }, async request => {
  await requireSheetSyncAccess(request)
  try {
    await prepareGoogleSheet(sheetSecrets)
    return { ok: true, lastSync: new Date().toISOString() }
  } catch (e) {
    console.error('prepareGoogleSheets failed', e)
    throw new HttpsError('internal', e.message || 'Unable to prepare Google Sheet')
  }
})

exports.syncAllToGoogleSheets = onCall({ secrets: sheetSecretList, timeoutSeconds: 300, memory: '512MiB' }, async request => {
  await requireSheetSyncAccess(request)
  try {
    return await syncAllToGoogleSheets(sheetSecrets, { action: 'manualSync' })
  } catch (e) {
    console.error('syncAllToGoogleSheets failed', e)
    throw new HttpsError('internal', e.message || 'Unable to sync Google Sheet')
  }
})

exports.syncMembresToGoogleSheets = onDocumentWritten(
  { document: 'membres/{docId}', secrets: sheetSecretList, timeoutSeconds: 300, memory: '512MiB' },
  event => runTriggeredSync(sheetSecrets, event, 'membres'),
)

exports.syncTransactionsToGoogleSheets = onDocumentWritten(
  { document: 'transactions/{docId}', secrets: sheetSecretList, timeoutSeconds: 300, memory: '512MiB' },
  event => runTriggeredSync(sheetSecrets, event, 'transactions'),
)

exports.syncPresenceEventsToGoogleSheets = onDocumentWritten(
  { document: 'evenements/{docId}', secrets: sheetSecretList, timeoutSeconds: 300, memory: '512MiB' },
  event => runTriggeredSync(sheetSecrets, event, 'evenements'),
)

exports.syncPresenceDetailsToGoogleSheets = onDocumentWritten(
  { document: 'presences/{docId}', secrets: sheetSecretList, timeoutSeconds: 300, memory: '512MiB' },
  event => runTriggeredSync(sheetSecrets, event, 'presences'),
)

exports.submitVote = onCall({ secrets: sheetSecretList }, async request => {
  const name = safeText(request.data?.name)
  const firstChoice = safeText(request.data?.firstChoice)
  const secondChoice = safeText(request.data?.secondChoice)
  const userAgent = safeText(request.data?.userAgent)
  const firstKey = voteKey(firstChoice)
  const secondKey = voteKey(secondChoice)

  if (!name) throw new HttpsError('invalid-argument', 'Le nom est obligatoire')
  if (!firstChoice || !secondChoice) throw new HttpsError('invalid-argument', 'Les deux choix sont obligatoires')
  if (!firstKey || !secondKey) throw new HttpsError('invalid-argument', 'Choix invalide')
  if (name.length > 120 || firstChoice.length > 120 || secondChoice.length > 120) {
    throw new HttpsError('invalid-argument', 'Reponse trop longue')
  }

  try {
    const voteRef = db.collection('voteResults').doc('menu-30-mai')
    const voteResponseRef = db.collection('voteResponses').doc()
    const now = admin.firestore.FieldValue.serverTimestamp()

    await db.runTransaction(async transaction => {
      transaction.set(voteResponseRef, {
        name,
        firstChoice,
        secondChoice,
        userAgent: userAgent.slice(0, 240),
        createdAt: now,
      })
      transaction.set(voteRef, {
        [`first.${firstKey}`]: admin.firestore.FieldValue.increment(1),
        [`second.${secondKey}`]: admin.firestore.FieldValue.increment(1),
        total: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      }, { merge: true })
    })

    await appendVote(sheetSecrets, [
      toDateTimeString(nowIso()),
      name,
      firstChoice,
      secondChoice,
      userAgent.slice(0, 240),
    ])
    return { ok: true }
  } catch (e) {
    console.error('submitVote failed', e)
    throw new HttpsError('internal', e.message || 'Unable to submit vote')
  }
})

exports.getVoteResults = onCall({ secrets: sheetSecretList }, async () => {
  const rows = await getVoteRows(sheetSecrets)
  if (rows.length) return voteStatsFromRows(rows)

  const snap = await db.collection('voteResults').doc('menu-30-mai').get()
  return publicVoteStats(snap.exists ? snap.data() : {})
})

exports.requestPublicDocumentCopy = onCall(async request => {
  const prenom = safeText(request.data?.prenom)
  const email = safeText(request.data?.email).toLowerCase()
  const documentId = safeText(request.data?.documentId)
  const userAgent = safeText(request.data?.userAgent)

  if (!documentId) throw new HttpsError('invalid-argument', 'Document required')
  if (!prenom || prenom.length > 80) throw new HttpsError('invalid-argument', 'Prenom required')
  if (!isValidEmail(email) || email.length > 160) throw new HttpsError('invalid-argument', 'Email invalid')

  const docSnap = await db.collection('documents').doc(documentId).get()
  if (!docSnap.exists || docSnap.data().isPublic !== true) {
    throw new HttpsError('not-found', 'Document unavailable')
  }

  const documentData = docSnap.data()
  const documentName = safeText(documentData.nom, 'Document YFC')
  const documentUrl = safeText(documentData.url)
  if (!documentUrl) throw new HttpsError('failed-precondition', 'Document URL missing')

  const now = admin.firestore.FieldValue.serverTimestamp()
  await db.collection('publicDocumentRequests').add({
    documentId,
    documentName,
    prenom,
    email,
    userAgent: userAgent.slice(0, 240),
    createdAt: now,
  })

  const safePrenom = escapeHtml(prenom)
  const safeDocumentName = escapeHtml(documentName)
  const safeDocumentUrl = escapeHtml(documentUrl)

  try {
    await sendBrevoEmail({
      to: email,
      subject: `Votre document YFC - ${documentName}`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;background:#f4f5fb;padding:28px;color:#1A1C2E">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:26px;border:1px solid rgba(0,0,0,0.06)">
            <p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#16B5A3;text-transform:uppercase;letter-spacing:.08em">Young For Christ</p>
            <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#1A1C2E">Bonjour ${safePrenom},</h1>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#6B6F8A">
              Voici le lien pour telecharger le document demande :
            </p>
            <p style="margin:0 0 22px;font-size:16px;font-weight:700;color:#1A1C2E">${safeDocumentName}</p>
            <a href="${safeDocumentUrl}" style="display:inline-block;background:#16B5A3;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 18px;border-radius:12px">
              Telecharger le PDF
            </a>
            <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#A0A4BE">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
              <span style="word-break:break-all">${safeDocumentUrl}</span>
            </p>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('requestPublicDocumentCopy email failed', {
      documentId,
      documentName,
      email,
      message: e.message,
    })
    throw new HttpsError('internal', "L'envoi email a echoue. Verifiez la configuration Brevo.")
  }

  return { ok: true }
})

exports.sendPushForNotification = onDocumentCreated(
  { document: 'notifications/{docId}', timeoutSeconds: 120, memory: '256MiB' },
  async event => {
    const notification = event.data?.data()
    if (!notification) return

    const targets = await listPushTargets(notification)
    if (!targets.length) return

    const title = safeText(notification.titre, 'Nouvelle activité YFC')
    const body = buildPushBody(notification)
    const link = `https://young-for-christ.com${buildPushLink(notification)}`

    const message = {
      tokens: targets.map(target => target.token),
      notification: { title, body },
      webpush: {
        fcmOptions: { link },
        notification: {
          title,
          body,
          icon: 'https://young-for-christ.com/Yfc_icone.png',
          badge: 'https://young-for-christ.com/Yfc_icone.png',
          tag: event.params.docId,
        },
      },
      data: {
        title,
        body,
        link,
        notificationId: event.params.docId,
      },
    }

    const response = await admin.messaging().sendEachForMulticast(message)
    const invalidCodes = new Set([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ])

    const cleanup = response.responses
      .map((result, index) => ({ result, target: targets[index] }))
      .filter(({ result }) => !result.success && invalidCodes.has(result.error?.code))
      .map(({ target }) =>
        db.collection('users').doc(target.uid).collection('pushTokens').doc(target.id).delete().catch(() => {})
      )

    await Promise.all(cleanup)
  },
)
