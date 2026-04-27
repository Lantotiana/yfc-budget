export function toDisplayDate(str) {
  if (!str || str.length < 10) return str || ''
  const [y, m, d] = str.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}
