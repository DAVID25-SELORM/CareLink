import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'

const TABS = ['Active Dispatches', 'Fleet', 'History']

const STATUS_COLORS = {
  available: 'bg-green-100 text-green-700',
  dispatched: 'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-red-100 text-red-700',
  standby: 'bg-blue-100 text-blue-700',
}

const DISPATCH_STATUS_COLORS = {
  en_route: 'bg-yellow-100 text-yellow-700',
  on_scene: 'bg-orange-100 text-orange-700',
  returning: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function Ambulance() {
  const { user } = useAuth()
  const { orgId } = useOrg()
  const [activeTab, setActiveTab] = useState('Active Dispatches')
  const [fleet, setFleet] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showFleetForm, setShowFleetForm] = useState(false)
  const [showDispatchForm, setShowDispatchForm] = useState(false)

  const [fleetForm, setFleetForm] = useState({
    registration_number: '',
    vehicle_type: 'Basic Life Support',
    make_model: '',
    year: '',
    driver_name: '',
    driver_phone: '',
    status: 'available',
    notes: '',
  })

  const [dispatchForm, setDispatchForm] = useState({
    ambulance_id: '',
    caller_name: '',
    caller_phone: '',
    incident_location: '',
    incident_type: 'Medical Emergency',
    patient_name: '',
    dispatcher_notes: '',
    dispatched_at: new Date().toISOString().slice(0, 16),
  })

  useEffect(() => {
    if (orgId) {
      fetchAll()
    }
  }, [orgId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [fleetRes, dispatchRes] = await Promise.all([
        supabase.from('ambulance_fleet').select('*').eq('hospital_id', orgId).order('registration_number'),
        supabase.from('ambulance_dispatches').select('*, ambulance_fleet(registration_number, vehicle_type, driver_name)').eq('hospital_id', orgId).order('dispatched_at', { ascending: false }).limit(200),
      ])
      setFleet(fleetRes.data || [])
      setDispatches(dispatchRes.data || [])
    } catch {
      toast.error('Failed to load ambulance data')
    } finally {
      setLoading(false)
    }
  }

  async function handleFleetSubmit(e) {
    e.preventDefault()
    if (!fleetForm.registration_number) { toast.error('Registration number required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('ambulance_fleet').insert({ ...fleetForm, hospital_id: orgId, created_by: user.id })
      if (error) throw error
      toast.success('Ambulance added to fleet')
      setShowFleetForm(false)
      setFleetForm({ registration_number: '', vehicle_type: 'Basic Life Support', make_model: '', year: '', driver_name: '', driver_phone: '', status: 'available', notes: '' })
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to add ambulance')
    } finally {
      setSaving(false)
    }
  }

  async function handleDispatchSubmit(e) {
    e.preventDefault()
    if (!dispatchForm.ambulance_id || !dispatchForm.incident_location) { toast.error('Ambulance and incident location required'); return }
    setSaving(true)
    try {
      const { error: dispatchError } = await supabase.from('ambulance_dispatches').insert({
        ...dispatchForm,
        hospital_id: orgId,
        status: 'en_route',
        dispatched_by: user.id,
      })
      if (dispatchError) throw dispatchError
      await supabase.from('ambulance_fleet').update({ status: 'dispatched' }).eq('id', dispatchForm.ambulance_id)
      toast.success('Ambulance dispatched')
      setShowDispatchForm(false)
      setDispatchForm({ ambulance_id: '', caller_name: '', caller_phone: '', incident_location: '', incident_type: 'Medical Emergency', patient_name: '', dispatcher_notes: '', dispatched_at: new Date().toISOString().slice(0, 16) })
      fetchAll()
    } catch {
      toast.error('Failed to dispatch ambulance')
    } finally {
      setSaving(false)
    }
  }

  async function updateDispatchStatus(dispatchId, ambulanceId, status) {
    await supabase.from('ambulance_dispatches').update({ status, ...(status === 'completed' ? { arrived_at: new Date().toISOString() } : {}) }).eq('id', dispatchId)
    if (status === 'completed' || status === 'cancelled') {
      await supabase.from('ambulance_fleet').update({ status: 'available' }).eq('id', ambulanceId)
    }
    toast.success('Status updated')
    fetchAll()
  }

  async function updateFleetStatus(fleetId, status) {
    await supabase.from('ambulance_fleet').update({ status }).eq('id', fleetId)
    toast.success('Fleet status updated')
    fetchAll()
  }

  const activeDispatches = dispatches.filter(d => ['en_route', 'on_scene', 'returning'].includes(d.status))
  const available = fleet.filter(f => f.status === 'available').length

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Ambulance Management</h2>
            <p className="text-sm text-slate-500 mt-0.5">Fleet tracking, dispatch, and emergency response</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDispatchForm(true)} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition">
              Dispatch Ambulance
            </button>
            {activeTab === 'Fleet' && (
              <button onClick={() => setShowFleetForm(true)} className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition">
                + Add Vehicle
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Fleet', value: fleet.length, color: 'bg-slate-100 text-slate-700' },
            { label: 'Available', value: available, color: 'bg-green-50 text-green-700' },
            { label: 'Active Calls', value: activeDispatches.length, color: 'bg-yellow-50 text-yellow-700' },
            { label: 'On Maintenance', value: fleet.filter(f => f.status === 'maintenance').length, color: 'bg-red-50 text-red-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color} border border-current border-opacity-20`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm font-medium opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Dispatch Form Modal */}
        {showDispatchForm && (
          <div className="bg-white border-2 border-red-200 rounded-xl p-6 shadow-lg">
            <h3 className="font-semibold text-slate-900 mb-1">Dispatch Ambulance</h3>
            <p className="text-xs text-slate-500 mb-4">Fill in call details and select an available ambulance</p>
            <form onSubmit={handleDispatchSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ambulance *</label>
                <select value={dispatchForm.ambulance_id} onChange={e => setDispatchForm(f => ({ ...f, ambulance_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Select available ambulance</option>
                  {fleet.filter(f => f.status === 'available').map(a => (
                    <option key={a.id} value={a.id}>{a.registration_number} — {a.vehicle_type} (Driver: {a.driver_name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Caller Name</label>
                <input value={dispatchForm.caller_name} onChange={e => setDispatchForm(f => ({ ...f, caller_name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Caller Phone</label>
                <input value={dispatchForm.caller_phone} onChange={e => setDispatchForm(f => ({ ...f, caller_phone: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Incident Location *</label>
                <input value={dispatchForm.incident_location} onChange={e => setDispatchForm(f => ({ ...f, incident_location: e.target.value }))} placeholder="Street address, landmark" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Incident Type</label>
                <select value={dispatchForm.incident_type} onChange={e => setDispatchForm(f => ({ ...f, incident_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {['Medical Emergency', 'Accident / Trauma', 'Obstetric Emergency', 'Cardiac Arrest', 'Stroke', 'Respiratory Distress', 'Patient Transfer', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Patient Name (if known)</label>
                <input value={dispatchForm.patient_name} onChange={e => setDispatchForm(f => ({ ...f, patient_name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dispatch Time</label>
                <input type="datetime-local" value={dispatchForm.dispatched_at} onChange={e => setDispatchForm(f => ({ ...f, dispatched_at: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dispatcher Notes</label>
                <textarea value={dispatchForm.dispatcher_notes} onChange={e => setDispatchForm(f => ({ ...f, dispatcher_notes: e.target.value }))} rows={1} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowDispatchForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{saving ? 'Dispatching...' : 'Dispatch Now'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab} {tab === 'Active Dispatches' && activeDispatches.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{activeDispatches.length}</span>}
            </button>
          ))}
        </div>

        {/* Active Dispatches */}
        {activeTab === 'Active Dispatches' && (
          <div className="space-y-3">
            {activeDispatches.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
                <p className="text-slate-400 text-sm">No active dispatches</p>
                <p className="text-slate-300 text-xs mt-1">All ambulances are available</p>
              </div>
            )}
            {activeDispatches.map(d => (
              <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${DISPATCH_STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-600'}`}>{d.status?.replace('_', ' ').toUpperCase()}</span>
                      <span className="text-xs text-slate-500">{d.incident_type}</span>
                    </div>
                    <p className="font-semibold text-slate-900">{d.incident_location}</p>
                    <p className="text-sm text-slate-600 mt-0.5">Ambulance: {d.ambulance_fleet?.registration_number} | Driver: {d.ambulance_fleet?.driver_name}</p>
                    {d.patient_name && <p className="text-sm text-slate-600">Patient: {d.patient_name}</p>}
                    {d.caller_name && <p className="text-xs text-slate-500">Caller: {d.caller_name} — {d.caller_phone}</p>}
                    <p className="text-xs text-slate-400 mt-1">Dispatched: {d.dispatched_at ? new Date(d.dispatched_at).toLocaleString() : '—'}</p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    {d.status === 'en_route' && <button onClick={() => updateDispatchStatus(d.id, d.ambulance_id, 'on_scene')} className="px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">On Scene</button>}
                    {d.status === 'on_scene' && <button onClick={() => updateDispatchStatus(d.id, d.ambulance_id, 'returning')} className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Returning</button>}
                    {d.status === 'returning' && <button onClick={() => updateDispatchStatus(d.id, d.ambulance_id, 'completed')} className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200">Complete</button>}
                    <button onClick={() => updateDispatchStatus(d.id, d.ambulance_id, 'cancelled')} className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Cancel</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fleet Tab */}
        {activeTab === 'Fleet' && (
          <div className="space-y-4">
            {showFleetForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Add Vehicle to Fleet</h3>
                <form onSubmit={handleFleetSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Registration Number *</label>
                    <input value={fleetForm.registration_number} onChange={e => setFleetForm(f => ({ ...f, registration_number: e.target.value }))} placeholder="e.g. GR-1234-23" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Type</label>
                    <select value={fleetForm.vehicle_type} onChange={e => setFleetForm(f => ({ ...f, vehicle_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option>Basic Life Support</option>
                      <option>Advanced Life Support</option>
                      <option>Patient Transport</option>
                      <option>Neonatal Transport</option>
                      <option>Motorcycle Responder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Make / Model</label>
                    <input value={fleetForm.make_model} onChange={e => setFleetForm(f => ({ ...f, make_model: e.target.value }))} placeholder="e.g. Toyota Hiace" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                    <input type="number" value={fleetForm.year} onChange={e => setFleetForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. 2022" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Driver Name</label>
                    <input value={fleetForm.driver_name} onChange={e => setFleetForm(f => ({ ...f, driver_name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Driver Phone</label>
                    <input value={fleetForm.driver_phone} onChange={e => setFleetForm(f => ({ ...f, driver_phone: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <select value={fleetForm.status} onChange={e => setFleetForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="available">Available</option>
                      <option value="maintenance">Under Maintenance</option>
                      <option value="standby">Standby</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                    <input value={fleetForm.notes} onChange={e => setFleetForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2 flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowFleetForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50">{saving ? 'Saving...' : 'Add Vehicle'}</button>
                  </div>
                </form>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fleet.length === 0 && (
                <div className="col-span-3 bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
                  <p className="text-slate-400 text-sm">No ambulances in fleet</p>
                </div>
              )}
              {fleet.map(v => (
                <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-slate-900 text-lg">{v.registration_number}</p>
                      <p className="text-xs text-slate-500">{v.vehicle_type}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[v.status] || 'bg-slate-100 text-slate-600'}`}>{v.status}</span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    {v.make_model && <p>{v.make_model} {v.year && `(${v.year})`}</p>}
                    {v.driver_name && <p>Driver: {v.driver_name}</p>}
                    {v.driver_phone && <p className="text-xs">{v.driver_phone}</p>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {['available', 'maintenance', 'standby'].map(s => (
                      <button key={s} onClick={() => updateFleetStatus(v.id, s)}
                        className={`px-2 py-1 text-xs font-medium rounded-lg transition ${v.status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'History' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Ambulance', 'Type', 'Location', 'Patient', 'Status', 'Dispatched'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispatches.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No dispatch history</td></tr>}
                {dispatches.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.ambulance_fleet?.registration_number}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{d.incident_type}</td>
                    <td className="px-4 py-3 text-slate-700">{d.incident_location}</td>
                    <td className="px-4 py-3 text-slate-600">{d.patient_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${DISPATCH_STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-600'}`}>{d.status?.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{d.dispatched_at ? new Date(d.dispatched_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
