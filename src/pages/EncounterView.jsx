import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import VitalsForm from '../components/VitalsForm'
import DiagnosisPicker from '../components/DiagnosisPicker'
import SOAPNotesEditor from '../components/SOAPNotesEditor'
import ClinicalOrdersPanel from '../components/ClinicalOrdersPanel'
import ProblemList from '../components/ProblemList'
import {
  getEncounter,
  getEncounterVitals,
  getEncounterDiagnoses,
  getEncounterNotes,
  getPatientAllergies,
  addDiagnosis,
  updateEncounterStatus,
} from '../services/encounterService'

const TABS = [
  { id: 'vitals', label: 'Vitals', icon: '❤️' },
  { id: 'notes', label: 'SOAP Notes', icon: '📝' },
  { id: 'diagnoses', label: 'Diagnoses', icon: '🩺' },
  { id: 'orders', label: 'Orders', icon: '📋' },
]

const EncounterView = () => {
  const { encounterId } = useParams()
  const navigate = useNavigate()
  const { user, userRole } = useAuth()

  const [encounter, setEncounter] = useState(null)
  const [vitals, setVitals] = useState([])
  const [diagnoses, setDiagnoses] = useState([])
  const [notes, setNotes] = useState([])
  const [allergies, setAllergies] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('vitals')
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (encounterId) loadEncounterData()
  }, [encounterId])

  const loadEncounterData = async () => {
    try {
      const [encRes, vitalsRes, diagRes, notesRes] = await Promise.all([
        getEncounter(encounterId),
        getEncounterVitals(encounterId),
        getEncounterDiagnoses(encounterId),
        getEncounterNotes(encounterId),
      ])

      if (encRes.error) throw encRes.error
      setEncounter(encRes.data)
      setVitals(vitalsRes.data || [])
      setDiagnoses(diagRes.data || [])
      setNotes(notesRes.data || [])

      // Load allergies for patient
      if (encRes.data?.patient_id) {
        const allergyRes = await getPatientAllergies(encRes.data.patient_id)
        setAllergies(allergyRes.data || [])
      }
    } catch (error) {
      console.error('Error loading encounter:', error)
      toast.error('Failed to load encounter')
    } finally {
      setLoading(false)
    }
  }

  const handleAddDiagnosis = async (diagData) => {
    try {
      const { data, error } = await addDiagnosis({
        ...diagData,
        patient_id: encounter.patient_id,
        diagnosed_by: user.id,
      })
      if (error) throw error
      setDiagnoses(prev => [...prev, data])
      toast.success('Diagnosis added')
    } catch (error) {
      console.error('Error adding diagnosis:', error)
      toast.error('Failed to add diagnosis')
    }
  }

  const handleCompleteEncounter = async () => {
    if (!diagnoses.some(d => d.diagnosis_type === 'primary')) {
      toast.error('At least one primary diagnosis is required before completing')
      return
    }
    setCompleting(true)
    try {
      const { error } = await updateEncounterStatus(encounterId, 'completed')
      if (error) throw error
      toast.success('Encounter completed')
      navigate('/doctor-dashboard')
    } catch (error) {
      toast.error('Failed to complete encounter')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!encounter) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-500">Encounter not found</p>
          <button onClick={() => navigate(-1)} className="mt-2 text-blue-600 text-sm hover:underline">Go back</button>
        </div>
      </DashboardLayout>
    )
  }

  const patient = encounter.patients
  const isActive = encounter.status === 'in_progress' || encounter.status === 'registered'
  const isDoctor = userRole === 'admin' || userRole === 'doctor'

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-lg font-bold text-slate-800">{patient?.name}</h1>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  encounter.status === 'in_progress' ? 'bg-green-100 text-green-700' :
                  encounter.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {encounter.status.replace('_', ' ')}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  encounter.encounter_type === 'emergency' ? 'bg-red-100 text-red-700' :
                  encounter.encounter_type === 'inpatient' ? 'bg-purple-100 text-purple-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {encounter.encounter_type}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                <span>ID: {patient?.patient_id}</span>
                <span>{patient?.gender} · {patient?.age}y</span>
                {patient?.blood_group && <span>Blood: {patient.blood_group}</span>}
                {encounter.department && <span>Dept: {encounter.department}</span>}
                <span>Started: {new Date(encounter.started_at).toLocaleString()}</span>
              </div>
              {encounter.chief_complaint && (
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium">Chief Complaint:</span> {encounter.chief_complaint}
                </p>
              )}
              {encounter.nhis_cc_code && (
                <div className="mt-2 inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1">
                  <span className="text-xs text-green-600 font-medium">NHIS CC Code</span>
                  <span className="font-mono font-bold text-green-800 tracking-wider">{encounter.nhis_cc_code}</span>
                  {encounter.nhis_member_number && (
                    <span className="text-xs text-green-600">· {encounter.nhis_member_number}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {isActive && isDoctor && (
                <button
                  onClick={handleCompleteEncounter}
                  disabled={completing}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {completing ? 'Completing...' : 'Complete Encounter'}
                </button>
              )}
            </div>
          </div>

          {/* Allergy Banner */}
          {allergies.length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-red-600 font-bold text-sm">⚠️ ALLERGIES:</span>
              <span className="text-sm text-red-700">
                {allergies.map(a => a.allergen_name).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Main Content: Tabs + Problem List Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Panel */}
          <div className="lg:col-span-3 space-y-4">
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="flex border-b border-slate-100">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* Vitals Tab */}
                {activeTab === 'vitals' && (
                  <div className="space-y-4">
                    {isActive && (userRole === 'nurse' || userRole === 'doctor' || userRole === 'admin') && (
                      <VitalsForm
                        patientId={encounter.patient_id}
                        encounterId={encounterId}
                        recordedBy={user.id}
                        existingVitals={vitals}
                        onSaved={(newVitals) => setVitals(prev => [newVitals, ...prev])}
                      />
                    )}

                    {/* Vitals History */}
                    {vitals.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Vitals History</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500">
                                <th className="text-left px-3 py-2">Time</th>
                                <th className="px-3 py-2">Temp</th>
                                <th className="px-3 py-2">BP</th>
                                <th className="px-3 py-2">Pulse</th>
                                <th className="px-3 py-2">RR</th>
                                <th className="px-3 py-2">SpO₂</th>
                                <th className="px-3 py-2">Weight</th>
                                <th className="px-3 py-2">BMI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vitals.map(v => (
                                <tr key={v.id} className="border-t border-slate-100">
                                  <td className="px-3 py-2 text-slate-600">
                                    {new Date(v.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="px-3 py-2 text-center">{v.temperature_c || '-'}</td>
                                  <td className="px-3 py-2 text-center">
                                    {v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-center">{v.pulse_rate || '-'}</td>
                                  <td className="px-3 py-2 text-center">{v.respiratory_rate || '-'}</td>
                                  <td className="px-3 py-2 text-center">{v.spo2 || '-'}</td>
                                  <td className="px-3 py-2 text-center">{v.weight_kg || '-'}</td>
                                  <td className="px-3 py-2 text-center">{v.bmi || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SOAP Notes Tab */}
                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    {isActive && isDoctor && (
                      <SOAPNotesEditor
                        encounterId={encounterId}
                        authorId={user.id}
                        existingNote={notes[0]}
                        onSaved={(saved) => setNotes(prev => {
                          const idx = prev.findIndex(n => n.id === saved.id)
                          if (idx >= 0) { const copy = [...prev]; copy[idx] = saved; return copy }
                          return [saved, ...prev]
                        })}
                      />
                    )}

                    {/* Previous Notes */}
                    {notes.length > (isActive && isDoctor ? 1 : 0) && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700">Previous Notes</h3>
                        {notes.slice(isActive && isDoctor ? 1 : 0).map(n => (
                          <div key={n.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                              <span>{n.author?.full_name}</span>
                              <span>·</span>
                              <span>{new Date(n.created_at).toLocaleString()}</span>
                            </div>
                            {n.subjective && <div><span className="font-semibold text-blue-700">S:</span> {n.subjective}</div>}
                            {n.objective && <div><span className="font-semibold text-green-700">O:</span> {n.objective}</div>}
                            {n.assessment && <div><span className="font-semibold text-amber-700">A:</span> {n.assessment}</div>}
                            {n.plan && <div><span className="font-semibold text-purple-700">P:</span> {n.plan}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Diagnoses Tab */}
                {activeTab === 'diagnoses' && (
                  <div className="space-y-4">
                    {isActive && isDoctor && (
                      <DiagnosisPicker
                        encounterId={encounterId}
                        selectedDiagnoses={diagnoses}
                        onSelect={handleAddDiagnosis}
                      />
                    )}
                    {!isActive && diagnoses.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">No diagnoses recorded</p>
                    )}
                  </div>
                )}

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                  <ClinicalOrdersPanel
                    encounterId={encounterId}
                    patientId={encounter.patient_id}
                    orderedBy={isDoctor ? user.id : null}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Problem List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <ProblemList
                patientId={encounter.patient_id}
                diagnosedBy={isDoctor ? user.id : null}
                compact
              />
            </div>

            {/* Allergies */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Allergies</h4>
              {allergies.length === 0 ? (
                <p className="text-xs text-green-600">No known allergies</p>
              ) : (
                <div className="space-y-1">
                  {allergies.map(a => (
                    <div key={a.id} className="text-xs bg-red-50 rounded px-2 py-1.5 border border-red-100">
                      <div className="font-medium text-red-700">{a.allergen_name}</div>
                      {a.reaction && <div className="text-red-600">{a.reaction}</div>}
                      <span className={`inline-block mt-0.5 px-1 rounded text-xs ${
                        a.severity === 'severe' || a.severity === 'life_threatening'
                          ? 'bg-red-200 text-red-800'
                          : 'bg-amber-100 text-amber-700'
                      }`}>{a.severity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Encounter Summary</h4>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Vitals recorded</span>
                  <span className="font-medium">{vitals.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Diagnoses</span>
                  <span className="font-medium">{diagnoses.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Clinical notes</span>
                  <span className="font-medium">{notes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Doctor</span>
                  <span className="font-medium">{encounter.doctor?.full_name || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default EncounterView
