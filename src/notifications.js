import { auth } from './auth'
import { db } from './firebase'
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, writeBatch } from 'firebase/firestore'

const NOTIFICATION_RESET_THRESHOLD = 150
const NOTIFICATION_DELETE_COUNT = 100

async function getActor() {
  const user = auth.currentUser
  if (!user) return { nom: 'Utilisateur inconnu', email: '', uid: '' }

  let nom = user.displayName || user.email || 'Utilisateur'
  let photoURL = user.photoURL || ''

  try {
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (snap.exists()) {
      const data = snap.data()
      nom = data.nom || data.displayName || nom
      photoURL = data.photoURL || photoURL
    }
  } catch (err) {
    console.warn('Impossible de charger le profil pour la notification', err)
  }

  return {
    uid: user.uid,
    nom,
    email: user.email || '',
    photoURL,
  }
}

export async function createNotification({ type, titre, detail = '', cible = '', route = '' }) {
  try {
    const actor = await getActor()
    await addDoc(collection(db, 'notifications'), {
      type,
      titre,
      detail,
      cible,
      route,
      actor,
      createdAt: new Date().toISOString(),
      readBy: [],
    })
    await cleanupOldNotifications()
  } catch (err) {
    console.warn('Notification non enregistree', err)
  }
}

async function cleanupOldNotifications() {
  const notificationsRef = collection(db, 'notifications')
  const oldestQuery = query(
    notificationsRef,
    orderBy('createdAt', 'asc'),
    limit(NOTIFICATION_RESET_THRESHOLD)
  )
  const snap = await getDocs(oldestQuery)

  if (snap.size < NOTIFICATION_RESET_THRESHOLD) return

  const batch = writeBatch(db)
  snap.docs.slice(0, NOTIFICATION_DELETE_COUNT).forEach(notificationDoc => {
    batch.delete(notificationDoc.ref)
  })
  await batch.commit()
}
