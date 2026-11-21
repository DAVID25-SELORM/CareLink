import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import { buildQueue, checkReason, REFUND_REQUEST } from '../lib/refunds'
import { executeRefund, rejectRefund } from '../services/refundService'

const STYLE = { pending: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800' }

export default function RefundRequests({ user, isAdmin, onChanged }) {
  const [requests, setRequests] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: reqs, error } = await supabase.from('audit_log').select('id, created_at, user_email, record_id, new_values').eq('action', REFUND_REQUEST).order('created_at', { ascending: false }).limit(200)
    if (error) toast.error('Could not load refund requests')
    const ids = [...new Set((reqs || []).map((r) => r.record_id).filter(Boolean))]
    let pays = []
    if (ids.length > 0) {
      const res = await supabase.from('payments').select('id, amount, payment_method, transaction_reference, status, notes, prescription_id, created_at, patients(name), prescriptions(status)').in('id', ids)
      pays = res.data || []
    }
    setRequests(reqs || [])
    setPayments(pays)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const queue = useMemo(() => buildQueue(requests, payments), [requests, payments])

  const act = async (row, kind) => {
    const answer = window.prompt(kind === 'approve' ? `Approve the refund of GH₵ ${Number(row.payment.amount).toFixed(2)} to ${row.payment.patients?.name || 'the patient'}? Add a note (optional):` : 'Reason for declining this request:')
    if (answer === null) return
    let reason = answer.trim()
    if (kind === 'reject') {
      const check = checkReason(answer)
      if (!check.ok) { toast.error(check.error); return }
      reason = check.reason
    }
    setBusy(row.request.id)
    try {
      if (kind === 'approve') {
        await executeRefund({ payment: row.payment, reason: [row.request.new_values?.reason, reason].filter(Boolean).join(' / '), user, requestedBy: row.request.user_email })
        toast.success('Refund approved. Hand the money back and keep the reason on file.')
      } else {
        await rejectRefund({ payment: row.payment, reason, user })
        toast.success('Request declined')
      }
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(e.message || 'Could not complete this action')
    } finally { setBusy('') }
  }

  return (
    <div className="bg-white rounded-xl shadow-soft overflow-hidden border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="text-lg font-semibold text-slate-800">Refund requests</h3>
        <p className="text-xs text-slate-500 mt-0.5">{isAdmin ? 'Approve or decline requests from cashiers. Approving marks the payment refunded and returns the prescription to Pending.' : 'Your requests and what the administrator decided.'}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50"><tr>{['Requested', 'By', 'Patient', 'Amount', 'Reason', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {queue.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-slate-400">{loading ? 'Loading...' : 'No refund requests'}</td></tr>}
            {queue.map((row) => (
              <tr key={row.request.id}>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(row.request.created_at).toLocaleString('en-GB')}</td>
                <td className="px-4 py-3 text-slate-700">{row.request.user_email || '-'}</td>
                <td className="px-4 py-3 text-slate-700">{row.payment?.patients?.name || '-'}</td>
                <td className="px-4 py-3">GH₵ {Number(row.payment?.amount ?? row.request.new_values?.amount ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{row.request.new_values?.reason}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STYLE[row.outcome]}`}>{row.outcome}</span></td>
                <td className="px-4 py-3">
                  {isAdmin && row.outcome === 'pending' && row.payment && (
                    <div className="flex gap-3">
                      <button type="button" disabled={busy !== ''} onClick={() => act(row, 'approve')} className="text-xs text-green-700 underline disabled:opacity-50">Approve</button>
                      <button type="button" disabled={busy !== ''} onClick={() => act(row, 'reject')} className="text-xs text-red-700 underline disabled:opacity-50">Decline</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
