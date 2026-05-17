import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

const lastTracked = new Map()
const MIN_REPEAT_INTERVAL = 2500

export function getActivityFromPath(pathname = '/') {
  if (pathname === '/') return 'Consulte l’accueil'
  if (pathname.startsWith('/dashboard')) return 'Consulte le tableau de bord'
  if (pathname.startsWith('/budget')) return 'Consulte le budget'
  if (pathname.startsWith('/membres')) return 'Consulte les membres'
  if (pathname.startsWith('/presences')) return 'Consulte les présences'
  if (pathname.startsWith('/evenements')) return 'Consulte les événements'
  if (pathname.startsWith('/tasks')) return 'Consulte les tâches'
  if (pathname.startsWith('/documents')) return 'Consulte documents et matériels'
  if (pathname.startsWith('/notifications')) return 'Consulte les notifications'
  if (pathname.startsWith('/messages')) return 'Consulte les messages'
  if (pathname.startsWith('/assistant') || pathname.startsWith('/fampaherezana')) return 'Utilise l’assistant'
  if (pathname.startsWith('/parametres')) return 'Consulte les paramètres'
  if (pathname.startsWith('/admin')) return 'Consulte l’administration'
  return 'Utilise l’application'
}

export function trackUserActivity(user, currentActivity, currentPath) {
  if (!user?.uid || !currentActivity) return Promise.resolve()
  const now = Date.now()
  const key = `${user.uid}:${currentActivity}:${currentPath || window.location.pathname}`
  const last = lastTracked.get(key) || 0
  if (now - last < MIN_REPEAT_INTERVAL) return Promise.resolve()
  lastTracked.set(key, now)
  return updateDoc(doc(db, 'users', user.uid), {
    currentActivity,
    currentPath: currentPath || window.location.pathname,
    currentActivityUpdatedAt: serverTimestamp(),
  }).catch(() => {})
}
