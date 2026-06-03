/**
 * One-time migration: replace the file for a named Firestore document
 * without changing its ID (QR code stays valid).
 *
 * Usage: node scripts/update-document.mjs
 */

import { readFileSync, statSync } from 'fs'
import { basename } from 'path'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

// ── Config ───────────────────────────────────────────────────────────────────
const PROJECT_ID     = 'yfc-budget'
const STORAGE_BUCKET = 'yfc-budget.firebasestorage.app'
const DOC_NAME       = 'Boky fampianarana mitory teny.pdf'
const NEW_PDF_PATH   = 'src/assets/Fomba fitoriana filazantsara version numerique.pdf'
// ─────────────────────────────────────────────────────────────────────────────

initializeApp({
  credential: applicationDefault(),
  storageBucket: STORAGE_BUCKET,
})

const db      = getFirestore()
const bucket  = getStorage().bucket()

async function main() {
  // 1. Find the Firestore document by name
  console.log(`Searching for "${DOC_NAME}" in Firestore…`)
  const snap = await db.collection('documents')
    .where('nom', '==', DOC_NAME)
    .limit(1)
    .get()

  if (snap.empty) {
    console.error(`❌  Document "${DOC_NAME}" not found in Firestore.`)
    process.exit(1)
  }

  const docRef  = snap.docs[0].ref
  const docData = snap.docs[0].data()
  console.log(`✅  Found document — Firestore ID: ${docRef.id}`)
  console.log(`    Current storagePath: ${docData.storagePath || '(none)'}`)
  console.log(`    Current nom: ${docData.nom}`)

  // 2. Delete old file from Storage (non-fatal if missing)
  if (docData.storagePath) {
    try {
      await bucket.file(docData.storagePath).delete()
      console.log(`🗑️   Deleted old file: ${docData.storagePath}`)
    } catch (e) {
      console.warn(`⚠️   Could not delete old file (${e.code}), continuing…`)
    }
  }

  // 3. Upload new PDF
  const newFileName  = `Fomba fitoriana filazantsara version numerique.pdf`
  const newStoragePath = `documents/${Date.now()}_${newFileName}`
  const fileBuffer   = readFileSync(NEW_PDF_PATH)
  const fileSize     = statSync(NEW_PDF_PATH).size

  console.log(`⬆️   Uploading new file to ${newStoragePath}…`)
  const storageFile = bucket.file(newStoragePath)
  await storageFile.save(fileBuffer, {
    metadata: { contentType: 'application/pdf' },
    public: false,
  })

  // Get download URL (signed URL valid 100 years, or use getDownloadURL pattern)
  await storageFile.makePublic()
  const publicUrl = `https://storage.googleapis.com/${STORAGE_BUCKET}/${newStoragePath}`

  console.log(`✅  Uploaded. URL: ${publicUrl}`)

  // 4. Update Firestore document (keep same ID)
  await docRef.update({
    nom:         DOC_NAME,
    url:         publicUrl,
    storagePath: newStoragePath,
    taille:      fileSize,
    type:        'application/pdf',
    updatedAt:   new Date().toISOString(),
  })

  console.log(`✅  Firestore document updated — ID unchanged: ${docRef.id}`)
  console.log(`\n🎉  Done! QR code at /public/document/${docRef.id} now serves the new PDF.`)
}

main().catch(err => {
  console.error('❌  Script failed:', err.message || err)
  process.exit(1)
})
