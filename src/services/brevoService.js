import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

const SENDER = { name: 'Young For Christ Itaosy', email: 'contact@young-for-christ.com' }

let _cachedKey = null

async function getApiKey() {
  if (_cachedKey) return _cachedKey
  const snap = await getDoc(doc(db, 'config', 'secrets'))
  if (!snap.exists()) throw new Error('Clé Brevo introuvable dans Firestore (config/secrets)')
  const key = snap.data().brevoApiKey
  if (!key) throw new Error('Champ brevoApiKey manquant dans config/secrets')
  _cachedKey = key
  return key
}

export async function sendBrevoEmail({ to, subject, htmlContent }) {
  const apiKey = await getApiKey()
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Brevo error ${res.status}`)
  }
  return res.json()
}
