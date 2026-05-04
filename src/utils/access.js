export const BUDGET_MANAGER_ROLES = ['president', 'vice president', 'responsable financier']
export const STAFF_MESSAGE_MODERATOR_ROLES = ['president']

export function normalizeAccessText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function canManageBudgetRole(role) {
  return BUDGET_MANAGER_ROLES.includes(normalizeAccessText(role))
}

export function canModerateStaffMessagesRole(role) {
  return STAFF_MESSAGE_MODERATOR_ROLES.includes(normalizeAccessText(role))
}

export function sameEmail(a, b) {
  return normalizeAccessText(a) === normalizeAccessText(b)
}
