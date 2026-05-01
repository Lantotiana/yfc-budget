const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')

admin.initializeApp()

const geminiApiKey = defineSecret('GEMINI_API_KEY')
const db = admin.firestore()

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

• currentUser — l'utilisateur connecté (uid, nom, email, role, approuve, dateInscription, photoURL)
• stats — chiffres globaux (nb membres, transactions, solde, présences, documents, etc.)
• utilisateurs — tous les comptes de l'app (id, nom, prenom, email, role, approuve, dateInscription)
• membres — liste complète (id, nom, prenoms, nomPrefere, adresse, telephone, email, tailleTshirt, dateAjout)
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
• create_member        → data: { nom, prenoms, nomPrefere, adresse, telephone, email, tailleTshirt }
• update_member        → data: { id, <champs modifiés> }
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
