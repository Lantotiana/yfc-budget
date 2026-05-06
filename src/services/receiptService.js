import { collection, doc, getDocs, query, where, setDoc, updateDoc, runTransaction, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase'

export async function getReceiptByEntryId(budgetEntryId) {
  const q = query(collection(db, 'donReceipts'), where('budgetEntryId', '==', budgetEntryId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function generateReceiptNumber() {
  const year = new Date().getFullYear()
  const counterRef = doc(db, 'receipts_meta', 'counter')
  let receiptNumber = null
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const yearCounts = snap.exists() ? (snap.data().yearCounts || {}) : {}
    const next = (yearCounts[String(year)] || 0) + 1
    yearCounts[String(year)] = next
    tx.set(counterRef, { yearCounts })
    receiptNumber = `YFC-${year}-${String(next).padStart(4, '0')}`
  })
  return receiptNumber
}

export async function createReceipt(data) {
  const ref = doc(collection(db, 'donReceipts'))
  const now = new Date().toISOString()
  const receipt = { ...data, status: 'generated', sentChannels: [], createdAt: now, updatedAt: now }
  await setDoc(ref, receipt)
  return { id: ref.id, ...receipt }
}

export async function updateReceipt(receiptId, data) {
  const ref = doc(db, 'donReceipts', receiptId)
  await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() })
}

export async function markReceiptSent(receiptId, channel) {
  const ref = doc(db, 'donReceipts', receiptId)
  await updateDoc(ref, {
    status: 'sent',
    sentChannels: arrayUnion(channel),
    updatedAt: new Date().toISOString(),
  })
}
