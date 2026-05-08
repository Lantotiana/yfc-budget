import { ADMIN_EMAIL } from '../constants'
import { normalizeAccessText } from './access'

export const TASK_STATUSES = ['todo', 'in_progress', 'done']
export const TASK_PRIORITIES = ['low', 'medium', 'high']

export const TASK_STATUS_LABELS = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
}

export const TASK_PRIORITY_LABELS = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Haute',
}

export const TASK_COLUMNS = [
  { key: 'todo', labelKey: 'tasks.todo', emptyKey: 'tasks.emptyTodo' },
  { key: 'in_progress', labelKey: 'tasks.inProgress', emptyKey: 'tasks.emptyInProgress' },
  { key: 'done', labelKey: 'tasks.done', emptyKey: 'tasks.emptyDone' },
]

export const TASK_MANAGER_ROLES = [
  'president',
  'vice president',
  'vice-president',
  'responsable financier',
  'responsable materiel',
  'responsable de communication',
  'mentor',
  'admin',
]

export function getTaskRole(userData, currentMember) {
  return normalizeAccessText(currentMember?.staffRole || userData?.staffRole || userData?.role)
}

export function canManageTasks(user, userData, currentMember) {
  if (!user) return false
  if (user.email === ADMIN_EMAIL) return true
  return TASK_MANAGER_ROLES.includes(getTaskRole(userData, currentMember))
}

export function canCreateTasks(user) {
  return Boolean(user?.uid)
}

export function canChangeTaskStatus(task, user, userData, currentMember) {
  return Boolean(user?.uid)
}

export function canEditTask(task, user, userData, currentMember) {
  return Boolean(user?.uid)
}

export function canArchiveTask(user, userData, currentMember) {
  return canManageTasks(user, userData, currentMember)
}

export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  return null
}

export function formatDate(value) {
  const date = toDate(value)
  if (!date) return ''
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function toDateInputValue(value) {
  const date = toDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDueDateStatus(deadline, status) {
  if (status === 'done') return { labelKey: 'tasks.done', color: 'neutral', isOverdue: false }

  const date = toDate(deadline)
  if (!date) return { labelKey: 'tasks.deadlineRequired', color: 'red', isOverdue: true }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(date)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) {
    const count = Math.abs(diffDays)
    return { labelKey: count === 1 ? 'tasks.overdueYesterday' : 'tasks.overdueNDays', labelN: count, color: 'red', isOverdue: true }
  }
  if (diffDays === 0) return { labelKey: 'tasks.today', color: 'red', isOverdue: false }
  if (diffDays === 1) return { labelKey: 'tasks.tomorrow', color: 'orange', isOverdue: false }
  if (diffDays <= 3) return { labelKey: 'tasks.inDays', labelN: diffDays, color: 'orange', isOverdue: false }
  return { labelKey: 'tasks.inDays', labelN: diffDays, color: 'green', isOverdue: false }
}

export function validateTaskPayload(payload) {
  const errors = {}
  if (!payload.title?.trim()) errors.title = 'tasks.errorTitle'
  if (!payload.deadline || !toDate(payload.deadline)) errors.deadline = 'tasks.errorDeadline'
  if (!Array.isArray(payload.assignedTo) || payload.assignedTo.length === 0) errors.assignedTo = 'tasks.errorAssignee'
  if (!TASK_STATUSES.includes(payload.status)) errors.status = 'tasks.errorStatus'
  if (!TASK_PRIORITIES.includes(payload.priority)) errors.priority = 'tasks.errorPriority'
  return errors
}

export function getDisplayMemberName(userDoc = {}, memberDoc = {}) {
  return (
    memberDoc.nomPrefere ||
    userDoc.nomPrefere ||
    memberDoc.prenoms?.split(/\s+/)[0] ||
    userDoc.prenom ||
    memberDoc.nom ||
    userDoc.nom ||
    userDoc.displayName ||
    userDoc.email ||
    'Staff'
  )
}

export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
