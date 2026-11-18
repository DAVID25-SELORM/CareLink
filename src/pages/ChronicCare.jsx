import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { logAuditEvent } from '../services/auditLog'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import { COOLDOWN_DAYS, DEFAULT_OVERDUE_DAYS, RECALL_KIND, buildChronicRecallMessage, overdueChronicPatients } from '../lib/chronicCare'
import { lastRecallByPatient, recallBlocker, recalledRecently } from '../lib/immunisationRecall'
import { downloadCsv } from '../lib/csvExport'

export default function ChronicCare() {
  const { user } = useAuth()
  const { branding } = useHospitalBranding()
  const [days, setDays] = useState(DEFAULT_OVERDUE_DAYS)
  const [diagnoses, setDiagnoses] = useState([])
  const [lastSeen, setLastSeen] = useState(new Map())
  const [patients, setPatients] = useState(new Map())
  const [recalls, setRecalls] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [texting, setTexting] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [dx, enc, audit] = await Promise.all([
      supabase.from('diagnoses').select('patient_id, icd10_code, icd10_description, is_chronic, resolved_date, certainty').is('resolved_date', null).limit(10000),
      supabase.from('encounters').select('patient_id, started_at, created_at').order('created_at', { ascending: false }).limit(20000),
      supabase.from('audit_log').select('record_id, created_at, new_values').eq('action', 'send_sms').order('created_at', { ascending: false }).limit(500),
    ])
    if (dx.error) toast.error('Could not load diagnoses')
    const seen = new Map()
    for (const e of enc.data || []) {
      const at = new Date(e.started_at || e.created_at).getTime()
      if (at > (seen.get(e.patient_id) || 0)) seen.set(e.patient_id, at)
    }
    setDiagnoses(dx.data || [])
    setLastSeen(seen)
    setRecalls(lastRecallByPatient(audit.data, RECALL_KIND))
    const ids = [...new Set((dx.data || []).map((d) => d.patient_id))]
    const map = new Map()
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from('patients').select('id, name, phone, consent_sms, patient_id').in('id', ids.slice(i, i + 200))
      for (const p of data || []) map.set(p.id, p)
    }
    setPatients(map)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const rows = useMemo(
    () => overdueChronicPatients({ diagnoses, lastSeen, days }).map((r) => ({ ...r, patient: patients.get(r.patientId) })).filter((r) => r.patient),
    [diagnoses, lastSeen, patients, days],
  )

  const sendRecall = async (p) => {
    const message = buildChronicRecallMessage({ name: p.name, hospital: branding?.hospitalName })
    const { data, error } = await supabase.functions.invoke('send-sms', { body: { patient_id: p.id, message } })
    if (error || data?.status !== 'sent') {
      let reason = data?.error
      if (!reason && error?.context?.json) reason = (await error.context.json().catch(() => null))?.error
      throw new Error(reason || error?.message || 'The SMS service is not available')
    }
    await logAuditEvent({ user, action: 'send_sms', tableName: 'patients', recordId: p.id, newValues: { status: 'sent', kind: RECALL_KIND, length: message.length } })
    setRecalls((prev) => new Map(prev).set(p.id, Date.now()))
  }

  const recallOne = async (p) => {
    if (recalledRecently(recalls.get(p.id), Date.now(), COOLDOWN_DAYS) && !window.confirm(`${p.name} was already texted in the last ${COOLDOWN_DAYS} days. Send another?`)) return
    setTexting(p.id)
    try { await sendRecall(p); toast.success(`Reminder sent to ${p.name}`) } catch (e) { toast.error(e.message) } finally { setTexting('') }
  }

  const exportCsv = () => downloadCsv(`chronic-care-follow-up-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: 'Patient', value: (r) => r.patient.name },
    { label: 'Patient ID', value: (r) => r.patient.patient_id },
    { label: 'Phone', value: (r) => r.patient.phone },
    { label: 'Conditions', value: (r) => r.conditions.join('; ') },
    { label: 'Days since last visit', value: (r) => (r.daysSince ?? 'never seen') },
    { label: 'SMS consent', value: (r) => (r.patient.consent_sms === true ? 'yes' : 'no') },
  ], rows)

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Chronic Care Follow-up</h2>
          <p className="text-sm text-slate-500 mt-0.5">Patients with hypertension, diabetes, asthma, COPD, epilepsy, sickle cell, kidney disease or heart failure (or a diagnosis flagged chronic) who have not had a visit recently. HIV is not included; follow it up through your confidential process.</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm text-slate-700">Not seen for more than
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-2 border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
              {[30, 60, 90, 120, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
          <button type="button" onClick={exportCsv} disabled={rows.length === 0} className="px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-50">Export CSV</button>
          <p className="text-xs text-slate-500">{loading ? 'Loading...' : `${rows.length} patient(s)`}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{['Patient', 'Conditions', 'Last visit', 'Phone', 'Reminder'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">{loading ? 'Loading...' : 'Nobody is overdue'}</td></tr>}
              {rows.map((r) => (
                <tr key={r.patientId}>
                  <td className="px-4 py-3"><Link className="text-indigo-600 underline" to={`/patients/${r.patientId}`}>{r.patient.name}</Link></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{r.conditions.join(', ')}</td>
                  <td className="px-4 py-3 text-slate-600">{r.daysSince === null ? 'No visit on record' : `${r.daysSince} days ago`}</td>
                  <td className="px-4 py-3 text-slate-600">{r.patient.phone || '-'}</td>
                  <td className="px-4 py-3 text-xs">
                    {recallBlocker(r.patient) ? <span className="text-slate-400">{recallBlocker(r.patient)}</span> : (
                      <div className="space-y-1">
                        <button type="button" onClick={() => recallOne(r.patient)} disabled={texting !== ''} className="text-indigo-600 underline disabled:opacity-50">{texting === r.patientId ? 'Sending...' : 'Send SMS'}</button>
                        {recalls.get(r.patientId) && <p className="text-slate-400">Last texted {new Date(recalls.get(r.patientId)).toLocaleDateString('en-GB')}</p>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">The reminder never names the condition. The list and the interval need sign-off from your clinical lead.</p>
      </div>
    </DashboardLayout>
  )
}
