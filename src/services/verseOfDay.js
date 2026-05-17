const CACHE_PREFIX = 'yfc_verse_'

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${CACHE_PREFIX}${year}-${month}-${day}`
}

function getCached() {
  try {
    const raw = localStorage.getItem(todayKey())
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setCached(verse) {
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX) && k !== todayKey())
    .forEach(k => localStorage.removeItem(k))
  localStorage.setItem(todayKey(), JSON.stringify(verse))
}

async function fetchVerse(force = false) {
  const [{ httpsCallable }, { cloudFunctions }] = await Promise.all([
    import('firebase/functions'),
    import('../firebaseFunctions'),
  ])
  const generateVerse = httpsCallable(cloudFunctions, 'generateVerse')
  const result = await generateVerse({ force })
  return result.data
}

export async function getVerseOfDay() {
  const cached = getCached()
  if (cached) return cached
  try {
    const verse = await fetchVerse(false)
    setCached(verse)
    return verse
  } catch (err) {
    console.warn('Verse function:', err)
    return null
  }
}

export async function generateNewVerse() {
  try {
    const verse = await fetchVerse(true)
    setCached(verse)
    return verse
  } catch (err) {
    console.warn('Verse function:', err)
    return null
  }
}
