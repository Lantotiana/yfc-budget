const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')

const geminiApiKey = defineSecret('GEMINI_API_KEY')

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
