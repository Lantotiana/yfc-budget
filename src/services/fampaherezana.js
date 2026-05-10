import { httpsCallable } from 'firebase/functions'
import { cloudFunctions } from '../firebaseFunctions'

function parseAssistantAction(text) {
  const raw = String(text || '').trim()
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  if (!cleaned.startsWith('{')) return null

  try {
    const data = JSON.parse(cleaned)
    if (!data?.action || typeof data.action !== 'string') return null
    return data
  } catch {
    return null
  }
}

export async function generateAppAssistant(message) {
  try {
    const callable = httpsCallable(cloudFunctions, 'generateAppAssistant')
    const result = await callable({ message })
    const text = result.data?.text || ''
    const action = parseAssistantAction(text)
    return {
      ok: true,
      text: action ? '' : text,
      action,
    }
  } catch (err) {
    console.warn('App assistant function:', err)
    return {
      ok: false,
      text: 'Je n’arrive pas à contacter l’assistante pour le moment. Réessayez dans quelques instants.',
    }
  }
}
