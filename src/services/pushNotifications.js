import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { httpsCallable } from 'firebase/functions'
import { app, cloudFunctions } from '../firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

let foregroundListenerBound = false

function toPushError(err, fallback = 'unknown-error') {
  const code = String(err?.code || '')
  const message = String(err?.message || '')

  if (!window.isSecureContext) return { ok: false, reason: 'insecure-context', error: message }
  if (code.includes('functions/not-found')) return { ok: false, reason: 'functions-not-deployed', error: message }
  if (code.includes('functions/unavailable')) return { ok: false, reason: 'functions-unavailable', error: message }
  if (code.includes('messaging/permission-blocked')) return { ok: false, reason: 'permission-denied', error: message }
  if (code.includes('messaging/token-subscribe-failed')) return { ok: false, reason: 'token-subscribe-failed', error: message }
  if (code.includes('messaging/unsupported-browser')) return { ok: false, reason: 'unsupported', error: message }
  if (code.includes('messaging/failed-service-worker-registration')) return { ok: false, reason: 'service-worker-registration-failed', error: message }
  return { ok: false, reason: fallback, error: message }
}

function canUsePush() {
  return typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator
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
      permission: typeof window !== 'undefined' && !window.isSecureContext ? 'insecure-context' : 'unsupported',
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
  if (typeof window !== 'undefined' && !window.isSecureContext) return { ok: false, reason: 'insecure-context' }

  const messaging = await getMessagingInstance()
  if (!messaging) return { ok: false, reason: 'unsupported' }
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission-not-granted' }

  try {
    const registration = await getServiceWorkerRegistration()
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!token) return { ok: false, reason: 'missing-token' }

    await saveToken(token)
    return { ok: true, token }
  } catch (err) {
    return toPushError(err, 'token-sync-failed')
  }
}

export async function enablePushNotifications() {
  if (!VAPID_KEY) return { ok: false, reason: 'missing-vapid-key' }
  if (typeof window !== 'undefined' && !window.isSecureContext) return { ok: false, reason: 'insecure-context' }
  if (!canUsePush()) return { ok: false, reason: 'unsupported' }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'permission-denied' }

    return syncPushNotifications()
  } catch (err) {
    return toPushError(err, 'permission-request-failed')
  }
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
