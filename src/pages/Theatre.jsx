import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'

const TABS = ['Schedule', 'Pre-Op', 'Operation Notes', 'Post-Op']

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  postponed: 'bg-slate-100 text-slate-600',
}

export default function Theatre() {
  const { user, userRole } = useAuth()
  const { orgId } = useOrg()
  const [activeTab, setActiveTab] = useState('Schedule')
  const [sessions, setSessions] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    patient_id: '',
    scheduled_date: '',
    scheduled_time: '',
    procedure_name: '',
    surgeon: '',
    anaesthetist: '',
    ot_room: '',
    surgery_type: 'elective',
    status: 'scheduled',
    pre_op_notes: '',
    consent_obtained: false,
    consent_date: '',
    anaesthesia_type: 'general',
    operation_notes: '',
    findings: '',
    complications: '',
    post_op_notes: '',
    post_op_status: '',
    discharge_from_ot: '',
  })

  const [preOpForm, setPreOpForm] = useState({
    session_id: '',
    assessment_notes: '',
    fasting_confirmed: false,
    allergies: '',
    blood_group: '',
    consent_obtained: false,
    pre_op_medication: '',
    anaesthesia_type: 'general',
  })

  const [opNotesForm, setOpNotesForm] = useState({
    session_id: '',
    operation_notes: '',
    findings: '',
    complications: '',
    blood_loss_ml: '',
    duration_minutes: '',
    implants_used: '',
  })

  const [postOpForm, setPostOpForm] = useState({
    session_id: '',
    post_op_notes: '',
    recovery_status: 'stable',
    pain_score: '',
    instructions: '',
    discharged_to: 'ward',
    discharge_time: '',
  })

  useEffect(() => {
    if (orgId) {
      fetchSessions()
      fetchPatients()
    }
  }, [orgId])

  async function fetchSessions() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('theatre_sessions')
        .select('*, patients(full_name, folder_number)')
        .eq('hospital_id', orgId)
        .order('scheduled_date', { ascending: false })
        .limit(100)
      if (error) throw error
      setSessions(data || [])
    } catch (err) {
      toast.error('Failed to load theatre sessions')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPatients() {
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, folder_number')
      .eq('hospital_id', orgId)
      .order('full_name')
      .limit(500)
    setPatients(data || [])
  }

  async function handleSchedule(e) {
    e.preventDefault()
    if (!form.patient_id || !form.scheduled_date || !form.procedure_name || !form.surgeon) {
      toast.error('Patient, date, procedure and surgeon are required')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('theatre_sessions').insert({
        ...form,
        hospital_id: orgId,
        created_by: user.id,
      })
      if (error) throw error
      toast.success('Theatre session scheduled')
      setShowForm(false)
      setForm({ patient_id: '', scheduled_date: '', scheduled_time: '', procedure_name: '', surgeon: '', anaesthetist: '', ot_room: '', surgery_type: 'elective', status: 'scheduled', pre_op_notes: '', consent_obtained: false, consent_date: '', anaesthesia_type: 'general', operation_notes: '', findings: '', complications: '', post_op_notes: '', post_op_status: '', discharge_from_ot: '' })
      fetchSessions()
    } catch (err) {
      toast.error('Failed to schedule session')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(sessionId, status) {
    const { error } = await supabase
      .from('theatre_sessions')
      .update({ status })
      .eq('id', sessionId)
    if (error) { toast.error('Failed to update status'); return }
    toast.success('Status updated')
    fetchSessions()
  }

  async function handlePreOp(e) {
    e.preventDefault()
    if (!preOpForm.session_id) { toast.error('Select a theatre session'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('theatre_pre_op').upsert({
        ...preOpForm,
        hospital_id: orgId,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })
      if (error) throw error
      toast.success('Pre-op assessment saved')
      setPreOpForm({ session_id: '', assessment_notes: '', fasting_confirmed: false, allergies: '', blood_group: '', consent_obtained: false, pre_op_medication: '', anaesthesia_type: 'general' })
    } catch {
      toast.error('Failed to save pre-op assessment')
    } finally {
      setSaving(false)
    }
  }

  async function handleOpNotes(e) {
    e.preventDefault()
    if (!opNotesForm.session_id || !opNotesForm.operation_notes) { toast.error('Session and operation notes required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('theatre_operation_notes').upsert({
        ...opNotesForm,
        hospital_id: orgId,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })
      if (error) throw error
      await supabase.from('theatre_sessions').update({ status: 'completed' }).eq('id', opNotesForm.session_id)
      toast.success('Operation notes saved')
      setOpNotesForm({ session_id: '', operation_notes: '', findings: '', complications: '', blood_loss_ml: '', duration_minutes: '', implants_used: '' })
      fetchSessions()
    } catch {
      toast.error('Failed to save operation notes')
    } finally {
      setSaving(false)
    }
  }

  async function handlePostOp(e) {
    e.preventDefault()
    if (!postOpForm.session_id) { toast.error('Select a session'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('theatre_post_op').upsert({
        ...postOpForm,
        hospital_id: orgId,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })
      if (error) throw error
      toast.success('Post-op notes saved')
      setPostOpForm({ session_id: '', post_op_notes: '', recovery_status: 'stable', pain_score: '', instructions: '', discharged_to: 'ward', discharge_time: '' })
    } catch {
      toast.error('Failed to save post-op notes')
    } finally {
      setSaving(false)
    }
  }

  const canEdit = ['admin', 'doctor'].includes(userRole)

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Theatre Management</h2>
            <p className="text-sm text-slate-500 mt-0.5">Operation scheduling, pre-op, intra-op, and post-op records</p>
          </div>
          {canEdit && activeTab === 'Schedule' && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              + Schedule Surgery
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Schedule Tab */}
        {activeTab === 'Schedule' && (
          <div className="space-y-4">
            {showForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Schedule Surgery</h3>
                <form onSubmit={handleSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Patient *</label>
                    <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                      <option value="">Select patient</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.folder_number})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Procedure *</label>
                    <input value={form.procedure_name} onChange={e => setForm(f => ({ ...f, procedure_name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
                    <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                    <input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Surgeon *</label>
                    <input value={form.surgeon} onChange={e => setForm(f => ({ ...f, surgeon: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Anaesthetist</label>
                    <input value={form.anaesthetist} onChange={e => setForm(f => ({ ...f, anaesthetist: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">OT Room</label>
                    <input value={form.ot_room} onChange={e => setForm(f => ({ ...f, ot_room: e.target.value }))} placeholder="e.g. OT 1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Surgery Type</label>
                    <select value={form.surgery_type} onChange={e => setForm(f => ({ ...f, surgery_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="elective">Elective</option>
                      <option value="emergency">Emergency</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Anaesthesia Type</label>
                    <select value={form.anaesthesia_type} onChange={e => setForm(f => ({ ...f, anaesthesia_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="general">General</option>
                      <option value="spinal">Spinal</option>
                      <option value="epidural">Epidural</option>
                      <option value="local">Local</option>
                      <option value="sedation">Sedation</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="consent" checked={form.consent_obtained} onChange={e => setForm(f => ({ ...f, consent_obtained: e.target.checked }))} />
                    <label htmlFor="consent" className="text-sm text-slate-700">Consent obtained</label>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Pre-op Notes</label>
                    <textarea value={form.pre_op_notes} onChange={e => setForm(f => ({ ...f, pre_op_notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2 flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Schedule'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Patient</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Procedure</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Date & Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Surgeon</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                    {canEdit && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No theatre sessions scheduled</td></tr>
                  )}
                  {sessions.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{s.patients?.full_name}</td>
                      <td className="px-4 py-3 text-slate-700">{s.procedure_name}</td>
                      <td className="px-4 py-3 text-slate-600">{s.scheduled_date} {s.scheduled_time}</td>
                      <td className="px-4 py-3 text-slate-600">{s.surgeon}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${s.surgery_type === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{s.surgery_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <select value={s.status} onChange={e => updateStatus(s.id, e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1">
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="postponed">Postponed</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pre-Op Tab */}
        {activeTab === 'Pre-Op' && canEdit && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl">
            <h3 className="font-semibold text-slate-900 mb-4">Pre-Operative Assessment</h3>
            <form onSubmit={handlePreOp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Theatre Session *</label>
                <select value={preOpForm.session_id} onChange={e => setPreOpForm(f => ({ ...f, session_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Select session</option>
                  {sessions.filter(s => s.status === 'scheduled').map(s => (
                    <option key={s.id} value={s.id}>{s.patients?.full_name} — {s.procedure_name} ({s.scheduled_date})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Notes</label>
                <textarea value={preOpForm.assessment_notes} onChange={e => setPreOpForm(f => ({ ...f, assessment_notes: e.target.value }))} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Allergies</label>
                  <input value={preOpForm.allergies} onChange={e => setPreOpForm(f => ({ ...f, allergies: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Blood Group</label>
                  <select value={preOpForm.blood_group} onChange={e => setPreOpForm(f => ({ ...f, blood_group: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pre-op Medication</label>
                <input value={preOpForm.pre_op_medication} onChange={e => setPreOpForm(f => ({ ...f, pre_op_medication: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Anaesthesia Type</label>
                <select value={preOpForm.anaesthesia_type} onChange={e => setPreOpForm(f => ({ ...f, anaesthesia_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="general">General</option>
                  <option value="spinal">Spinal</option>
                  <option value="epidural">Epidural</option>
                  <option value="local">Local</option>
                  <option value="sedation">Sedation</option>
                </select>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={preOpForm.fasting_confirmed} onChange={e => setPreOpForm(f => ({ ...f, fasting_confirmed: e.target.checked }))} />
                  Fasting confirmed
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={preOpForm.consent_obtained} onChange={e => setPreOpForm(f => ({ ...f, consent_obtained: e.target.checked }))} />
                  Consent obtained
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Pre-Op Assessment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Operation Notes Tab */}
        {activeTab === 'Operation Notes' && canEdit && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl">
            <h3 className="font-semibold text-slate-900 mb-4">Intra-Operative Notes</h3>
            <form onSubmit={handleOpNotes} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Theatre Session *</label>
                <select value={opNotesForm.session_id} onChange={e => setOpNotesForm(f => ({ ...f, session_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Select session</option>
                  {sessions.filter(s => ['scheduled', 'in_progress'].includes(s.status)).map(s => (
                    <option key={s.id} value={s.id}>{s.patients?.full_name} — {s.procedure_name} ({s.scheduled_date})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Operation Notes *</label>
                <textarea value={opNotesForm.operation_notes} onChange={e => setOpNotesForm(f => ({ ...f, operation_notes: e.target.value }))} rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Findings</label>
                <textarea value={opNotesForm.findings} onChange={e => setOpNotesForm(f => ({ ...f, findings: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Complications</label>
                <textarea value={opNotesForm.complications} onChange={e => setOpNotesForm(f => ({ ...f, complications: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Blood Loss (mL)</label>
                  <input type="number" value={opNotesForm.blood_loss_ml} onChange={e => setOpNotesForm(f => ({ ...f, blood_loss_ml: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Duration (minutes)</label>
                  <input type="number" value={opNotesForm.duration_minutes} onChange={e => setOpNotesForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Implants / Prosthetics Used</label>
                <input value={opNotesForm.implants_used} onChange={e => setOpNotesForm(f => ({ ...f, implants_used: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Operation Notes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Post-Op Tab */}
        {activeTab === 'Post-Op' && canEdit && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl">
            <h3 className="font-semibold text-slate-900 mb-4">Post-Operative Recovery</h3>
            <form onSubmit={handlePostOp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Theatre Session *</label>
                <select value={postOpForm.session_id} onChange={e => setPostOpForm(f => ({ ...f, session_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Select session</option>
                  {sessions.filter(s => s.status === 'completed').map(s => (
                    <option key={s.id} value={s.id}>{s.patients?.full_name} — {s.procedure_name} ({s.scheduled_date})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Post-Op Notes</label>
                <textarea value={postOpForm.post_op_notes} onChange={e => setPostOpForm(f => ({ ...f, post_op_notes: e.target.value }))} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Recovery Status</label>
                  <select value={postOpForm.recovery_status} onChange={e => setPostOpForm(f => ({ ...f, recovery_status: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="stable">Stable</option>
                    <option value="critical">Critical</option>
                    <option value="recovering">Recovering</option>
                    <option value="discharged_to_ward">Discharged to Ward</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Pain Score (0–10)</label>
                  <input type="number" min="0" max="10" value={postOpForm.pain_score} onChange={e => setPostOpForm(f => ({ ...f, pain_score: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Discharge To</label>
                <select value={postOpForm.discharged_to} onChange={e => setPostOpForm(f => ({ ...f, discharged_to: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="ward">Ward</option>
                  <option value="icu">ICU</option>
                  <option value="home">Home</option>
                  <option value="recovery_room">Recovery Room</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Post-Op Instructions</label>
                <textarea value={postOpForm.instructions} onChange={e => setPostOpForm(f => ({ ...f, instructions: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Discharge from OT Time</label>
                <input type="datetime-local" value={postOpForm.discharge_time} onChange={e => setPostOpForm(f => ({ ...f, discharge_time: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Post-Op Notes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
