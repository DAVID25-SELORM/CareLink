import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { logAuditEvent } from '../services/auditLog'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import { ageText, buildChildSchedule, summarizeSchedule } from '../lib/epiSchedule'
import { RECALL_KIND, RECALL_COOLDOWN_DAYS, buildRecallMessage, lastRecallByPatient, recallBlocker, recalledRecently } from '../lib/immunisationRecall'

const TABS = ['Child record', 'Overdue list']
const SITES = ['', 'Left thigh', 'Right thigh', 'Left upper arm', 'Right upper arm', 'Oral']
const today = () => new Date().toISOString().slice(0, 10)

const STATUS_STYLE = {
  given: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  due: 'bg-orange-100 text-orange-800',
  due_soon: 'bg-yellow-100 text-yellow-800',
  upcoming: 'bg-slate-100 text-slate-600',
  too_late: 'bg-slate-200 text-slate-700',
}
const STATUS_LABEL = { given: 'Given', overdue: 'Overdue', due: 'Due now', due_soon: 'Due soon', upcoming: 'Upcoming', too_late: 'Past age limit' }

const yearsOld = (patient) => {
  if (patient.date_of_birth) return (Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 86400000)
  return patient.age != null && patient.age !== '' ? Number(patient.age) : null
}

export default function ChildWelfare() {
  const { user } = useAuth()
  const { branding } = useHospitalBranding()
  const [recalls, setRecalls] = useState(new Map())
  const [texting, setTexting] = useState('')
  const [tab, setTab] = useState(TABS[0])
  const [children, setChildren] = useState([])
  const [allDoses, setAllDoses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [weights, setWeights] = useState([])
  const [weightInput, setWeightInput] = useState('')
  const [dobInput, setDobInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const patientRes = await supabase.from('patients').select('*').order('name').limit(2000)
    if (patientRes.error) toast.error('Could not load patients')
    const kids = (patientRes.data || []).filter((p) => {
      const years = yearsOld(p)
      return years != null && years < 15
    })
    setChildren(kids)
    const ids = kids.map((p) => p.id)
    if (ids.length > 0) {
      const doseRes = await supabase.from('immunizations').select('id, patient_id, vaccine_code, given_date, batch_number, site, notes').in('patient_id', ids.slice(0, 1000))
      if (doseRes.error) toast.error('Could not load immunisation records. Apply migration 031 first.')
      setAllDoses(doseRes.data || [])
    }
    setLoading(false)
  }, [])

  const loadRecalls = useCallback(async () => {
    const { data } = await supabase.from('audit_log').select('record_id, created_at, new_values').eq('action', 'send_sms').order('created_at', { ascending: false }).limit(500)
    setRecalls(lastRecallByPatient(data))
  }, [])

  useEffect(() => { load(); loadRecalls() }, [load, loadRecalls])

  const child = children.find((c) => c.id === selectedId) || null
  const childDoses = useMemo(() => allDoses.filter((d) => d.patient_id === selectedId), [allDoses, selectedId])
  const schedule = useMemo(
    () => (child?.date_of_birth ? buildChildSchedule({ dateOfBirth: child.date_of_birth, given: childDoses }) : []),
    [child, childDoses],
  )
  const summary = summarizeSchedule(schedule)

  const loadWeights = useCallback(async (patientId) => {
    if (!patientId) { setWeights([]); return }
    const { data } = await supabase.from('vitals').select('id, weight_kg, recorded_at').eq('patient_id', patientId).not('weight_kg', 'is', null).order('recorded_at', { ascending: false }).limit(8)
    setWeights(data || [])
  }, [])
  useEffect(() => { loadWeights(selectedId) }, [selectedId, loadWeights])

  const overdueList = useMemo(() => {
    const byChild = new Map()
    for (const d of allDoses) byChild.set(d.patient_id, [...(byChild.get(d.patient_id) || []), d])
    return children
      .filter((c) => c.date_of_birth && yearsOld(c) < 5)
      .map((c) => {
        const rows = buildChildSchedule({ dateOfBirth: c.date_of_birth, given: byChild.get(c.id) || [] })
        return { child: c, overdue: rows.filter((r) => r.status === 'overdue') }
      })
      .filter((x) => x.overdue.length > 0)
      .sort((a, b) => b.overdue.length - a.overdue.length)
  }, [children, allDoses])

  // One recall text. Consent and the phone number are enforced again by the send-sms function.
  const sendRecall = async (c) => {
    const message = buildRecallMessage({ childName: c.name, hospital: branding?.hospitalName })
    const { data, error } = await supabase.functions.invoke('send-sms', { body: { patient_id: c.id, message } })
    if (error || data?.status !== 'sent') {
      let reason = data?.error
      if (!reason && error?.context?.json) reason = (await error.context.json().catch(() => null))?.error
      throw new Error(reason || error?.message || 'The SMS service is not available')
    }
    await logAuditEvent({ user, action: 'send_sms', tableName: 'patients', recordId: c.id, newValues: { status: 'sent', kind: RECALL_KIND, length: message.length } })
    setRecalls((prev) => new Map(prev).set(c.id, Date.now()))
  }

  const recallOne = async (c) => {
    if (recalledRecently(recalls.get(c.id)) && !window.confirm(`${c.name} was already texted in the last ${RECALL_COOLDOWN_DAYS} days. Send another?`)) return
    setTexting(c.id)
    try { await sendRecall(c); toast.success(`Recall sent for ${c.name}`) } catch (e) { toast.error(e.message) } finally { setTexting('') }
  }

  const recallAll = async () => {
    const targets = overdueList.map((x) => x.child).filter((c) => !recallBlocker(c) && !recalledRecently(recalls.get(c.id)))
    if (targets.length === 0) { toast.info('Nobody to text: everyone is either without consent or phone, or was texted recently'); return }
    if (!window.confirm(`Send a recall SMS to ${targets.length} guardian(s)? Children texted in the last ${RECALL_COOLDOWN_DAYS} days are skipped.`)) return
    setTexting('all')
    let sent = 0
    let failed = 0
    for (const c of targets) {
      try { await sendRecall(c); sent += 1 } catch { failed += 1 }
    }
    setTexting('')
    toast[failed ? 'warn' : 'success'](`${sent} sent, ${failed} failed`)
  }

  const saveDose = async (event) => {
    event.preventDefault()
    if (!child || !form) return
    if (form.given_date > today()) { toast.error('The date given cannot be in the future'); return }
    if (form.given_date < child.date_of_birth) { toast.error('The date given is before the birth date'); return }
    setSaving(true)
    const row = {
      patient_id: child.id,
      vaccine_code: form.code,
      given_date: form.given_date,
      batch_number: form.batch_number.trim() || null,
      site: form.site || null,
      notes: form.notes.trim() || null,
      given_by: user?.id || null,
    }
    const { data, error } = await supabase.from('immunizations').insert([row]).select().single()
    setSaving(false)
    if (error) {
      toast.error(error.code === '23505' ? 'This dose is already recorded' : 'Could not save the dose. Is migration 031 applied?')
      return
    }
    await logAuditEvent({ user, action: 'record_immunization', tableName: 'immunizations', recordId: data.id, newValues: { patient_id: child.id, vaccine_code: form.code, given_date: form.given_date, batch_number: row.batch_number } })
    toast.success(`${form.label} recorded`)
    setAllDoses((prev) => [...prev, data])
    setForm(null)
  }

  const saveDob = async () => {
    if (!dobInput || dobInput > today()) { toast.error('Enter a valid birth date'); return }
    const { error } = await supabase.from('patients').update({ date_of_birth: dobInput }).eq('id', child.id)
    if (error) { toast.error('Could not save the birth date. Apply migration 009 if the column is missing.'); return }
    await logAuditEvent({ user, action: 'update_patient', tableName: 'patients', recordId: child.id, newValues: { date_of_birth: dobInput } })
    setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, date_of_birth: dobInput } : c)))
    setDobInput('')
  }

  const saveWeight = async (event) => {
    event.preventDefault()
    const kg = Number(weightInput)
    if (!child || !(kg > 0 && kg < 150)) { toast.error('Enter a weight in kg'); return }
    const { error } = await supabase.from('vitals').insert([{ patient_id: child.id, recorded_by: user?.id, weight_kg: kg }])
    if (error) { toast.error('Could not save the weight'); return }
    await logAuditEvent({ user, action: 'record_weight', tableName: 'vitals', recordId: child.id, newValues: { weight_kg: kg } })
    setWeightInput('')
    loadWeights(child.id)
    toast.success('Weight recorded')
  }

  const openDose = (row) => setForm({ code: row.code, label: row.label, given_date: today(), batch_number: '', site: '', notes: '' })

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Child Welfare and Immunisation</h2>
          <p className="text-sm text-slate-500 mt-0.5">Ghana routine schedule (GHS). Confirm the schedule with your immunisation lead before relying on it.</p>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t}{t === 'Overdue list' && overdueList.length > 0 ? ` (${overdueList.length})` : ''}
            </button>
          ))}
        </div>

        {tab === 'Child record' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <label htmlFor="child" className="block text-xs font-medium text-slate-600 mb-1">Child (patients under 15)</label>
              <select id="child" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setForm(null) }} disabled={loading} className="w-full sm:w-96 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select a child...</option>
                {children.map((c) => <option key={c.id} value={c.id}>{c.name}{c.date_of_birth ? '' : ' (no birth date)'}</option>)}
              </select>
              {!loading && children.length === 0 && <p className="text-sm text-slate-500 mt-2">No patients under 15 found. Register the child with a birth date first.</p>}
            </div>

            {child && !child.date_of_birth && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-2">
                <p>A birth date is needed to work out the schedule.</p>
                <div className="flex gap-2">
                  <input type="date" aria-label="Birth date" value={dobInput} max={today()} onChange={(e) => setDobInput(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
                  <button type="button" onClick={saveDob} className="px-3 py-1 bg-indigo-600 text-white rounded">Save birth date</button>
                </div>
              </div>
            )}

            {child && child.date_of_birth && (
              <>
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-6 text-sm">
                  <div><p className="text-xs text-slate-400 uppercase">Child</p><p className="font-medium">{child.name}</p></div>
                  <div><p className="text-xs text-slate-400 uppercase">Age</p><p className="font-medium">{ageText(child.date_of_birth)}</p></div>
                  <div><p className="text-xs text-slate-400 uppercase">Guardian phone</p><p className="font-medium">{child.phone || child.emergency_phone || '-'}</p></div>
                  <div><p className="text-xs text-slate-400 uppercase">Given</p><p className="font-medium text-green-700">{summary.given}</p></div>
                  <div><p className="text-xs text-slate-400 uppercase">Due</p><p className="font-medium text-orange-700">{summary.due}</p></div>
                  <div><p className="text-xs text-slate-400 uppercase">Overdue</p><p className="font-medium text-red-700">{summary.overdue}</p></div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>{['Vaccine', 'Due date', 'Status', 'Given on', ''].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((row) => (
                        <tr key={row.code}>
                          <td className="px-4 py-2">{row.label}</td>
                          <td className="px-4 py-2 text-slate-500">{row.dueDate}</td>
                          <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[row.status]}`}>{STATUS_LABEL[row.status]}</span></td>
                          <td className="px-4 py-2 text-slate-500">{row.givenDate || ''}</td>
                          <td className="px-4 py-2">
                            {row.status !== 'given' && row.status !== 'too_late' && (
                              <button type="button" onClick={() => openDose(row)} className="text-indigo-600 underline text-xs">Record dose</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {form && (
                  <form onSubmit={saveDose} className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3 max-w-xl">
                    <h3 className="font-semibold text-slate-900">Record: {form.label}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-xs text-slate-600">Date given
                        <input type="date" value={form.given_date} max={today()} onChange={(e) => setForm({ ...form, given_date: e.target.value })} className="mt-1 w-full border border-slate-200 rounded px-2 py-1.5 text-sm" required />
                      </label>
                      <label className="text-xs text-slate-600">Batch number
                        <input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} className="mt-1 w-full border border-slate-200 rounded px-2 py-1.5 text-sm" />
                      </label>
                      <label className="text-xs text-slate-600">Site
                        <select value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className="mt-1 w-full border border-slate-200 rounded px-2 py-1.5 text-sm">
                          {SITES.map((s) => <option key={s} value={s}>{s || 'Not recorded'}</option>)}
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">Notes (e.g. reaction)
                        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full border border-slate-200 rounded px-2 py-1.5 text-sm" />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save dose'}</button>
                      <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Cancel</button>
                    </div>
                  </form>
                )}

                <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-xl space-y-3">
                  <h3 className="font-semibold text-slate-900">Weight</h3>
                  <form onSubmit={saveWeight} className="flex gap-2">
                    <input type="number" step="0.1" min="0" placeholder="Weight in kg" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="border border-slate-200 rounded px-2 py-1.5 text-sm" />
                    <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded">Record</button>
                  </form>
                  {weights.length === 0 ? <p className="text-xs text-slate-500">No weights recorded.</p> : (
                    <ul className="text-sm divide-y divide-slate-100">
                      {weights.map((w, i) => {
                        const next = weights[i + 1]
                        const change = next ? Number(w.weight_kg) - Number(next.weight_kg) : null
                        return (
                          <li key={w.id} className="py-1 flex justify-between">
                            <span>{new Date(w.recorded_at).toLocaleDateString('en-GB')}</span>
                            <span>{w.weight_kg} kg {change !== null && <span className={change < 0 ? 'text-red-600' : 'text-slate-400'}>({change > 0 ? '+' : ''}{change.toFixed(1)})</span>}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {weights.length >= 2 && Number(weights[0].weight_kg) < Number(weights[1].weight_kg) && (
                    <p role="alert" className="text-xs text-red-700">Weight has dropped since the last visit. Assess the child and refer if needed.</p>
                  )}
                  <p className="text-xs text-slate-400">Growth-chart scoring (weight-for-age) is not built in; use the child health record card.</p>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'Overdue list' && (
          <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">The text asks the guardian to bring the child in. It never names vaccines. Only guardians who agreed to SMS can be texted.</p>
            <button type="button" onClick={recallAll} disabled={texting !== '' || overdueList.length === 0} className="shrink-0 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-50">{texting === 'all' ? 'Sending...' : 'Text all eligible'}</button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Child', 'Age', 'Phone', 'Overdue vaccines', 'Recall'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdueList.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">{loading ? 'Loading...' : 'No children under 5 with overdue doses'}</td></tr>}
                {overdueList.map(({ child: c, overdue }) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3"><button type="button" className="text-indigo-600 underline" onClick={() => { setSelectedId(c.id); setTab(TABS[0]) }}>{c.name}</button></td>
                    <td className="px-4 py-3 text-slate-600">{ageText(c.date_of_birth)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || c.emergency_phone || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{overdue.map((o) => o.label).join(', ')}</td>
                    <td className="px-4 py-3 text-xs">
                      {recallBlocker(c) ? <span className="text-slate-400">{recallBlocker(c)}</span> : (
                        <div className="space-y-1">
                          <button type="button" onClick={() => recallOne(c)} disabled={texting !== ''} className="text-indigo-600 underline disabled:opacity-50">{texting === c.id ? 'Sending...' : 'Send SMS'}</button>
                          {recalls.get(c.id) && <p className="text-slate-400">Last texted {new Date(recalls.get(c.id)).toLocaleDateString('en-GB')}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
