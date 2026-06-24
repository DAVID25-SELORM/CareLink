import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'

const TABS = ['Send Notification', 'Templates', 'Logs', 'Settings']

const EVENT_TYPES = [
  { value: 'appointment_reminder', label: 'Appointment Reminder' },
  { value: 'lab_result_ready', label: 'Lab Result Ready' },
  { value: 'discharge_notice', label: 'Discharge Notice' },
  { value: 'payment_receipt', label: 'Payment Receipt' },
  { value: 'prescription_ready', label: 'Prescription Ready' },
  { value: 'custom', label: 'Custom Message' },
]

const CHANNELS = ['SMS', 'WhatsApp', 'Both']

export default function NotificationSettings() {
  const { user } = useAuth()
  const { orgId } = useOrg()
  const [activeTab, setActiveTab] = useState('Send Notification')
  const [patients, setPatients] = useState([])
  const [logs, setLogs] = useState([])
  const [templates, setTemplates] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const [sendForm, setSendForm] = useState({
    patient_id: '',
    channel: 'SMS',
    event_type: 'custom',
    message: '',
    phone_override: '',
  })

  const [templateForm, setTemplateForm] = useState({
    event_type: 'appointment_reminder',
    channel: 'SMS',
    template_text: '',
  })

  const [settingsForm, setSettingsForm] = useState({
    sms_provider: 'arkesel',
    sms_api_key: '',
    sms_sender_id: '',
    whatsapp_provider: 'twilio',
    whatsapp_account_sid: '',
    whatsapp_auth_token: '',
    whatsapp_from_number: '',
    enabled: true,
  })

  useEffect(() => {
    if (orgId) {
      fetchAll()
      fetchPatients()
    }
  }, [orgId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [logsRes, tplRes, settRes] = await Promise.all([
        supabase.from('notification_logs').select('*, patients(full_name)').eq('hospital_id', orgId).order('sent_at', { ascending: false }).limit(100),
        supabase.from('notification_templates').select('*').eq('hospital_id', orgId),
        supabase.from('notification_settings').select('*').eq('hospital_id', orgId).maybeSingle(),
      ])
      setLogs(logsRes.data || [])
      setTemplates(tplRes.data || [])
      if (settRes.data) {
        setSettings(settRes.data)
        setSettingsForm(s => ({ ...s, ...settRes.data }))
      }
    } catch {
      toast.error('Failed to load notification data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPatients() {
    const { data } = await supabase.from('patients').select('id, full_name, phone_number, folder_number').eq('hospital_id', orgId).order('full_name').limit(500)
    setPatients(data || [])
  }

  function resolveMessage() {
    const tpl = templates.find(t => t.event_type === sendForm.event_type && (t.channel === sendForm.channel || sendForm.channel === 'Both'))
    if (tpl && sendForm.event_type !== 'custom') return tpl.template_text
    return sendForm.message
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!sendForm.patient_id && !sendForm.phone_override) { toast.error('Select a patient or enter a phone number'); return }
    const message = resolveMessage()
    if (!message.trim()) { toast.error('Message is empty'); return }
    setSending(true)
    try {
      const patient = patients.find(p => p.id === sendForm.patient_id)
      const phone = sendForm.phone_override || patient?.phone_number
      if (!phone) { toast.error('No phone number found for this patient'); setSending(false); return }

      const { error } = await supabase.from('notification_logs').insert({
        hospital_id: orgId,
        patient_id: sendForm.patient_id || null,
        channel: sendForm.channel,
        event_type: sendForm.event_type,
        message,
        recipient_phone: phone,
        status: 'queued',
        sent_by: user.id,
        sent_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success(`Notification queued for delivery via ${sendForm.channel}`)
      setSendForm(f => ({ ...f, patient_id: '', message: '', phone_override: '' }))
      fetchAll()
    } catch {
      toast.error('Failed to queue notification')
    } finally {
      setSending(false)
    }
  }

  async function handleTemplateSave(e) {
    e.preventDefault()
    if (!templateForm.template_text) { toast.error('Template text is required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('notification_templates').upsert({
        ...templateForm,
        hospital_id: orgId,
        updated_by: user.id,
      }, { onConflict: 'hospital_id,event_type,channel' })
      if (error) throw error
      toast.success('Template saved')
      setTemplateForm({ event_type: 'appointment_reminder', channel: 'SMS', template_text: '' })
      fetchAll()
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  async function handleSettingsSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('notification_settings').upsert({
        ...settingsForm,
        hospital_id: orgId,
        updated_by: user.id,
      }, { onConflict: 'hospital_id' })
      if (error) throw error
      toast.success('Notification settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const selectedPatient = patients.find(p => p.id === sendForm.patient_id)

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">SMS & Notifications</h2>
          <p className="text-sm text-slate-500 mt-0.5">Send SMS and WhatsApp messages to patients via configured gateways</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Sent', value: logs.length, color: 'bg-indigo-50 text-indigo-700' },
            { label: 'SMS', value: logs.filter(l => l.channel === 'SMS').length, color: 'bg-blue-50 text-blue-700' },
            { label: 'WhatsApp', value: logs.filter(l => l.channel === 'WhatsApp').length, color: 'bg-green-50 text-green-700' },
            { label: 'Failed', value: logs.filter(l => l.status === 'failed').length, color: 'bg-red-50 text-red-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color} border border-current border-opacity-20`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm font-medium opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Send Notification */}
        {activeTab === 'Send Notification' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl">
            <h3 className="font-semibold text-slate-900 mb-4">Send a Notification</h3>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Patient (optional)</label>
                <select value={sendForm.patient_id} onChange={e => setSendForm(f => ({ ...f, patient_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Search patient...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.folder_number}) — {p.phone_number}</option>)}
                </select>
                {selectedPatient && <p className="text-xs text-slate-500 mt-1">Phone: {selectedPatient.phone_number}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Override (if no patient selected)</label>
                <input value={sendForm.phone_override} onChange={e => setSendForm(f => ({ ...f, phone_override: e.target.value }))} placeholder="e.g. +233244000000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
                  <select value={sendForm.channel} onChange={e => setSendForm(f => ({ ...f, channel: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select value={sendForm.event_type} onChange={e => setSendForm(f => ({ ...f, event_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Message {sendForm.event_type !== 'custom' && templates.find(t => t.event_type === sendForm.event_type) ? '(from template)' : ''}
                </label>
                <textarea
                  value={sendForm.event_type !== 'custom' && templates.find(t => t.event_type === sendForm.event_type)
                    ? templates.find(t => t.event_type === sendForm.event_type).template_text
                    : sendForm.message}
                  onChange={e => setSendForm(f => ({ ...f, message: e.target.value, event_type: 'custom' }))}
                  rows={4}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Type your message here..."
                />
                <p className="text-xs text-slate-400 mt-1">{(sendForm.message || '').length} / 160 characters (1 SMS unit)</p>
              </div>
              <button type="submit" disabled={sending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {sending ? 'Sending...' : `Send via ${sendForm.channel}`}
              </button>
            </form>
          </div>
        )}

        {/* Templates */}
        {activeTab === 'Templates' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl">
              <h3 className="font-semibold text-slate-900 mb-4">Add / Update Template</h3>
              <form onSubmit={handleTemplateSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Event</label>
                    <select value={templateForm.event_type} onChange={e => setTemplateForm(f => ({ ...f, event_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      {EVENT_TYPES.filter(et => et.value !== 'custom').map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
                    <select value={templateForm.channel} onChange={e => setTemplateForm(f => ({ ...f, channel: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="SMS">SMS</option>
                      <option value="WhatsApp">WhatsApp</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Template Text</label>
                  <textarea value={templateForm.template_text} onChange={e => setTemplateForm(f => ({ ...f, template_text: e.target.value }))} rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Use {{name}}, {{date}}, {{time}}, {{doctor}} as placeholders" />
                  <p className="text-xs text-slate-400 mt-1">Available variables: {'{{name}}'}, {'{{date}}'}, {'{{time}}'}, {'{{doctor}}'}, {'{{hospital}}'}</p>
                </div>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </form>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Event', 'Channel', 'Template'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-slate-400 text-sm">No templates yet</td></tr>}
                  {templates.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 capitalize">{t.event_type?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">{t.channel}</span></td>
                      <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate">{t.template_text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs */}
        {activeTab === 'Logs' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Patient', 'Channel', 'Type', 'Phone', 'Status', 'Sent At'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No notifications sent yet</td></tr>}
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{l.patients?.full_name || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${l.channel === 'SMS' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{l.channel}</span></td>
                    <td className="px-4 py-3 text-slate-600 capitalize text-xs">{l.event_type?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-slate-600">{l.recipient_phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${l.status === 'delivered' ? 'bg-green-100 text-green-700' : l.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{l.sent_at ? new Date(l.sent_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Settings */}
        {activeTab === 'Settings' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl">
            <h3 className="font-semibold text-slate-900 mb-1">Gateway Configuration</h3>
            <p className="text-xs text-slate-500 mb-4">Configure your SMS and WhatsApp providers. API keys are stored securely.</p>
            <form onSubmit={handleSettingsSave} className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">SMS Gateway</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
                    <select value={settingsForm.sms_provider} onChange={e => setSettingsForm(f => ({ ...f, sms_provider: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="arkesel">Arkesel (Ghana)</option>
                      <option value="hubtel">Hubtel (Ghana)</option>
                      <option value="mnotify">mNotify (Ghana)</option>
                      <option value="twilio">Twilio</option>
                      <option value="africas_talking">Africa's Talking</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">API Key</label>
                    <input type="password" value={settingsForm.sms_api_key} onChange={e => setSettingsForm(f => ({ ...f, sms_api_key: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Sender ID</label>
                    <input value={settingsForm.sms_sender_id} onChange={e => setSettingsForm(f => ({ ...f, sms_sender_id: e.target.value }))} placeholder="e.g. CARELINK" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">WhatsApp Gateway</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
                    <select value={settingsForm.whatsapp_provider} onChange={e => setSettingsForm(f => ({ ...f, whatsapp_provider: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="twilio">Twilio WhatsApp</option>
                      <option value="360dialog">360dialog</option>
                      <option value="meta_cloud">Meta Cloud API</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Account SID / API Key</label>
                    <input type="password" value={settingsForm.whatsapp_account_sid} onChange={e => setSettingsForm(f => ({ ...f, whatsapp_account_sid: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Auth Token</label>
                    <input type="password" value={settingsForm.whatsapp_auth_token} onChange={e => setSettingsForm(f => ({ ...f, whatsapp_auth_token: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">From Number</label>
                    <input value={settingsForm.whatsapp_from_number} onChange={e => setSettingsForm(f => ({ ...f, whatsapp_from_number: e.target.value }))} placeholder="+1415XXXXXXX" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settingsForm.enabled} onChange={e => setSettingsForm(f => ({ ...f, enabled: e.target.checked }))} />
                Enable notifications
              </label>

              <button type="submit" disabled={saving} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Gateway Settings'}
              </button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
