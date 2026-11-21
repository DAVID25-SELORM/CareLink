// Batch-level stock rules: first-expiry-first-out (FEFO) allocation and drug-level expiry roll-up.
import { daysToExpiry } from './drugAlerts'

const isUsable = (batch, now) =>
  (batch.status == null || batch.status === 'active') &&
  Number(batch.quantity_remaining) > 0 &&
  (daysToExpiry(batch.expiry_date, now) ?? -1) >= 0

const byExpiry = (a, b) =>
  String(a.expiry_date).localeCompare(String(b.expiry_date)) || String(a.id).localeCompare(String(b.id))

/**
 * Take `quantity` units from the batches that expire first, skipping expired,
 * quarantined, recalled and empty batches.
 * @returns {{allocations: Array<{batch_id: string, batch_number: string, expiry_date: string, quantity: number, remaining_after: number}>, shortfall: number, usable: number}}
 */
export function allocateFefo(batches, quantity, now = new Date()) {
  const usable = (batches || []).filter((b) => isUsable(b, now)).sort(byExpiry)
  const usableTotal = usable.reduce((sum, b) => sum + Number(b.quantity_remaining), 0)
  let need = Math.max(0, Math.floor(Number(quantity) || 0))
  const allocations = []
  for (const batch of usable) {
    if (need === 0) break
    const take = Math.min(need, Number(batch.quantity_remaining))
    allocations.push({
      batch_id: batch.id,
      batch_number: batch.batch_number,
      expiry_date: batch.expiry_date,
      quantity: take,
      remaining_after: Number(batch.quantity_remaining) - take,
    })
    need -= take
  }
  return { allocations, shortfall: need, usable: usableTotal }
}

/** Earliest expiry (YYYY-MM-DD) among batches that still hold sellable stock, or null. */
export function earliestBatchExpiry(batches) {
  const live = (batches || []).filter(
    (b) => (b.status == null || b.status === 'active') && Number(b.quantity_remaining) > 0 && b.expiry_date,
  )
  if (live.length === 0) return null
  return live.map((b) => String(b.expiry_date).slice(0, 10)).sort()[0]
}
