import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { MANUAL_ITEMS, MIN_ROLES, evaluateReadiness } from '../lib/goLive'

const STORE = 'carelink-golive-manual'
const readManual = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') } catch { return {} } }

const count = async (table, build) => {
  let q = supabase.from(table).select('id', { count: 'exact', head: true })
  if (build) q = build(q)
  const { count: n, error } = await q
  return error ? 0 : n || 0
}

export default function GoLiveChecklist() {
  const [counts, setCounts] = useState(null)
  const [manual, setManual] = useState(readManual)

  const load = useCallback(async () => {
    const [profile, drugs, batches, fees, patients, smsSent, dayCloses, ...roleCounts] = await Promise.all([
      supabase.from('hospital_profile').select('hospital_name, contact_phone, contact_email').eq('singleton_key', true).maybeSingle().then((r) => r.data),
      count('drugs'), count('drug_batches'), count('service_fees'), count('patients'),
      count('audit_log', (q) => q.eq('action', 'send_sms')),
      count('audit_log', (q) => q.eq('action', 'day_close')),
      ...MIN_ROLES.map(([role]) => count('users', (q) => q.eq('role', role))),
    ])
    setCounts({ profile, drugs, batches, fees, patients, smsSent, dayCloses, roles: Object.fromEntries(MIN_ROLES.map(([role], i) => [role, roleCounts[i]])) })
  }, [])
  useEffect(() => { load() }, [load])

  const items = useMemo(() => (counts ? evaluateReadiness(counts) : []), [counts])
  const toggle = (id) => {
    const next = { ...manual, [id]: !manual[id] }
    setManual(next)
    try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* private window: ticks stay on this page only */ }
  }
  const autoDone = items.filter((i) => i.ok).length
  const manualDone = MANUAL_ITEMS.filter(([id]) => manual[id]).length

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Go-live Checklist</h2>
          <p className="text-sm text-slate-500 mt-0.5">Check these before real patients are registered. The first list is read from your own data; the second needs a person to confirm.</p>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Set up in the system ({counts ? `${autoDone} of ${items.length}` : '...'})</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {items.map((i) => (
              <li key={i.id} className="py-2 flex items-start gap-3">
                <span aria-hidden="true" className={i.ok ? 'text-green-600' : 'text-red-600'}>{i.ok ? '✔' : '✖'}</span>
                <div className="flex-1">
                  <p className="text-slate-800">{i.label}<span className="sr-only">{i.ok ? ' - done' : ' - not done'}</span></p>
                  {!i.ok && i.hint && <p className="text-xs text-slate-500">{i.hint}</p>}
                </div>
                {!i.ok && <Link to={i.to} className="text-xs text-indigo-600 underline">Open</Link>}
              </li>
            ))}
          </ul>
          <button type="button" onClick={load} className="mt-3 text-xs text-indigo-600 underline">Check again</button>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Needs a person to confirm ({manualDone} of {MANUAL_ITEMS.length})</h3>
          <p className="text-xs text-slate-400 mb-3">Ticks are saved in this browser only, as a personal reminder. Keep the signed record on paper.</p>
          <ul className="space-y-2 text-sm">
            {MANUAL_ITEMS.map(([id, label]) => (
              <li key={id}><label className="flex items-start gap-2"><input type="checkbox" checked={Boolean(manual[id])} onChange={() => toggle(id)} className="mt-1" /><span>{label}</span></label></li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardLayout>
  )
}
