import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

const CACHE_PREFIX = 'yfc_verse_'

export function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function cacheKey(dateKey) {
  return `${CACHE_PREFIX}${dateKey}`
}

function getCached(dateKey) {
  try {
    const raw = localStorage.getItem(cacheKey(dateKey))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setCached(dateKey, verse) {
  const key = cacheKey(dateKey)
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX) && k !== key)
    .forEach(k => localStorage.removeItem(k))
  localStorage.setItem(key, JSON.stringify(verse))
}

async function fetchFromGemini(force = false) {
  const [{ httpsCallable }, { cloudFunctions }] = await Promise.all([
    import('firebase/functions'),
    import('../firebaseFunctions'),
  ])
  const fn = httpsCallable(cloudFunctions, 'generateVerse')
  const result = await fn({ force })
  return result.data
}

/** Subscribe to the shared verse for a given date key (real-time hearts updates). */
export function subscribeToSharedVerse(dateKey, callback, onError) {
  return onSnapshot(
    doc(db, 'verseOfDay', dateKey),
    snap => callback(snap.exists() ? { ...snap.data(), id: snap.id } : null),
    err => {
      console.warn('[verseOfDay] subscribe:', err)
      onError?.()
    }
  )
}

/**
 * Ensure today's shared verse exists in Firestore, then return it.
 * Always writes to Firestore so toggleHeart (updateDoc) never fails on missing doc.
 */
export async function getOrCreateSharedVerse(dateKey) {
  // 1. Check Firestore
  try {
    const snap = await getDoc(doc(db, 'verseOfDay', dateKey))
    if (snap.exists() && snap.data().text) {
      const data = { ...snap.data(), id: snap.id }
      setCached(dateKey, data)
      return data
    }
  } catch (err) {
    console.warn('[verseOfDay] getDoc:', err)
  }

  // 2. Try localStorage cache — but still write to Firestore so hearts work
  const cached = getCached(dateKey)
  let verse = cached?.text ? { text: cached.text, ref: cached.ref, explanation: cached.explanation } : null

  // 3. Generate if no cache
  if (!verse) {
    try {
      verse = await fetchFromGemini(false)
    } catch (err) {
      console.warn('[verseOfDay] generate:', err)
    }
  }

  // 4. Always persist to Firestore (ensures updateDoc works for hearts)
  if (verse?.text) {
    try {
      await setDoc(doc(db, 'verseOfDay', dateKey), {
        text: verse.text,
        ref: verse.ref,
        explanation: verse.explanation || '',
        hearts: [],
        heartsInfo: {},
        createdAt: new Date().toISOString(),
      })
      setCached(dateKey, verse)
    } catch (err) {
      console.warn('[verseOfDay] setDoc:', err)
    }
    return verse
  }

  return null
}

/**
 * Toggle heart reaction.
 * Uses setDoc+merge for like (safe even if doc missing) and updateDoc for unlike.
 */
export async function toggleHeart(dateKey, uid, isCurrentlyLiked, userInfo = {}) {
  if (!uid) return
  const ref = doc(db, 'verseOfDay', dateKey)
  if (isCurrentlyLiked) {
    await updateDoc(ref, {
      hearts: arrayRemove(uid),
      [`heartsInfo.${uid}`]: deleteField(),
    })
  } else {
    // Dot-notation keeps other heartsInfo entries intact
    await updateDoc(ref, {
      hearts: arrayUnion(uid),
      [`heartsInfo.${uid}`]: { photoURL: userInfo.photoURL || '', name: userInfo.name || '' },
    })
  }
}

/** Force-regenerate and push new verse to all users via Firestore. */
export async function generateNewVerse(dateKey) {
  const key = dateKey ?? getDateKey()
  try {
    const verse = await fetchFromGemini(true)
    if (verse?.text) {
      await setDoc(doc(db, 'verseOfDay', key), {
        text: verse.text,
        ref: verse.ref,
        explanation: verse.explanation || '',
        hearts: [],
        heartsInfo: {},
        updatedAt: new Date().toISOString(),
      }).catch(() => {})
      setCached(key, verse)
    }
    return verse
  } catch (err) {
    console.warn('[verseOfDay] generateNew:', err)
    return null
  }
}

/** @deprecated Use getOrCreateSharedVerse instead */
export async function getVerseOfDay() {
  return getOrCreateSharedVerse(getDateKey())
}
