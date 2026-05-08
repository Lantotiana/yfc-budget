import { ADMIN_EMAIL } from '../constants'
import { normalizeAccessText } from './access'

const MANAGER_ROLES = new Set([
  'president',
  'vice president',
  'vice-president',
  'admin',
  'responsable materiel',
  'responsable materiel',
  'responsable logistique',
  'logistique',
])

export function getMaterielRole(user, userData, currentMember) {
  return normalizeAccessText(
    currentMember?.staffRole ||
    userData?.staffRole ||
    userData?.role ||
    ''
  )
}

export function canManageMateriels(user, userData, currentMember) {
  if (user?.email === ADMIN_EMAIL) return true
  return MANAGER_ROLES.has(getMaterielRole(user, userData, currentMember))
}

export function canEditMateriel(user, userData, currentMember) {
  return Boolean(user?.uid || user?.email)
}

export function canDeleteMateriel(user, userData, currentMember) {
  const role = getMaterielRole(user, userData, currentMember)
  return user?.email === ADMIN_EMAIL || role === 'admin' || role === 'president' || role === 'vice president' || role === 'vice-president'
}
