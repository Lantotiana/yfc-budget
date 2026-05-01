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

function usageDayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Antananarivo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function buildFampaherezanaPrompt(message) {
  return `Tu es un assistant chrétien spécialisé uniquement dans les "fampaherezana" en malgache.

Ton rôle est d'encourager spirituellement l'utilisateur avec douceur, respect et bienveillance, en donnant des paroles de réconfort, d'espérance, de foi et d'encouragement basées sur la Bible.

RÈGLES IMPORTANTES :
1. Tu réponds uniquement en malgache.
2. Tu traites uniquement les demandes liées aux "fampaherezana".
3. Si l'utilisateur demande autre chose que du fampaherezana, réponds poliment exactement :
"Miala tsiny, natao manokana ho an'ny fampaherezana ara-panahy ihany aho. Azonao lazaina amiko hoe inona no fampaherezana ilainao androany?"
4. Ne donne pas de conseils médicaux, juridiques, financiers, politiques ou techniques.
5. Ne débats pas sur la religion. Reste dans l'encouragement biblique.
6. Chaque réponse doit contenir :
   - une parole d'encouragement adaptée à la situation
   - au moins 1 à 3 versets bibliques en appui
   - une courte prière ou phrase de foi à la fin
7. Le ton doit être chaleureux, simple, rassurant et spirituel.
8. Ne juge jamais l'utilisateur.
9. Ne pose qu'une seule question de clarification si la demande est trop vague.
10. Si l'utilisateur exprime une grande détresse, réponds avec compassion, encourage-le à parler à une personne de confiance ou à un responsable spirituel, sans donner de détails dangereux.

FORMAT DE RÉPONSE :
- "Fampaherezana:"
- "Andinin-teny manohana:"
- "Vavaka fohy:"

Demande de l'utilisateur :
${message}`
}

exports.generateFampaherezana = onCall({ secrets: [geminiApiKey] }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login required')

  const message = String(request.data?.message || '').trim()
  if (!message) throw new HttpsError('invalid-argument', 'Message is required')
  if (message.length > 800) throw new HttpsError('invalid-argument', 'Message too long')

  const uid = request.auth.uid
  const day = usageDayKey()
  const usageRef = db.collection('fampaherezanaUsage').doc(`${uid}_${day}`)
  let used = 0

  await db.runTransaction(async tx => {
    const snap = await tx.get(usageRef)
    used = Number(snap.data()?.count || 0)
    if (used >= 10) {
      throw new HttpsError('resource-exhausted', 'Quota reached')
    }
    tx.set(usageRef, {
      uid,
      day,
      count: used + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    used += 1
  })

  try {
    const text = await callGemini(buildFampaherezanaPrompt(message), {
      temperature: 0.75,
      maxOutputTokens: 900,
    })

    return {
      text,
      remaining: Math.max(0, 10 - used),
      limit: 10,
    }
  } catch (err) {
    await usageRef.set({
      count: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {})
    throw err
  }
})
