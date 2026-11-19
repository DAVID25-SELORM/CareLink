import { supabase } from '../supabaseClient'
import { logAuditEvent } from './auditLog'
import { REFUND_REQUEST, REJECT_MARK } from '../lib/refunds'

const today = () => new Date().toISOString().slice(0, 10)
const appendNote = (notes, line) => [notes, line].filter(Boolean).join(' | ')

/** A cashier (or anyone on the cashier screen) asks an administrator to approve a refund. */
export async function requestRefund({ payment, reason, user }) {
  await logAuditEvent({ user, action: REFUND_REQUEST, tableName: 'payments', recordId: payment.id, newValues: { amount: payment.amount, method: payment.payment_method, reference: payment.transaction_reference || null, reason } })
}

/** Administrator action: mark refunded and return the prescription to pending. Throws on any failure. */
export async function executeRefund({ payment, reason, user, requestedBy = null }) {
  const note = appendNote(payment.notes, `REFUND ${today()} by ${user?.email || 'admin'}: ${reason}`)
  const { data, error } = await supabase.from('payments').update({ status: 'refunded', notes: note }).eq('id', payment.id).eq('status', 'completed').select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('This payment was already refunded or changed. Reload and check.')
  if (payment.prescription_id) {
    const { error: rxError } = await supabase.from('prescriptions').update({ status: 'pending' }).eq('id', payment.prescription_id).eq('status', 'paid')
    if (rxError) throw rxError
  }
  await logAuditEvent({ user, action: 'refund_payment', tableName: 'payments', recordId: payment.id, newValues: { amount: payment.amount, method: payment.payment_method, reference: payment.transaction_reference || null, reason, requested_by: requestedBy } })
}

/** Administrator action: decline a request. The reason is kept on the payment so the cashier can see the outcome. */
export async function rejectRefund({ payment, reason, user }) {
  const note = appendNote(payment.notes, `${REJECT_MARK} ${new Date().toISOString()} by ${user?.email || 'admin'}: ${reason}`)
  const { error } = await supabase.from('payments').update({ notes: note }).eq('id', payment.id).eq('status', 'completed')
  if (error) throw error
  await logAuditEvent({ user, action: 'refund_reject', tableName: 'payments', recordId: payment.id, newValues: { amount: payment.amount, reason } })
}
