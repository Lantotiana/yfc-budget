import { httpsCallable } from 'firebase/functions'
import { cloudFunctions } from '../firebase'

const QUOTA_MESSAGE = 'Efa tapitra ny quota-nao androany. Afaka miverina rahampitso ianao hahazo fampaherezana vaovao.'

export async function generateFampaherezana(message) {
  try {
    const callable = httpsCallable(cloudFunctions, 'generateFampaherezana')
    const result = await callable({ message })
    return {
      ok: true,
      text: result.data?.text || '',
      remaining: result.data?.remaining ?? null,
      limit: result.data?.limit ?? 10,
    }
  } catch (err) {
    if (err?.code === 'functions/resource-exhausted') {
      return { ok: false, quota: true, text: QUOTA_MESSAGE, remaining: 0, limit: 10 }
    }
    console.warn('Fampaherezana function:', err)
    return {
      ok: false,
      text: 'Miala tsiny, tsy afaka mamaly vetivety aho izao. Andramo indray afaka kelikely.',
      remaining: null,
      limit: 10,
    }
  }
}
