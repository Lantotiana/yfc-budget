// One-shot script: keeps the first staffMessage, deletes all others.
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Uses Application Default Credentials (Firebase CLI login)
initializeApp({ projectId: 'yfc-budget' })

const db = getFirestore()

async function run() {
  const snap = await db.collection('staffMessages')
    .orderBy('createdAt', 'asc')
    .get()

  if (snap.empty) { console.log('Collection vide, rien à faire.'); return }

  const [keep, ...rest] = snap.docs
  console.log(`Garder : "${keep.data().text?.slice(0, 60)}" (${keep.id})`)
  console.log(`Supprimer : ${rest.length} message(s)`)

  // Delete in batches of 500
  let batch = db.batch()
  let count = 0
  for (const doc of rest) {
    batch.delete(doc.ref)
    count++
    if (count % 500 === 0) { await batch.commit(); batch = db.batch() }
  }
  if (count % 500 !== 0) await batch.commit()

  console.log(`✓ ${rest.length} message(s) supprimé(s). 1 conservé.`)
}

run().catch(err => { console.error(err); process.exit(1) })
