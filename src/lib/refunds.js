// Refund request/approve queue. No new table: a request is an audit_log entry (action 'refund_request',
// record_id = payment id). Admins read every request; a cashier reads only their own (audit_log access rule).
// A request is settled when the payment becomes 'refunded' (approved) or its notes carry a rejection line.

export const REFUND_REQUEST = 'refund_request'
export const REJECT_MARK = 'REFUND REQUEST REJECTED'
export const MIN_REASON = 5

export const checkReason = (reason) => {
  const text = String(reason || '').trim()
  return text.length >= MIN_REASON ? { ok: true, reason: text } : { ok: false, error: `Give a reason of at least ${MIN_REASON} characters` }
}

/** Anyone cashier-side may ask; only a completed payment whose medicine is not yet dispensed can be refunded. */
export function requestBlocker(payment) {
  if (!payment || payment.status !== 'completed') return 'This payment is not refundable (already refunded or not completed)'
  if (payment.prescriptions?.status && payment.prescriptions.status !== 'paid') return 'Medication already dispensed'
  return ''
}

/** 'approved' | 'rejected' | 'pending' for one request, from the payment's current state. */
export function requestOutcome(request, payment) {
  if (!payment) return 'pending'
  if (payment.status === 'refunded') return 'approved'
  const lines = String(payment.notes || '').split(' | ').filter((l) => l.startsWith(REJECT_MARK))
  const requestedAt = new Date(request.created_at).getTime()
  const rejected = lines.some((l) => {
    const m = l.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/)
    return m && new Date(m[1]).getTime() >= requestedAt
  })
  return rejected ? 'rejected' : 'pending'
}

/** Newest request per payment, each with its outcome; pending first, then newest. */
export function buildQueue(requests, payments) {
  const byPayment = new Map((payments || []).map((p) => [p.id, p]))
  const latest = new Map()
  for (const r of requests || []) {
    if (!r.record_id) continue
    const seen = latest.get(r.record_id)
    if (!seen || new Date(r.created_at) > new Date(seen.created_at)) latest.set(r.record_id, r)
  }
  const rows = [...latest.values()].map((request) => ({ request, payment: byPayment.get(request.record_id), outcome: requestOutcome(request, byPayment.get(request.record_id)) }))
  return rows.sort((a, b) => (a.outcome === 'pending' ? 0 : 1) - (b.outcome === 'pending' ? 0 : 1) || new Date(b.request.created_at) - new Date(a.request.created_at))
}
