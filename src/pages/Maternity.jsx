import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'

const TABS = ['ANC Visits', 'Delivery', 'Postnatal']

export default function Maternity() {
  const { user, userRole } = useAuth()
  const { orgId } = useOrg()
  const [activeTab, setActiveTab] = useState('ANC Visits')
  const [patients, setPatients] = useState([])
  const [ancVisits, setAncVisits] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [postnatal, setPostnatal] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAncForm, setShowAncForm] = useState(false)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)
  const [showPostnatalForm, setShowPostnatalForm] = useState(false)

  const [ancForm, setAncForm] = useState({
    patient_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    gestational_age_weeks: '',
    weight_kg: '',
    bp_systolic: '',
    bp_diastolic: '',
    fundal_height_cm: '',
    fetal_heart_rate: '',
    presentation: 'cephalic',
    edd: '',
    blood_group: '',
    hb_level: '',
    urine_protein: 'negative',
    urine_glucose: 'negative',
    tetanus_dose: '',
    iron_folate_given: false,
    ipt_given: false,
    llin_given: false,
    notes: '',
    next_visit_date: '',
  })

  const [deliveryForm, setDeliveryForm] = useState({
    patient_id: '',
    delivery_date: '',
    delivery_time: '',
    delivery_mode: 'svd',
    gestational_age_weeks: '',
    birth_weight_kg: '',
    baby_sex: 'male',
    apgar_1min: '',
    apgar_5min: '',
    placenta_complete: true,
    blood_loss_ml: '',
    episiotomy: false,
    tears: 'none',
    attendant: '',
    complications: '',
    outcome: 'live_birth',
    mother_condition: 'good',
    notes: '',
  })

  const [postnatalForm, setPostnatalForm] = useState({
    patient_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    days_postpartum: '',
    bp_systolic: '',
    bp_diastolic: '',
    temperature: '',
    uterus_involution: 'normal',
    lochia: 'normal',
    breast_condition: 'normal',
    breastfeeding: true,
    family_planning_counselled: false,
    family_planning_method: '',
    baby_condition: 'good',
    immunizations_given: '',
    notes: '',
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
      const [ancRes, delRes, pnRes] = await Promise.all([
        supabase.from('anc_visits').select('*, patients(full_name, folder_number)').eq('hospital_id', orgId).order('visit_date', { ascending: false }).limit(100),
        supabase.from('maternity_deliveries').select('*, patients(full_name, folder_number)').eq('hospital_id', orgId).order('delivery_date', { ascending: false }).limit(100),
        supabase.from('postnatal_visits').select('*, patients(full_name, folder_number)').eq('hospital_id', orgId).order('visit_date', { ascending: false }).limit(100),
      ])
      setAncVisits(ancRes.data || [])
      setDeliveries(delRes.data || [])
      setPostnatal(pnRes.data || [])
    } catch {
      toast.error('Failed to load maternity records')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPatients() {
    const { data } = await supabase.from('patients').select('id, full_name, folder_number, gender').eq('hospital_id', orgId).eq('gender', 'female').order('full_name').limit(500)
    setPatients(data || [])
  }

  async function handleAncSubmit(e) {
    e.preventDefault()
    if (!ancForm.patient_id || !ancForm.visit_date) { toast.error('Patient and visit date required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('anc_visits').insert({ ...ancForm, hospital_id: orgId, recorded_by: user.id })
      if (error) throw error
      toast.success('ANC visit recorded')
      setShowAncForm(false)
      setAncForm({ patient_id: '', visit_date: new Date().toISOString().split('T')[0], gestational_age_weeks: '', weight_kg: '', bp_systolic: '', bp_diastolic: '', fundal_height_cm: '', fetal_heart_rate: '', presentation: 'cephalic', edd: '', blood_group: '', hb_level: '', urine_protein: 'negative', urine_glucose: 'negative', tetanus_dose: '', iron_folate_given: false, ipt_given: false, llin_given: false, notes: '', next_visit_date: '' })
      fetchAll()
    } catch {
      toast.error('Failed to save ANC visit')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeliverySubmit(e) {
    e.preventDefault()
    if (!deliveryForm.patient_id || !deliveryForm.delivery_date) { toast.error('Patient and delivery date required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('maternity_deliveries').insert({ ...deliveryForm, hospital_id: orgId, recorded_by: user.id })
      if (error) throw error
      toast.success('Delivery record saved')
      setShowDeliveryForm(false)
      setDeliveryForm({ patient_id: '', delivery_date: '', delivery_time: '', delivery_mode: 'svd', gestational_age_weeks: '', birth_weight_kg: '', baby_sex: 'male', apgar_1min: '', apgar_5min: '', placenta_complete: true, blood_loss_ml: '', episiotomy: false, tears: 'none', attendant: '', complications: '', outcome: 'live_birth', mother_condition: 'good', notes: '' })
      fetchAll()
    } catch {
      toast.error('Failed to save delivery record')
    } finally {
      setSaving(false)
    }
  }

  async function handlePostnatalSubmit(e) {
    e.preventDefault()
    if (!postnatalForm.patient_id || !postnatalForm.visit_date) { toast.error('Patient and visit date required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('postnatal_visits').insert({ ...postnatalForm, hospital_id: orgId, recorded_by: user.id })
      if (error) throw error
      toast.success('Postnatal visit recorded')
      setShowPostnatalForm(false)
      fetchAll()
    } catch {
      toast.error('Failed to save postnatal visit')
    } finally {
      setSaving(false)
    }
  }

  const canEdit = ['admin', 'doctor', 'nurse'].includes(userRole)

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Maternity</h2>
            <p className="text-sm text-slate-500 mt-0.5">ANC visits, delivery records, and postnatal care</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              {activeTab === 'ANC Visits' && <button onClick={() => setShowAncForm(true)} className="px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 transition">+ ANC Visit</button>}
              {activeTab === 'Delivery' && <button onClick={() => setShowDeliveryForm(true)} className="px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 transition">+ Delivery Record</button>}
              {activeTab === 'Postnatal' && <button onClick={() => setShowPostnatalForm(true)} className="px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 transition">+ Postnatal Visit</button>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total ANC Visits', value: ancVisits.length, color: 'bg-pink-50 text-pink-700' },
            { label: 'Deliveries', value: deliveries.length, color: 'bg-purple-50 text-purple-700' },
            { label: 'Postnatal Visits', value: postnatal.length, color: 'bg-rose-50 text-rose-700' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl p-4 ${stat.color} border border-current border-opacity-20`}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm font-medium opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-pink-500 text-pink-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ANC Visits */}
        {activeTab === 'ANC Visits' && (
          <div className="space-y-4">
            {showAncForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">New ANC Visit</h3>
                <form onSubmit={handleAncSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Patient *</label>
                    <select value={ancForm.patient_id} onChange={e => setAncForm(f => ({ ...f, patient_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                      <option value="">Select patient</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.folder_number})</option>)}
                    </select>
                  </div>
                  {[
                    { label: 'Visit Date *', key: 'visit_date', type: 'date' },
                    { label: 'GA (weeks)', key: 'gestational_age_weeks', type: 'number' },
                    { label: 'EDD', key: 'edd', type: 'date' },
                    { label: 'Weight (kg)', key: 'weight_kg', type: 'number' },
                    { label: 'BP Systolic', key: 'bp_systolic', type: 'number' },
                    { label: 'BP Diastolic', key: 'bp_diastolic', type: 'number' },
                    { label: 'Fundal Height (cm)', key: 'fundal_height_cm', type: 'number' },
                    { label: 'FHR (bpm)', key: 'fetal_heart_rate', type: 'number' },
                    { label: 'Hb Level (g/dL)', key: 'hb_level', type: 'number' },
                    { label: 'Tetanus Dose', key: 'tetanus_dose', type: 'text' },
                    { label: 'Next Visit', key: 'next_visit_date', type: 'date' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input type={f.type} value={ancForm[f.key]} onChange={e => setAncForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Presentation</label>
                    <select value={ancForm.presentation} onChange={e => setAncForm(f => ({ ...f, presentation: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="cephalic">Cephalic</option>
                      <option value="breech">Breech</option>
                      <option value="transverse">Transverse</option>
                      <option value="oblique">Oblique</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Blood Group</label>
                    <select value={ancForm.blood_group} onChange={e => setAncForm(f => ({ ...f, blood_group: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Select</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Urine Protein</label>
                    <select value={ancForm.urine_protein} onChange={e => setAncForm(f => ({ ...f, urine_protein: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="negative">Negative</option>
                      <option value="trace">Trace</option>
                      <option value="1+">1+</option>
                      <option value="2+">2+</option>
                      <option value="3+">3+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Urine Glucose</label>
                    <select value={ancForm.urine_glucose} onChange={e => setAncForm(f => ({ ...f, urine_glucose: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="negative">Negative</option>
                      <option value="positive">Positive</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-6 pt-5 md:col-span-2 lg:col-span-3">
                    {[['iron_folate_given', 'Iron/Folate Given'], ['ipt_given', 'IPT Given'], ['llin_given', 'LLIN Given']].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={ancForm[key]} onChange={e => setAncForm(f => ({ ...f, [key]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                    <textarea value={ancForm.notes} onChange={e => setAncForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3 flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowAncForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save ANC Visit'}</button>
                  </div>
                </form>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Patient', 'Date', 'GA (wks)', 'BP', 'FHR', 'Presentation', 'EDD', 'Next Visit'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ancVisits.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No ANC visits recorded</td></tr>}
                  {ancVisits.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{v.patients?.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{v.visit_date}</td>
                      <td className="px-4 py-3 text-slate-600">{v.gestational_age_weeks}</td>
                      <td className="px-4 py-3 text-slate-600">{v.bp_systolic && `${v.bp_systolic}/${v.bp_diastolic}`}</td>
                      <td className="px-4 py-3 text-slate-600">{v.fetal_heart_rate}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{v.presentation}</td>
                      <td className="px-4 py-3 text-slate-600">{v.edd}</td>
                      <td className="px-4 py-3 text-slate-600">{v.next_visit_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Delivery */}
        {activeTab === 'Delivery' && (
          <div className="space-y-4">
            {showDeliveryForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Delivery Record</h3>
                <form onSubmit={handleDeliverySubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Patient *</label>
                    <select value={deliveryForm.patient_id} onChange={e => setDeliveryForm(f => ({ ...f, patient_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                      <option value="">Select patient</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.folder_number})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Date *</label>
                    <input type="date" value={deliveryForm.delivery_date} onChange={e => setDeliveryForm(f => ({ ...f, delivery_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Time</label>
                    <input type="time" value={deliveryForm.delivery_time} onChange={e => setDeliveryForm(f => ({ ...f, delivery_time: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Mode</label>
                    <select value={deliveryForm.delivery_mode} onChange={e => setDeliveryForm(f => ({ ...f, delivery_mode: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="svd">SVD (Normal)</option>
                      <option value="cs">Caesarean Section</option>
                      <option value="assisted">Assisted (Vacuum/Forceps)</option>
                      <option value="breech">Breech</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">GA at Delivery (wks)</label>
                    <input type="number" value={deliveryForm.gestational_age_weeks} onChange={e => setDeliveryForm(f => ({ ...f, gestational_age_weeks: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Birth Weight (kg)</label>
                    <input type="number" step="0.1" value={deliveryForm.birth_weight_kg} onChange={e => setDeliveryForm(f => ({ ...f, birth_weight_kg: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Baby Sex</label>
                    <select value={deliveryForm.baby_sex} onChange={e => setDeliveryForm(f => ({ ...f, baby_sex: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">APGAR 1 min</label>
                    <input type="number" min="0" max="10" value={deliveryForm.apgar_1min} onChange={e => setDeliveryForm(f => ({ ...f, apgar_1min: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">APGAR 5 min</label>
                    <input type="number" min="0" max="10" value={deliveryForm.apgar_5min} onChange={e => setDeliveryForm(f => ({ ...f, apgar_5min: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Blood Loss (mL)</label>
                    <input type="number" value={deliveryForm.blood_loss_ml} onChange={e => setDeliveryForm(f => ({ ...f, blood_loss_ml: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tears</label>
                    <select value={deliveryForm.tears} onChange={e => setDeliveryForm(f => ({ ...f, tears: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="none">None</option>
                      <option value="1st_degree">1st Degree</option>
                      <option value="2nd_degree">2nd Degree</option>
                      <option value="3rd_degree">3rd Degree</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Outcome</label>
                    <select value={deliveryForm.outcome} onChange={e => setDeliveryForm(f => ({ ...f, outcome: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="live_birth">Live Birth</option>
                      <option value="stillbirth">Stillbirth</option>
                      <option value="neonatal_death">Neonatal Death</option>
                      <option value="twins">Twins</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mother Condition</label>
                    <select value={deliveryForm.mother_condition} onChange={e => setDeliveryForm(f => ({ ...f, mother_condition: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Attendant</label>
                    <input value={deliveryForm.attendant} onChange={e => setDeliveryForm(f => ({ ...f, attendant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex items-center gap-6 pt-5">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={deliveryForm.placenta_complete} onChange={e => setDeliveryForm(f => ({ ...f, placenta_complete: e.target.checked }))} />
                      Placenta Complete
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={deliveryForm.episiotomy} onChange={e => setDeliveryForm(f => ({ ...f, episiotomy: e.target.checked }))} />
                      Episiotomy
                    </label>
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Complications</label>
                    <textarea value={deliveryForm.complications} onChange={e => setDeliveryForm(f => ({ ...f, complications: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                    <textarea value={deliveryForm.notes} onChange={e => setDeliveryForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3 flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowDeliveryForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Delivery Record'}</button>
                  </div>
                </form>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Patient', 'Date', 'Mode', 'Birth Wt', 'Baby Sex', 'APGAR (1/5)', 'Outcome', 'Mother'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No deliveries recorded</td></tr>}
                  {deliveries.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{d.patients?.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{d.delivery_date}</td>
                      <td className="px-4 py-3 text-slate-600 uppercase text-xs">{d.delivery_mode}</td>
                      <td className="px-4 py-3 text-slate-600">{d.birth_weight_kg} kg</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{d.baby_sex}</td>
                      <td className="px-4 py-3 text-slate-600">{d.apgar_1min} / {d.apgar_5min}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${d.outcome === 'live_birth' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{d.outcome?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{d.mother_condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Postnatal */}
        {activeTab === 'Postnatal' && (
          <div className="space-y-4">
            {showPostnatalForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Postnatal Visit</h3>
                <form onSubmit={handlePostnatalSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Patient *</label>
                    <select value={postnatalForm.patient_id} onChange={e => setPostnatalForm(f => ({ ...f, patient_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                      <option value="">Select patient</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.folder_number})</option>)}
                    </select>
                  </div>
                  {[
                    { label: 'Visit Date *', key: 'visit_date', type: 'date' },
                    { label: 'Days Postpartum', key: 'days_postpartum', type: 'number' },
                    { label: 'BP Systolic', key: 'bp_systolic', type: 'number' },
                    { label: 'BP Diastolic', key: 'bp_diastolic', type: 'number' },
                    { label: 'Temperature (°C)', key: 'temperature', type: 'number' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input type={f.type} value={postnatalForm[f.key]} onChange={e => setPostnatalForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  ))}
                  {[
                    { label: 'Uterus Involution', key: 'uterus_involution', options: ['normal', 'subinvolution', 'enlarged'] },
                    { label: 'Lochia', key: 'lochia', options: ['normal', 'heavy', 'foul_smelling', 'absent'] },
                    { label: 'Breast Condition', key: 'breast_condition', options: ['normal', 'engorgement', 'mastitis', 'cracked_nipples'] },
                    { label: 'Baby Condition', key: 'baby_condition', options: ['good', 'fair', 'poor'] },
                    { label: 'FP Method', key: 'family_planning_method', options: ['none', 'condom', 'pill', 'injection', 'implant', 'iud', 'sterilization'] },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <select value={postnatalForm[f.key]} onChange={e => setPostnatalForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        {f.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Immunizations Given</label>
                    <input value={postnatalForm.immunizations_given} onChange={e => setPostnatalForm(f => ({ ...f, immunizations_given: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. BCG, Polio" />
                  </div>
                  <div className="flex items-center gap-6 pt-5">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={postnatalForm.breastfeeding} onChange={e => setPostnatalForm(f => ({ ...f, breastfeeding: e.target.checked }))} />Breastfeeding</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={postnatalForm.family_planning_counselled} onChange={e => setPostnatalForm(f => ({ ...f, family_planning_counselled: e.target.checked }))} />FP Counselled</label>
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                    <textarea value={postnatalForm.notes} onChange={e => setPostnatalForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3 flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowPostnatalForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Visit'}</button>
                  </div>
                </form>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Patient', 'Date', 'Days PP', 'BP', 'Lochia', 'Breastfeeding', 'Baby', 'FP Method'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {postnatal.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No postnatal visits recorded</td></tr>}
                  {postnatal.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{v.patients?.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{v.visit_date}</td>
                      <td className="px-4 py-3 text-slate-600">{v.days_postpartum}</td>
                      <td className="px-4 py-3 text-slate-600">{v.bp_systolic && `${v.bp_systolic}/${v.bp_diastolic}`}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{v.lochia}</td>
                      <td className="px-4 py-3">{v.breastfeeding ? <span className="text-green-600 text-xs font-medium">Yes</span> : <span className="text-slate-400 text-xs">No</span>}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{v.baby_condition}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{v.family_planning_method?.replace(/_/g, ' ')}</td>
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
