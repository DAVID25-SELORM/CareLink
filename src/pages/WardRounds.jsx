import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { createWardRound, getWardRoundsForDate } from '../services/nursingService'

const WardRounds = () => {
  const { user, userRole } = useAuth()
  const [wards, setWards] = useState([])
  const [selectedWard, setSelectedWard] = useState(null)
  const [rounds, setRounds] = useState([])
  const [admittedPatients, setAdmittedPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [encounters, setEncounters] = useState([])
  const [form, setForm] = useState({
    patient_id: '',
    encounter_id: '',
    clinical_findings: '',
    plan: '',
    orders: '',
    notes: '',
  })

  useEffect(() => {
    fetchWards()
  }, [])

  useEffect(() => {
    if (selectedWard) {
      fetchRoundsAndPatients()
    }
  }, [selectedWard, date])

  const fetchWards = async () => {
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setWards(data || [])
      if (data?.length > 0) setSelectedWard(data[0])
    } catch (error) {
      console.error('Error fetching wards:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoundsAndPatients = async () => {
    try {
      const [roundsRes, patientsRes, encountersRes] = await Promise.all([
        getWardRoundsForDate(selectedWard.id, date),
        supabase
          .from('admissions')
          .select('*, patients:patient_id ( id, name, patient_id, gender, age )')
          .eq('ward_id', selectedWard.id)
          .is('discharge_date', null),
        supabase
          .from('encounters')
          .select('id, patient_id, encounter_type, chief_complaint, started_at, patients:patient_id(name)')
          .in('status', ['registered', 'in_progress'])
          .order('started_at', { ascending: false })
          .limit(50)
      ])

      setRounds(roundsRes.data || [])
      setAdmittedPatients(patientsRes.data || [])
      setEncounters(encountersRes.data || [])
    } catch (error) {
      console.error('Error fetching ward data:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patient_id || !form.clinical_findings) {
      toast.error('Please select a patient and enter clinical findings')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await createWardRound({
        patient_id: form.patient_id,
        doctor_id: user.id,
        ward_id: selectedWard.id,
        encounter_id: form.encounter_id || null,
        clinical_findings: form.clinical_findings,
        plan: form.plan || null,
        orders: form.orders || null,
        notes: form.notes || null,
      })
      if (error) throw error
      setRounds(prev => [...prev, data])
      setShowForm(false)
      setForm({ patient_id: '', encounter_id: '', clinical_findings: '', plan: '', orders: '', notes: '' })
      toast.success('Ward round recorded')
    } catch (error) {
      console.error('Error creating ward round:', error)
      toast.error('Failed to record ward round')
    } finally {
      setSaving(false)
    }
  }

  // Track which patients have been seen today
  const seenPatientIds = new Set(rounds.map(r => r.patient_id))

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Ward Rounds</h1>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {(userRole === 'doctor' || userRole === 'admin') && (
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showForm ? 'Cancel' : '+ Record Round'}
              </button>
            )}
          </div>
        </div>

        {/* Ward Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {wards.map(ward => (
            <button
              key={ward.id}
              type="button"
              onClick={() => setSelectedWard(ward)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedWard?.id === ward.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ward.name}
              <span className="ml-1.5 text-xs opacity-70">({ward.total_beds || 0} beds)</span>
            </button>
          ))}
        </div>

        {/* New Round Form */}
        {showForm && selectedWard && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Record Ward Round — {selectedWard.name}</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Patient *</label>
              <select
                value={form.patient_id}
                onChange={(e) => setForm(prev => ({ ...prev, patient_id: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              >
                <option value="">Select patient...</option>
                {admittedPatients.map(adm => (
                  <option key={adm.patients?.id} value={adm.patients?.id}>
                    {adm.patients?.name} ({adm.patients?.patient_id})
                    {seenPatientIds.has(adm.patients?.id) ? ' ✓ Seen' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Encounter (Visit)</label>
              <select
                value={form.encounter_id}
                onChange={(e) => {
                  const enc = encounters.find(en => en.id === e.target.value)
                  setForm(prev => ({ ...prev, encounter_id: e.target.value, patient_id: enc?.patient_id || prev.patient_id }))
                }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">No encounter (standalone)</option>
                {encounters.map(enc => (
                  <option key={enc.id} value={enc.id}>
                    {enc.patients?.name} — {enc.encounter_type} — {new Date(enc.started_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Clinical Findings *</label>
              <textarea
                value={form.clinical_findings}
                onChange={(e) => setForm(prev => ({ ...prev, clinical_findings: e.target.value }))}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Examination findings, progress notes..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                <textarea
                  value={form.plan}
                  onChange={(e) => setForm(prev => ({ ...prev, plan: e.target.value }))}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="Management plan..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Orders</label>
                <textarea
                  value={form.orders}
                  onChange={(e) => setForm(prev => ({ ...prev, orders: e.target.value }))}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="New orders (labs, imaging, meds)..."
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Ward Round'}
            </button>
          </form>
        )}

        {/* Patient List with Round Status */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">
              {selectedWard?.name} — {admittedPatients.length} patients
              <span className="ml-2 text-xs font-normal text-slate-500">
                ({seenPatientIds.size} seen today)
              </span>
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {admittedPatients.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-400 text-center">No patients in this ward</div>
            ) : (
              admittedPatients.map(adm => {
                const patientRounds = rounds.filter(r => r.patient_id === adm.patients?.id)
                const seen = patientRounds.length > 0

                return (
                  <div key={adm.id} className={`px-4 py-3 ${seen ? 'bg-green-50/50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          seen ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {seen ? '✓' : '·'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">{adm.patients?.name}</div>
                          <div className="text-xs text-slate-500">
                            {adm.patients?.patient_id} · {adm.patients?.gender} · {adm.patients?.age}y
                            · Admitted: {new Date(adm.admission_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {!seen && (userRole === 'doctor' || userRole === 'admin') && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, patient_id: adm.patients?.id }))
                            setShowForm(true)
                          }}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Start Round
                        </button>
                      )}
                    </div>

                    {/* Show round notes if seen */}
                    {patientRounds.map(round => (
                      <div key={round.id} className="ml-11 mt-2 bg-white rounded-lg border border-slate-100 p-2 text-xs text-slate-600">
                        <div className="flex items-center gap-2 text-slate-500 mb-1">
                          <span>{round.doctor?.full_name}</span>
                          <span>·</span>
                          <span>{new Date(round.round_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p>{round.clinical_findings}</p>
                        {round.plan && <p className="mt-1"><span className="font-medium">Plan:</span> {round.plan}</p>}
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default WardRounds
