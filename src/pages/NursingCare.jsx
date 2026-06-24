import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import MARGrid from '../components/MARGrid'
import NursingAssessments from '../components/NursingAssessments'
import { supabase } from '../supabaseClient'
import {
  getPatientFluidBalance,
  recordFluidEntry,
  getPatientCarePlans,
  createCarePlan,
  updateCarePlan,
  createHandoverNote,
  getWardHandovers,
  getPendingTransfers,
  acceptTransfer,
} from '../services/nursingService'

const TABS = [
  { id: 'mar', label: 'MAR' },
  { id: 'fluid', label: 'Fluid Balance' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'careplans', label: 'Care Plans' },
  { id: 'handover', label: 'Handover' },
  { id: 'transfers', label: 'Transfers' },
]

const NursingCare = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('mar')
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [fluidEntries, setFluidEntries] = useState([])
  const [carePlans, setCarePlans] = useState([])
  const [handovers, setHandovers] = useState([])
  const [transfers, setTransfers] = useState([])

  // Fluid balance form
  const [fluidForm, setFluidForm] = useState({ entry_type: 'intake', fluid_type: '', volume_ml: '', route: 'oral' })
  // Care plan form
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planForm, setPlanForm] = useState({ nursing_diagnosis: '', goals: '', interventions: '', evaluation_criteria: '' })
  // Handover form
  const [showHandoverForm, setShowHandoverForm] = useState(false)
  const [handoverForm, setHandoverForm] = useState({
    shift: 'morning', patient_status_summary: '', medications_due: '', pending_tasks: '',
    critical_alerts: '', special_instructions: '',
  })

  useEffect(() => {
    fetchAdmittedPatients()
  }, [])

  useEffect(() => {
    if (selectedPatient) {
      loadPatientNursingData()
    }
  }, [selectedPatient, activeTab])

  const fetchAdmittedPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('admissions')
        .select('*, patients:patient_id ( id, name, patient_id, gender, age )')
        .is('discharge_date', null)
        .order('admission_date', { ascending: false })

      if (error) throw error
      setPatients(data || [])
      if (data?.length > 0) setSelectedPatient(data[0].patients)
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPatientNursingData = async () => {
    if (!selectedPatient) return
    const today = new Date().toISOString().split('T')[0]
    try {
      if (activeTab === 'fluid') {
        const { data } = await getPatientFluidBalance(selectedPatient.id, today)
        setFluidEntries(data || [])
      } else if (activeTab === 'careplans') {
        const { data } = await getPatientCarePlans(selectedPatient.id)
        setCarePlans(data || [])
      } else if (activeTab === 'handover') {
        // Fetch handovers for the ward (simplified — uses first admission's ward)
        const { data } = await getWardHandovers(null, { date: today })
        setHandovers(data || [])
      } else if (activeTab === 'transfers') {
        const { data } = await getPendingTransfers(null)
        setTransfers(data || [])
      }
    } catch (error) {
      console.error('Error loading nursing data:', error)
    }
  }

  const handleRecordFluid = async (e) => {
    e.preventDefault()
    if (!fluidForm.volume_ml || !fluidForm.fluid_type) {
      toast.error('Please fill volume and fluid type')
      return
    }
    try {
      const { data, error } = await recordFluidEntry({
        patient_id: selectedPatient.id,
        entry_type: fluidForm.entry_type,
        fluid_type: fluidForm.fluid_type,
        volume_ml: parseInt(fluidForm.volume_ml),
        route: fluidForm.route,
        recorded_by: user.id,
      })
      if (error) throw error
      setFluidEntries(prev => [...prev, data])
      setFluidForm({ entry_type: 'intake', fluid_type: '', volume_ml: '', route: 'oral' })
      toast.success('Fluid entry recorded')
    } catch (error) {
      toast.error('Failed to record fluid entry')
    }
  }

  const handleCreateCarePlan = async (e) => {
    e.preventDefault()
    try {
      const { data, error } = await createCarePlan({
        patient_id: selectedPatient.id,
        created_by: user.id,
        nursing_diagnosis: planForm.nursing_diagnosis,
        goals: planForm.goals,
        interventions: planForm.interventions,
        evaluation_criteria: planForm.evaluation_criteria,
      })
      if (error) throw error
      setCarePlans(prev => [data, ...prev])
      setShowPlanForm(false)
      setPlanForm({ nursing_diagnosis: '', goals: '', interventions: '', evaluation_criteria: '' })
      toast.success('Care plan created')
    } catch (error) {
      toast.error('Failed to create care plan')
    }
  }

  const handleCreateHandover = async (e) => {
    e.preventDefault()
    try {
      const { data, error } = await createHandoverNote({
        patient_id: selectedPatient.id,
        outgoing_nurse_id: user.id,
        shift: handoverForm.shift,
        patient_status_summary: handoverForm.patient_status_summary,
        medications_due: handoverForm.medications_due,
        pending_tasks: handoverForm.pending_tasks,
        critical_alerts: handoverForm.critical_alerts || null,
        special_instructions: handoverForm.special_instructions || null,
      })
      if (error) throw error
      setHandovers(prev => [data, ...prev])
      setShowHandoverForm(false)
      setHandoverForm({ shift: 'morning', patient_status_summary: '', medications_due: '', pending_tasks: '', critical_alerts: '', special_instructions: '' })
      toast.success('Handover note created')
    } catch (error) {
      toast.error('Failed to create handover')
    }
  }

  const handleAcceptTransfer = async (transferId) => {
    try {
      const { error } = await acceptTransfer(transferId, user.id)
      if (error) throw error
      setTransfers(prev => prev.filter(t => t.id !== transferId))
      toast.success('Transfer accepted')
    } catch (error) {
      toast.error('Failed to accept transfer')
    }
  }

  // Compute fluid balance totals
  const intakeTotal = fluidEntries.filter(e => e.entry_type === 'intake').reduce((sum, e) => sum + (e.volume_ml || 0), 0)
  const outputTotal = fluidEntries.filter(e => e.entry_type === 'output').reduce((sum, e) => sum + (e.volume_ml || 0), 0)

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
        <h1 className="text-xl font-bold text-slate-800">Nursing Care</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Patient Selector Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Admitted Patients</h3>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {patients.map(adm => (
                  <button
                    key={adm.id}
                    type="button"
                    onClick={() => setSelectedPatient(adm.patients)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedPatient?.id === adm.patients?.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-medium">{adm.patients?.name}</div>
                    <div className="text-xs text-slate-500">{adm.patients?.patient_id}</div>
                  </button>
                ))}
                {patients.length === 0 && (
                  <p className="text-xs text-slate-400 py-4 text-center">No admitted patients</p>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-4">
            {selectedPatient ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100">
                {/* Patient Header */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-slate-800">{selectedPatient.name}</h2>
                    <span className="text-xs text-slate-500">{selectedPatient.patient_id} · {selectedPatient.gender} · {selectedPatient.age}y</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 overflow-x-auto">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === tab.id
                          ? 'text-blue-700 border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                      {tab.id === 'transfers' && transfers.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{transfers.length}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {/* MAR Tab */}
                  {activeTab === 'mar' && (
                    <MARGrid patientId={selectedPatient.id} nurseId={user.id} />
                  )}

                  {/* Fluid Balance Tab */}
                  {activeTab === 'fluid' && (
                    <div className="space-y-4">
                      {/* Totals */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <div className="text-xs text-blue-600 font-medium">Intake</div>
                          <div className="text-lg font-bold text-blue-800">{intakeTotal} mL</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                          <div className="text-xs text-amber-600 font-medium">Output</div>
                          <div className="text-lg font-bold text-amber-800">{outputTotal} mL</div>
                        </div>
                        <div className={`rounded-lg p-3 text-center ${intakeTotal - outputTotal >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                          <div className={`text-xs font-medium ${intakeTotal - outputTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>Balance</div>
                          <div className={`text-lg font-bold ${intakeTotal - outputTotal >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                            {intakeTotal - outputTotal >= 0 ? '+' : ''}{intakeTotal - outputTotal} mL
                          </div>
                        </div>
                      </div>

                      {/* Entry Form */}
                      <form onSubmit={handleRecordFluid} className="bg-slate-50 rounded-lg p-3 flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                          <select
                            value={fluidForm.entry_type}
                            onChange={(e) => setFluidForm(prev => ({ ...prev, entry_type: e.target.value }))}
                            className="text-sm border border-slate-200 rounded px-2 py-1.5"
                          >
                            <option value="intake">Intake</option>
                            <option value="output">Output</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Fluid</label>
                          <input
                            type="text"
                            value={fluidForm.fluid_type}
                            onChange={(e) => setFluidForm(prev => ({ ...prev, fluid_type: e.target.value }))}
                            className="text-sm border border-slate-200 rounded px-2 py-1.5 w-40"
                            placeholder="e.g., Water, NS, Urine"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Volume (mL)</label>
                          <input
                            type="number"
                            min={1}
                            value={fluidForm.volume_ml}
                            onChange={(e) => setFluidForm(prev => ({ ...prev, volume_ml: e.target.value }))}
                            className="text-sm border border-slate-200 rounded px-2 py-1.5 w-24"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Route</label>
                          <select
                            value={fluidForm.route}
                            onChange={(e) => setFluidForm(prev => ({ ...prev, route: e.target.value }))}
                            className="text-sm border border-slate-200 rounded px-2 py-1.5"
                          >
                            <option value="oral">Oral</option>
                            <option value="iv">IV</option>
                            <option value="ng_tube">NG Tube</option>
                            <option value="catheter">Catheter</option>
                            <option value="drain">Drain</option>
                          </select>
                        </div>
                        <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                          Record
                        </button>
                      </form>

                      {/* Entries Table */}
                      {fluidEntries.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500">
                              <th className="text-left px-3 py-2">Time</th>
                              <th className="text-left px-3 py-2">Type</th>
                              <th className="text-left px-3 py-2">Fluid</th>
                              <th className="px-3 py-2">Volume</th>
                              <th className="text-left px-3 py-2">Route</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fluidEntries.map(entry => (
                              <tr key={entry.id} className="border-t border-slate-100">
                                <td className="px-3 py-2">{new Date(entry.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded ${entry.entry_type === 'intake' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {entry.entry_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{entry.fluid_type}</td>
                                <td className="px-3 py-2 text-center font-medium">{entry.volume_ml} mL</td>
                                <td className="px-3 py-2">{entry.route}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Assessments Tab */}
                  {activeTab === 'assessments' && (
                    <NursingAssessments
                      patientId={selectedPatient.id}
                      assessedBy={user.id}
                      onSaved={() => {}}
                    />
                  )}

                  {/* Care Plans Tab */}
                  {activeTab === 'careplans' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">Active Care Plans</h3>
                        <button
                          type="button"
                          onClick={() => setShowPlanForm(!showPlanForm)}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          {showPlanForm ? 'Cancel' : '+ New Plan'}
                        </button>
                      </div>

                      {showPlanForm && (
                        <form onSubmit={handleCreateCarePlan} className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-100">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nursing Diagnosis *</label>
                            <input
                              type="text"
                              value={planForm.nursing_diagnosis}
                              onChange={(e) => setPlanForm(prev => ({ ...prev, nursing_diagnosis: e.target.value }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Goals</label>
                            <textarea
                              value={planForm.goals}
                              onChange={(e) => setPlanForm(prev => ({ ...prev, goals: e.target.value }))}
                              rows={2}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Interventions</label>
                            <textarea
                              value={planForm.interventions}
                              onChange={(e) => setPlanForm(prev => ({ ...prev, interventions: e.target.value }))}
                              rows={2}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                            />
                          </div>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                            Create Care Plan
                          </button>
                        </form>
                      )}

                      {carePlans.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">No active care plans</p>
                      ) : (
                        <div className="space-y-3">
                          {carePlans.map(plan => (
                            <div key={plan.id} className="border border-slate-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-slate-800">{plan.nursing_diagnosis}</h4>
                                <span className={`px-2 py-0.5 text-xs rounded ${plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {plan.status}
                                </span>
                              </div>
                              {plan.goals && <p className="text-xs text-slate-600"><span className="font-medium">Goals:</span> {plan.goals}</p>}
                              {plan.interventions && <p className="text-xs text-slate-600 mt-1"><span className="font-medium">Interventions:</span> {plan.interventions}</p>}
                              <p className="text-xs text-slate-400 mt-2">Created: {new Date(plan.created_at).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Handover Tab */}
                  {activeTab === 'handover' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">Shift Handover</h3>
                        <button
                          type="button"
                          onClick={() => setShowHandoverForm(!showHandoverForm)}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          {showHandoverForm ? 'Cancel' : '+ Create Handover'}
                        </button>
                      </div>

                      {showHandoverForm && (
                        <form onSubmit={handleCreateHandover} className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-100">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Shift</label>
                              <select
                                value={handoverForm.shift}
                                onChange={(e) => setHandoverForm(prev => ({ ...prev, shift: e.target.value }))}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                              >
                                <option value="morning">Morning (7am-3pm)</option>
                                <option value="afternoon">Afternoon (3pm-11pm)</option>
                                <option value="night">Night (11pm-7am)</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Patient Status Summary *</label>
                            <textarea
                              value={handoverForm.patient_status_summary}
                              onChange={(e) => setHandoverForm(prev => ({ ...prev, patient_status_summary: e.target.value }))}
                              rows={2}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Medications Due</label>
                            <textarea
                              value={handoverForm.medications_due}
                              onChange={(e) => setHandoverForm(prev => ({ ...prev, medications_due: e.target.value }))}
                              rows={2}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Pending Tasks</label>
                            <textarea
                              value={handoverForm.pending_tasks}
                              onChange={(e) => setHandoverForm(prev => ({ ...prev, pending_tasks: e.target.value }))}
                              rows={2}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Critical Alerts</label>
                            <input
                              type="text"
                              value={handoverForm.critical_alerts}
                              onChange={(e) => setHandoverForm(prev => ({ ...prev, critical_alerts: e.target.value }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                              placeholder="Any critical alerts for incoming nurse..."
                            />
                          </div>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                            Submit Handover
                          </button>
                        </form>
                      )}

                      {handovers.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">No handover notes today</p>
                      ) : (
                        <div className="space-y-3">
                          {handovers.map(h => (
                            <div key={h.id} className="border border-slate-200 rounded-lg p-3 text-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">{h.shift}</span>
                                <span className="text-xs text-slate-500">{h.outgoing?.full_name} → {h.incoming?.full_name || 'Pending'}</span>
                              </div>
                              <p className="text-slate-700">{h.patient_status_summary}</p>
                              {h.critical_alerts && (
                                <p className="text-red-600 text-xs mt-1 font-medium">⚠️ {h.critical_alerts}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Transfers Tab */}
                  {activeTab === 'transfers' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-slate-700">Pending Transfers</h3>
                      {transfers.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">No pending transfers</p>
                      ) : (
                        <div className="space-y-3">
                          {transfers.map(t => (
                            <div key={t.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium text-slate-800">{t.patients?.name} ({t.patients?.patient_id})</div>
                                <div className="text-xs text-slate-600 mt-0.5">
                                  Reason: {t.transfer_reason} · By: {t.initiating_nurse?.full_name}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  Requested: {new Date(t.requested_at).toLocaleString()}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAcceptTransfer(t.id)}
                                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                              >
                                Accept Transfer
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
                Select a patient to view nursing care
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default NursingCare
