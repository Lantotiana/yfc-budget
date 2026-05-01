const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
const CACHE_PREFIX = 'yfc_verse_'

function todayKey() {
  const now = new Date()
  const block = Math.floor(now.getHours() / 3) * 3
  return CACHE_PREFIX + now.toISOString().slice(0, 10) + '-' + String(block).padStart(2, '0')
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

async function fetchFromGemini() {
  const prompt = `Tu es un assistant biblique pour Young For Christ (YFC) Madagascar.
Génère un verset biblique inspirant pour aujourd'hui.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou après. Format exact :
{"text":"texte complet du verset en français","ref":"Livre chapitre:verset","explanation":"explication inspirante et profonde en 4 à 5 phrases, adaptée à de jeunes chrétiens malgaches, qui développe le contexte biblique et l'application pratique dans la vie quotidienne"}
Choisis un verset qui apporte encouragement, foi ou sagesse. Varie les livres bibliques.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini ${res.status}`)

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Format invalide')
  return JSON.parse(match[0])
}

export async function getVerseOfDay() {
  const cached = getCached()
  if (cached) return cached
  if (!GEMINI_KEY) return null
  try {
    const verse = await fetchFromGemini()
    setCached(verse)
    return verse
  } catch (err) {
    console.warn('Gemini API:', err)
    return null
  }
}

export async function generateNewVerse() {
  if (!GEMINI_KEY) return null
  try {
    const verse = await fetchFromGemini()
    setCached(verse)
    return verse
  } catch (err) {
    console.warn('Gemini API:', err)
    return null
  }
}
