import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { logAuditEvent } from '../services/auditLog'
import { useHospitalBranding } from '../hooks/useHospitalBranding'

const TABS = ['Send SMS', 'Sent log', 'Gateway']
const MAX_LENGTH = 320

// Starting points staff can edit. Placeholders are filled in on this screen before sending.
const QUICK_MESSAGES = [
  { value: 'custom', label: 'Custom message', text: '' },
  { value: 'lab_result_ready', label: 'Lab result ready', text: 'Dear {{name}}, your test results are ready at {{hospital}}. Please come in to collect them.' },
  { value: 'prescription_ready', label: 'Prescription ready', text: 'Dear {{name}}, your medication is ready for collection at the {{hospital}} pharmacy.' },
  { value: 'follow_up', label: 'Follow-up visit', text: 'Dear {{name}}, please return to {{hospital}} for your follow-up visit. Call us to book a time.' },
]

export const fillMessage = (text, { name, hospital }) =>
  String(text || '')
    .replaceAll('{{name}}', String(name || 'Patient').trim().split(/\s+/)[0])
    .replaceAll('{{hospital}}', hospital || 'the hospital')

const smsUnits = (length) => (length === 0 ? 0 : length <= 160 ? 1 : Math.ceil(length / 153))

export default function NotificationSettings() {
  const { user } = useAuth()
  const { branding } = useHospitalBranding()
  const [activeTab, setActiveTab] = useState('Send SMS')
  const [patients, setPatients] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ patient_id: '', kind: 'custom', message: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [patientRes, logRes] = await Promise.all([
      supabase.from('patients').select('id, name, phone, consent_sms').order('name').limit(500),
      supabase
        .from('audit_log')
        .select('id, created_at, user_email, action, record_id, new_values')
        .in('action', ['send_sms', 'send_appointment_reminders'])
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (patientRes.error) toast.error('Could not load patients. If this keeps happening, apply migration 029.')
    setPatients(patientRes.data || [])
    setEntries(logRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const patient = patients.find((p) => p.id === form.patient_id)
  const message = form.message
  const canSend = Boolean(patient) && patient.consent_sms === true && message.trim().length > 0 && message.length <= MAX_LENGTH

  const chooseKind = (kind) => {
    const quick = QUICK_MESSAGES.find((q) => q.value === kind)
    setForm((f) => ({
      ...f,
      kind,
      message: quick?.text ? fillMessage(quick.text, { name: patient?.name, hospital: branding?.hospitalName }) : f.message,
    }))
  }

  const choosePatient = (id) => {
    const next = patients.find((p) => p.id === id)
    const quick = QUICK_MESSAGES.find((q) => q.value === form.kind)
    setForm((f) => ({
      ...f,
      patient_id: id,
      message: quick?.text ? fillMessage(quick.text, { name: next?.name, hospital: branding?.hospitalName }) : f.message,
    }))
  }

  const send = async (event) => {
    event.preventDefault()
    if (!canSend) return
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', { body: { patient_id: patient.id, message } })
      if (error || data?.status !== 'sent') {
        let reason = data?.error
        if (!reason && error?.context?.json) reason = (await error.context.json().catch(() => null))?.error
        throw new Error(reason || error?.message || 'The SMS service is not available')
      }
      // The audit entry records who texted whom and how long it was, not the message text.
      await logAuditEvent({ user, action: 'send_sms', tableName: 'patients', recordId: patient.id, newValues: { status: 'sent', kind: form.kind, length: message.length } })
      toast.success(`SMS sent to ${patient.name}`)
      setForm({ patient_id: '', kind: 'custom', message: '' })
      load()
    } catch (error) {
      toast.error(error.message || 'Could not send the SMS')
    } finally {
      setSending(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">SMS</h2>
          <p className="text-sm text-slate-500 mt-0.5">Send a text to a patient who agreed to SMS. Appointment reminders are sent from the Appointments page.</p>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Send SMS' && (
          <form onSubmit={send} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl space-y-4">
            <div>
              <label htmlFor="sms-patient" className="block text-xs font-medium text-slate-600 mb-1">Patient</label>
              <select id="sms-patient" value={form.patient_id} onChange={(e) => choosePatient(e.target.value)} disabled={loading} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select a patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.consent_sms === true ? '' : ' (no SMS consent)'}</option>
                ))}
              </select>
              {patient && patient.consent_sms !== true && (
                <p role="alert" className="text-xs text-red-600 mt-1">This patient has not agreed to SMS. Tick &quot;Agrees to SMS reminders&quot; on their patient page first.</p>
              )}
              {patient && patient.consent_sms === true && <p className="text-xs text-slate-500 mt-1">The number on the patient record will be used.</p>}
            </div>
            <div>
              <label htmlFor="sms-kind" className="block text-xs font-medium text-slate-600 mb-1">Message type</label>
              <select id="sms-kind" value={form.kind} onChange={(e) => chooseKind(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {QUICK_MESSAGES.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sms-message" className="block text-xs font-medium text-slate-600 mb-1">Message</label>
              <textarea id="sms-message" value={message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={4} maxLength={MAX_LENGTH}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Type the message. Do not include diagnoses or results." />
              <p className="text-xs text-slate-400 mt-1">{message.length} / {MAX_LENGTH} characters ({smsUnits(message.length)} SMS unit{smsUnits(message.length) === 1 ? '' : 's'}). Keep clinical details out of texts.</p>
            </div>
            <button type="submit" disabled={!canSend || sending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {sending ? 'Sending...' : 'Send SMS'}
            </button>
          </form>
        )}

        {activeTab === 'Sent log' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['When', 'By', 'What', 'Detail'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-slate-400">Nothing sent yet</td></tr>}
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700">{e.user_email || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{e.action === 'send_sms' ? 'Single SMS' : 'Appointment reminders'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {e.action === 'send_sms'
                        ? `${e.new_values?.kind || 'custom'}, ${e.new_values?.length || 0} characters`
                        : `${e.new_values?.sent ?? 0} sent for ${e.new_values?.date || ''}, ${e.new_values?.failed ?? 0} failed`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Gateway' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl space-y-3 text-sm text-slate-700">
            <h3 className="font-semibold text-slate-900">SMS gateway</h3>
            <p>
              SMS provider keys are <strong>not stored in this app</strong> and cannot be entered here. They are set once on the
              server by whoever runs CareLink, so nobody can read them from a browser.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-600">
              <li>Open an account with an SMS provider (Arkesel is supported) and register a sender name.</li>
              <li>The CareLink operator sets the secrets <code>SMS_API_KEY</code> and <code>SMS_SENDER_ID</code> and deploys the <code>send-sms</code> and <code>send-appointment-reminders</code> functions.</li>
              <li>Send one test message to your own phone before using it with patients.</li>
            </ol>
            <p className="text-xs text-slate-500">WhatsApp messaging is not available yet.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
