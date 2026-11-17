// Dispensing safety checks for drug expiry and stock.
const DAY_MS = 86400000
export const NEAR_EXPIRY_DAYS = 30

const startOfDay = (value) => {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Whole days until the expiry date (negative once expired). null when no date is recorded. */
export function daysToExpiry(expiryDate, now = new Date()) {
  if (!expiryDate) return null
  const expiry = startOfDay(expiryDate)
  if (Number.isNaN(expiry.getTime())) return null
  return Math.round((expiry - startOfDay(now)) / DAY_MS)
}

/**
 * Check prescription lines before dispensing.
 * A drug is expired from the day after its expiry date. Expired stock must not be dispensed.
 * @returns {{blocked: string[], warnings: string[]}}
 */
export function checkDispensing(items, now = new Date()) {
  const blocked = []
  const warnings = []
  for (const item of items || []) {
    const drug = item?.drugs
    if (!drug) continue
    const days = daysToExpiry(drug.expiry_date, now)
    if (days === null) continue
    if (days < 0) blocked.push(`${drug.name} expired on ${drug.expiry_date}.`)
    else if (days <= NEAR_EXPIRY_DAYS) warnings.push(`${drug.name} expires in ${days} day${days === 1 ? '' : 's'}.`)
  }
  return { blocked, warnings }
}
