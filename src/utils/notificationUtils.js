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

export function countUnseenNotifications(notifications, user, seenAt = '') {
  if (!user?.uid) return 0
  return notifications.filter(notification => {
    if (!isNotificationVisibleForUser(notification, user)) return false
    if (!seenAt) return true
    return String(notification.createdAt || '') > seenAt
  }).length
}
