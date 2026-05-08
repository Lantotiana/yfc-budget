import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { httpsCallable } from 'firebase/functions'
import { app, cloudFunctions } from '../firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

let foregroundListenerBound = false

function canUsePush() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

async function getMessagingInstance() {
  if (!canUsePush()) return null
  const supported = await isSupported().catch(() => false)
  if (!supported) return null
  return getMessaging(app)
}

async function getServiceWorkerRegistration() {
  if (!canUsePush()) return null
  return navigator.serviceWorker.register('/firebase-messaging-sw.js')
}

async function saveToken(token) {
  const savePushToken = httpsCallable(cloudFunctions, 'savePushToken')
  await savePushToken({
    token,
    platform: navigator.platform || '',
    userAgent: navigator.userAgent || '',
  })
}

async function removeTokenOnServer(token) {
  const removePushToken = httpsCallable(cloudFunctions, 'removePushToken')
  await removePushToken({ token })
}

export async function getPushAvailability() {
  if (!canUsePush()) {
    return {
      supported: false,
      enabled: false,
      permission: 'unsupported',
      configured: Boolean(VAPID_KEY),
    }
  }

  const messaging = await getMessagingInstance()
  return {
    supported: Boolean(messaging),
    enabled: Notification.permission === 'granted',
    permission: Notification.permission,
    configured: Boolean(VAPID_KEY),
  }
}

export async function syncPushNotifications() {
  if (!VAPID_KEY) return { ok: false, reason: 'missing-vapid-key' }

  const messaging = await getMessagingInstance()
  if (!messaging) return { ok: false, reason: 'unsupported' }
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission-not-granted' }

  const registration = await getServiceWorkerRegistration()
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  if (!token) return { ok: false, reason: 'missing-token' }

  await saveToken(token)
  return { ok: true, token }
}

export async function enablePushNotifications() {
  if (!VAPID_KEY) return { ok: false, reason: 'missing-vapid-key' }
  if (!canUsePush()) return { ok: false, reason: 'unsupported' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'permission-denied' }

  return syncPushNotifications()
}

export async function disablePushNotifications() {
  const messaging = await getMessagingInstance()
  if (!messaging) return { ok: false, reason: 'unsupported' }

  const registration = await getServiceWorkerRegistration()
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  }).catch(() => null)

  if (token) {
    await removeTokenOnServer(token).catch(() => {})
    await deleteToken(messaging).catch(() => {})
  }

  return { ok: true }
}

export async function bindForegroundPushNotifications(onReceive) {
  if (foregroundListenerBound) return
  const messaging = await getMessagingInstance()
  if (!messaging) return

  onMessage(messaging, payload => {
    if (typeof onReceive === 'function') onReceive(payload)
  })

  foregroundListenerBound = true
}
