import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'
import { checkDayClose, summarizeDay } from '../lib/dayClose'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const label = (key) => (key.startsWith('momo:') ? `Mobile money (${key.slice(5).toUpperCase()})` : key.toUpperCase())

export default function DayClose({ user }) {
  const [date, setDate] = useState(todayKey())
  const [payments, setPayments] = useState([])
  const [closed, setClosed] = useState([])
  const [loading, setLoading] = useState(true)
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const start = new Date(`${date}T00:00:00`)
    const end = new Date(start.getTime() + 86400000)
    const [pay, audit] = await Promise.all([
      supabase.from('payments').select('id, amount, payment_method, momo_provider, status, created_at').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).limit(5000),
      supabase.from('audit_log').select('id, created_at, user_email, new_values').eq('action', 'day_close').order('created_at', { ascending: false }).limit(60),
    ])
    if (pay.error) toast.error('Could not load payments')
    setPayments(pay.data || [])
    setClosed(audit.data || [])
    setLoading(false)
  }, [date])
  useEffect(() => { load() }, [load])

  const summary = useMemo(() => summarizeDay(payments, date), [payments, date])
  const already = closed.filter((c) => c.new_values?.date === date)

  const close = async (event) => {
    event.preventDefault()
    const check = checkDayClose({ expectedCash: summary.cashExpected, countedCash: counted, note })
    if (!check.ok) { toast.error(check.error); return }
    if (already.length > 0 && !window.confirm('This day was already closed. Record another close?')) return
    setSaving(true)
    await logAuditEvent({
      user, action: 'day_close', tableName: 'payments', recordId: null,
      newValues: { date, payments: summary.count, total: summary.total, by_method: summary.byMethod, cash_expected: summary.cashExpected, cash_counted: check.counted, variance: check.variance, refunded_total: summary.refundedTotal, note: note.trim() || null },
    })
    setSaving(false)
    toast.success(check.variance === 0 ? 'Day closed, cash balanced' : `Day closed with a difference of GH₵ ${check.variance.toFixed(2)}`)
    setCounted('')
    setNote('')
    load()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <label className="text-sm text-slate-700">Day
            <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={() => window.print()} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">Print</button>
        </div>
        {loading ? <p className="text-sm text-slate-500">Loading...</p> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-slate-400 uppercase">Payments</p><p className="font-semibold">{summary.count}</p></div>
              <div><p className="text-xs text-slate-400 uppercase">Total taken</p><p className="font-semibold">GH₵ {summary.total.toFixed(2)}</p></div>
              <div><p className="text-xs text-slate-400 uppercase">Cash expected</p><p className="font-semibold">GH₵ {summary.cashExpected.toFixed(2)}</p></div>
              <div><p className="text-xs text-slate-400 uppercase">Refunded</p><p className="font-semibold text-red-700">{summary.refundedCount} (GH₵ {summary.refundedTotal.toFixed(2)})</p></div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 uppercase"><th className="py-1">Method</th><th className="py-1 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {Object.keys(summary.byMethod).length === 0 && <tr><td colSpan={2} className="py-4 text-slate-400">No payments on this day</td></tr>}
                {Object.entries(summary.byMethod).map(([k, v]) => <tr key={k}><td className="py-1.5">{label(k)}</td><td className="py-1.5 text-right">GH₵ {v.toFixed(2)}</td></tr>)}
              </tbody>
            </table>
          </>
        )}
      </div>

      <form onSubmit={close} className="bg-white rounded-xl border border-slate-100 p-5 space-y-3 print:hidden">
        <h3 className="font-semibold text-slate-800">Close the day</h3>
        <p className="text-xs text-slate-500">Count the cash in the till and enter it. Mobile money and card totals should be checked against the wallet or terminal statement.</p>
        <label className="block text-sm text-slate-700">Cash counted (GH₵)
          <input type="number" step="0.01" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} className="mt-1 block w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        {counted !== '' && <p className="text-sm">Difference: <strong className={Number(counted) === summary.cashExpected ? 'text-green-700' : 'text-red-700'}>GH₵ {(Number(counted) - summary.cashExpected).toFixed(2)}</strong></p>}
        <label className="block text-sm text-slate-700">Note (required if there is a difference)
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <button type="submit" disabled={saving || loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Record day close'}</button>
      </form>

      <div className="bg-white rounded-xl border border-slate-100 p-5 print:hidden">
        <h3 className="font-semibold text-slate-800 mb-2">Recent closes</h3>
        {closed.length === 0 ? <p className="text-sm text-slate-400">None yet</p> : (
          <ul className="text-sm divide-y divide-slate-100">
            {closed.slice(0, 15).map((c) => (
              <li key={c.id} className="py-1.5 flex justify-between gap-3">
                <span>{c.new_values?.date} by {c.user_email || '-'}</span>
                <span className={Number(c.new_values?.variance) === 0 ? 'text-green-700' : 'text-red-700'}>total GH₵ {Number(c.new_values?.total || 0).toFixed(2)}, difference {Number(c.new_values?.variance || 0).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
