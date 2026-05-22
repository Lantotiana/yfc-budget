const NOTIFICATION_SEEN_PREFIX = 'yfc_notifications_seen_at:'

export function getNotificationSeenStorageKey(uid) {
  return `${NOTIFICATION_SEEN_PREFIX}${uid || 'guest'}`
}

export function getNotificationSeenAt(uid) {
  if (!uid || typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(getNotificationSeenStorageKey(uid)) || ''
  } catch {
    return ''
  }
}

export function setNotificationSeenAt(uid, value = new Date().toISOString()) {
  if (!uid || typeof window === 'undefined') return value
  try {
    window.localStorage.setItem(getNotificationSeenStorageKey(uid), value)
  } catch {}
  return value
}

export function isNotificationVisibleForUser(notification, user) {
  if (!notification || !user?.uid) return false
  if (notification.targetUserId && notification.targetUserId !== user.uid) return false
  if (notification.targetUserEmail && notification.targetUserEmail.toLowerCase() !== (user.email || '').toLowerCase()) return false
  return true
}

function notificationTimeValue(value) {
  if (!value) return 0
  if (typeof value === 'string') {
    const time = Date.parse(value)
    return Number.isNaN(time) ? 0 : time
  }
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  return 0
}

export function countUnseenNotifications(notifications, user, seenAt = '') {
  if (!user?.uid) return 0
  const seenTime = notificationTimeValue(seenAt)
  return notifications.filter(notification => {
    if (!isNotificationVisibleForUser(notification, user)) return false
    if ((notification.readBy || []).includes(user.uid)) return false
    if (!seenTime) return true
    return notificationTimeValue(notification.createdAt) > seenTime
  }).length
}
