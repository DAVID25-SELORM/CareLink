// End-of-day cashier reconciliation. Figures come from the payments table; the cashier counts physical cash and
// the difference is recorded (with a reason when it is not zero) in the audit log.

export const dayKey = (value) => {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const money = (n) => Math.round((Number(n) || 0) * 100) / 100

/** Totals for one local calendar day. Refunded payments are listed separately and never counted as takings. */
export function summarizeDay(payments, date) {
  const rows = (payments || []).filter((p) => dayKey(p.created_at) === date)
  const taken = rows.filter((p) => p.status === 'completed')
  const refunded = rows.filter((p) => p.status === 'refunded')
  const sum = (list) => money(list.reduce((s, p) => s + (Number(p.amount) || 0), 0))
  const byMethod = {}
  for (const p of taken) {
    const key = p.payment_method === 'momo' && p.momo_provider ? `momo:${p.momo_provider}` : p.payment_method || 'other'
    byMethod[key] = money((byMethod[key] || 0) + (Number(p.amount) || 0))
  }
  return { count: taken.length, total: sum(taken), byMethod, cashExpected: sum(taken.filter((p) => p.payment_method === 'cash')), refundedCount: refunded.length, refundedTotal: sum(refunded) }
}

/** Counted cash vs expected. A reason is required whenever there is any difference. */
export function checkDayClose({ expectedCash, countedCash, note }) {
  const counted = Number(countedCash)
  if (countedCash === '' || countedCash == null || !Number.isFinite(counted) || counted < 0) return { ok: false, error: 'Enter the cash counted (0 if none)' }
  const variance = money(counted - expectedCash)
  if (variance !== 0 && String(note || '').trim().length < 5) return { ok: false, error: 'Explain the difference in the note before closing', variance }
  return { ok: true, variance, counted: money(counted) }
}

/** Only a payment whose prescription has not been dispensed can be refunded from the cashier screen. */
export function refundBlocker(payment, role) {
  if (role !== 'admin') return 'Only an administrator can approve a refund'
  if (payment.status !== 'completed') return 'Already refunded'
  if (payment.prescriptions?.status && payment.prescriptions.status !== 'paid') return 'Medication already dispensed'
  return ''
}
