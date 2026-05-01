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
  const [userSnap, membres, transactions, agendaEvents, presenceEvents, presences, documents] = await Promise.all([
    db.collection('users').doc(uid).get(),
    listCollection('membres', { orderBy: 'nom', limit: 250 }),
    listCollection('transactions', { orderBy: 'date', direction: 'desc', limit: 120 }),
    listCollection('evenements_agenda', { orderBy: 'dateDebut', limit: 80 }),
    listCollection('evenements', { orderBy: 'date', direction: 'desc', limit: 80 }),
    listCollection('presences', { limit: 500 }),
    listCollection('documents', { orderBy: 'uploadedAt', direction: 'desc', limit: 60 }),
  ])

  const user = userSnap.exists ? userSnap.data() : {}
  const totalEntrees = totalByType(transactions, 'entree')
  const totalDepenses = totalByType(transactions, 'depense')

  return {
    generatedAt: new Date().toISOString(),
    currentUser: {
      uid,
      nom: user.nom || null,
      email: user.email || null,
      role: user.role || (user.admin ? 'admin' : 'membre'),
      approuve: user.approuve === true,
    },
    stats: {
      membres: membres.length,
      transactions: transactions.length,
      totalEntrees,
      totalDepenses,
      solde: totalEntrees - totalDepenses,
      evenementsAgenda: agendaEvents.length,
      evenementsPresence: presenceEvents.length,
      presences: presences.length,
      documents: documents.length,
    },
    membres: membres.map(m => ({
      id: m.id,
      nom: m.nom || null,
      telephone: m.telephone || m.tel || null,
      email: m.email || null,
      dateInscription: m.dateInscription || null,
    })),
    transactions: transactions.map(t => ({
      id: t.id,
      type: t.type || null,
      date: t.date || null,
      montant: Number(t.montant || 0),
      motif: t.motif || null,
      note: t.note || null,
    })),
    evenements: agendaEvents.map(e => ({
      id: e.id,
      titre: e.titre || e.title || null,
      dateDebut: e.dateDebut || null,
      dateFin: e.dateFin || null,
      lieu: e.lieu || null,
      description: e.description || null,
      statut: e.statut || null,
    })),
    presences: {
      evenements: presenceEvents.map(e => ({
        id: e.id,
        nom: e.nom || e.titre || null,
        date: e.date || null,
      })),
      enregistrements: presences.map(p => ({
        id: p.id,
        evenementId: p.evenementId || p.eventId || null,
        membreId: p.membreId || p.memberId || null,
        present: p.present ?? true,
      })),
    },
    documents: documents.map(d => ({
      id: d.id,
      nom: d.nom || d.name || d.title || null,
      type: d.type || null,
      uploadedAt: plainDate(d.uploadedAt),
    })),
  }
}

function buildAssistantPrompt(message, context) {
  return `Tu es l'assistante virtuelle officielle de cette application de gestion d'association.

Tu aides l'utilisateur à :
- consulter les données de l'application
- comprendre les informations
- créer, modifier ou organiser des données

Tu peux répondre en français OU en malgache selon la langue de l'utilisateur.

---

CONTEXTE
L'application contient des données comme :
- membres
- événements
- cotisations
- dépenses
- présences
- messages / annonces
- statistiques

Ces données te sont fournies dans le contexte sous forme JSON.

---

RÈGLES STRICTES

1. Tu ne dois JAMAIS inventer de données.
2. Si une information n'est pas présente :
   → "Je n'ai pas accès à cette information pour le moment."
3. Tu réponds uniquement sur les données de l'application.
4. Si la demande est hors sujet :
   → "Je peux seulement aider avec les informations liées à l'application."
5. Tu dois être clair, structuré et utile.
6. Respecte les rôles utilisateurs si fournis (admin, membre, etc.).
7. Tu ne fais AUCUNE action réelle (écriture en base).

---

GESTION DES ACTIONS

Quand l'utilisateur demande une action (ajouter, modifier, supprimer), tu dois répondre en JSON STRICT, sans texte autour :
Ne mets jamais le JSON dans un bloc markdown. N'utilise jamais \`\`\`json ni \`\`\`.

{
  "action": "<type_action>",
  "data": { ... },
  "needsConfirmation": true
}

Types d'actions possibles :
- create_member
- update_member
- create_event
- update_event
- create_expense
- create_contribution
- send_message

Toujours :
- extraire proprement les infos
- compléter si possible (date actuelle si non précisée)
- rester simple et cohérent
- si une information essentielle manque (ex: motif/titre d'une dépense, nom d'un membre, titre d'un événement), ne réponds pas en JSON : pose UNE question simple pour demander cette information

---

GESTION DES QUESTIONS

Quand l'utilisateur pose une question, tu réponds normalement avec ce format :

Résumé court

Détails (si nécessaire)

Action suggérée (optionnel)

---

AIDE À LA RÉDACTION

Tu peux aussi rédiger des messages, reformuler, résumer.
Mais tu ne dois jamais envoyer directement (toujours proposer).

---

SÉCURITÉ

- Ne supprime rien sans confirmation
- Ne modifie rien sans confirmation
- Si la demande est ambiguë → pose UNE question simple

---

CONTEXTE JSON DE L'APPLICATION :
${JSON.stringify(context)}

MESSAGE UTILISATEUR :
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
    maxOutputTokens: 1100,
  })

  return { text }
})
