const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
const CACHE_PREFIX = 'yfc_budget_summary_'

function getCached(key) {
  try { return localStorage.getItem(CACHE_PREFIX + key) || null } catch { return null }
}
function setCached(key, text) {
  try { localStorage.setItem(CACHE_PREFIX + key, text) } catch {}
}
function clearCached(key) {
  try { localStorage.removeItem(CACHE_PREFIX + key) } catch {}
}

function aggregate(transactions, month) {
  const list = month ? transactions.filter(t => t.date?.startsWith(month)) : transactions
  const entrees  = list.filter(t => t.type === 'entree')
  const depenses = list.filter(t => t.type === 'depense')
  const sum = arr => arr.reduce((s, t) => s + Number(t.montant || 0), 0)
  const byMotif = arr => arr.reduce((acc, t) => {
    acc[t.motif || 'Autre'] = (acc[t.motif || 'Autre'] || 0) + Number(t.montant || 0)
    return acc
  }, {})
  return {
    totalEntrees:  sum(entrees),
    totalDepenses: sum(depenses),
    solde: sum(entrees) - sum(depenses),
    nbEntrees:  entrees.length,
    nbDepenses: depenses.length,
    entreesParCat:  byMotif(entrees),
    depensesParCat: byMotif(depenses),
  }
}

function buildPrompt(data, month) {
  const fmt = n => Number(n).toLocaleString('fr-FR') + ' Ar'
  const periode = month
    ? new Date(month + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
    : 'toute la période'

  const catLines = (obj) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `  • ${k} : ${fmt(v)}`)
      .join('\n')

  return `Tu es un assistant financier pour Young For Christ (YFC) Madagascar.
Analyse ces données budgétaires et génère un résumé narratif clair en français.

PÉRIODE : ${periode}
Entrées  : ${fmt(data.totalEntrees)} (${data.nbEntrees} transactions)
Dépenses : ${fmt(data.totalDepenses)} (${data.nbDepenses} transactions)
Solde    : ${fmt(data.solde)} (${data.solde >= 0 ? 'excédentaire' : 'déficitaire'})

Détail entrées :
${catLines(data.entreesParCat) || '  Aucune'}

Détail dépenses :
${catLines(data.depensesParCat) || '  Aucune'}

Génère un résumé structuré en 3 parties numérotées, sans markdown ni symboles # :
1. Vue d'ensemble (1-2 phrases sur la santé financière globale)
2. Points clés (2-3 observations sur les catégories principales)
3. Recommandation (1 phrase d'encouragement ou conseil pratique)

Ton : professionnel, bienveillant, adapté à une association chrétienne jeune malgache.`
}

async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) throw new Error('Réponse vide')
  return text
}

export async function generateBudgetSummary(transactions, month, force = false) {
  if (!GEMINI_KEY) return null
  const cacheKey = month || 'all'
  if (!force) {
    const cached = getCached(cacheKey)
    if (cached) return cached
  } else {
    clearCached(cacheKey)
  }
  try {
    const data = aggregate(transactions, month)
    if (data.nbEntrees + data.nbDepenses === 0) return null
    const text = await callGemini(buildPrompt(data, month))
    setCached(cacheKey, text)
    return text
  } catch (err) {
    console.warn('Budget summary:', err)
    return null
  }
}
