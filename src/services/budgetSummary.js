import { httpsCallable } from 'firebase/functions'
import { cloudFunctions } from '../firebaseFunctions'

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
  const entrees = list.filter(t => t.type === 'entree')
  const depenses = list.filter(t => t.type === 'depense')
  const sum = arr => arr.reduce((s, t) => s + Number(t.montant || 0), 0)
  const byMotif = arr => arr.reduce((acc, t) => {
    acc[t.motif || 'Autre'] = (acc[t.motif || 'Autre'] || 0) + Number(t.montant || 0)
    return acc
  }, {})

  return {
    totalEntrees: sum(entrees),
    totalDepenses: sum(depenses),
    solde: sum(entrees) - sum(depenses),
    nbEntrees: entrees.length,
    nbDepenses: depenses.length,
    entreesParCat: byMotif(entrees),
    depensesParCat: byMotif(depenses),
  }
}

export async function generateBudgetSummary(transactions, month, force = false) {
  const cacheKey = month || 'all'
  if (!force) {
    const cached = getCached(cacheKey)
    if (cached) return cached
  } else {
    clearCached(cacheKey)
  }

  const data = aggregate(transactions, month)
  if (data.nbEntrees + data.nbDepenses === 0) return null

  try {
    const summarizeBudget = httpsCallable(cloudFunctions, 'summarizeBudget')
    const result = await summarizeBudget({ data, month })
    const text = result.data?.text || null
    if (text) setCached(cacheKey, text)
    return text
  } catch (err) {
    console.warn('Budget summary function:', err)
    return null
  }
}
