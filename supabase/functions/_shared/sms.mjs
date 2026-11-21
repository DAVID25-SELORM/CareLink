/** Ghana numbers: 0244123456, 244123456, +233244123456 -> 233244123456. Anything else returns null. */
export function normalizeGhanaPhone(value) {
  const digits = String(value || '').replace(/[\s()-]/g, '').replace(/^\+/, '')
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`
  if (/^233\d{9}$/.test(digits)) return digits
  if (/^\d{9}$/.test(digits)) return `233${digits}`
  return null
}
