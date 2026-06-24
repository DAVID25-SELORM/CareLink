import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'

const Discharge = () => {
  const { user } = useAuth()
  const [admissions, setAdmissions] = useState([])
  const [discharges, setDischarges] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [selectedAdmission, setSelectedAdmission] = useState(null)
  const [formData, setFormData] = useState({
    final_diagnosis: '',
    icd10_code: '',
    discharge_instructions: '',
    medications_at_discharge: '',
    follow_up_date: '',
    follow_up_notes: '',
    discharge_condition: 'improved',
    discharge_type: 'regular'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [activeRes, dischargedRes] = await Promise.all([
        supabase
          .from('admissions')
          .select(`
            *,
            patients:patient_id(id, name, patient_id, phone, gender, age),
            wards:ward_id(name),
            beds:bed_id(bed_number)
          `)
          .eq('status', 'admitted')
          .order('created_at', { ascending: false }),
        supabase
          .from('discharge_summaries')
          .select(`
            *,
            patients:patient_id(name, patient_id),
            admissions:admission_id(created_at, diagnosis)
          `)
          .order('created_at', { ascending: false })
          .limit(50)
      ])

      setAdmissions(activeRes.data || [])
      setDischarges(dischargedRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const openDischargeForm = async (admission) => {
    setSelectedAdmission(admission)

    // Pre-populate diagnosis from encounter clinical record
    let finalDiagnosis = admission.diagnosis || ''
    let icd10Code = ''

    if (admission.encounter_id) {
      const { data: diagnosesData } = await supabase
        .from('diagnoses')
        .select('diagnosis_code, diagnosis_name, diagnosis_type')
        .eq('encounter_id', admission.encounter_id)
        .order('diagnosis_type', { ascending: true })

      if (diagnosesData?.length) {
        const primary = diagnosesData.find(d => d.diagnosis_type === 'primary') || diagnosesData[0]
        finalDiagnosis = primary.diagnosis_name || primary.diagnosis_code || finalDiagnosis
        icd10Code = primary.diagnosis_code || ''
      }
    }

    setFormData({
      final_diagnosis: finalDiagnosis,
      icd10_code: icd10Code,
      discharge_instructions: '',
      medications_at_discharge: '',
      follow_up_date: '',
      follow_up_notes: '',
      discharge_condition: 'improved',
      discharge_type: 'regular'
    })
  }

  const submitDischarge = async (e) => {
    e.preventDefault()
    if (!selectedAdmission) return

    try {
      // 1. Create discharge summary
      const { data: summary, error: summaryError } = await supabase
        .from('discharge_summaries')
        .insert([{
          patient_id: selectedAdmission.patient_id,
          admission_id: selectedAdmission.id,
          encounter_id: selectedAdmission.encounter_id || null,
          ...formData,
          discharged_by: user.id,
          discharge_date: new Date().toISOString()
        }])
        .select()
        .single()

      if (summaryError) throw summaryError

      // 2. Update admission status
      const { error: admError } = await supabase
        .from('admissions')
        .update({
          status: 'discharged',
          discharge_date: new Date().toISOString()
        })
        .eq('id', selectedAdmission.id)

      if (admError) throw admError

      // 3. Free the bed
      if (selectedAdmission.bed_id) {
        await supabase
          .from('beds')
          .update({
            status: 'available',
            current_patient_id: null,
            assigned_at: null
          })
          .eq('id', selectedAdmission.bed_id)
      }

      // 4. Close encounter if linked
      if (selectedAdmission.encounter_id) {
        await supabase
          .from('encounters')
          .update({ status: 'completed', ended_at: new Date().toISOString() })
          .eq('id', selectedAdmission.encounter_id)
      }

      // 5. Create follow-up appointment if a date was specified
      if (formData.follow_up_date) {
        await supabase.from('appointments').insert({
          patient_id: selectedAdmission.patient_id,
          appointment_date: formData.follow_up_date,
          appointment_time: '09:00',
          reason: `Follow-up: ${formData.final_diagnosis}. ${formData.follow_up_notes || ''}`.trim(),
          status: 'scheduled',
          appointment_type: 'follow_up',
          notes: `Discharged on ${new Date().toLocaleDateString()}. ${formData.follow_up_notes || ''}`.trim(),
        })
      }

      await logAuditEvent({
        user,
        action: 'discharge_patient',
        tableName: 'discharge_summaries',
        recordId: summary.id,
        newValues: { ...formData, patient_id: selectedAdmission.patient_id }
      })

      toast.success('Patient discharged successfully!')
      setSelectedAdmission(null)
      fetchData()
    } catch (error) {
      console.error('Error discharging patient:', error)
      toast.error('Failed to discharge patient')
    }
  }

  const daysAdmitted = (admission) => {
    const days = Math.ceil((new Date() - new Date(admission.created_at)) / (1000 * 60 * 60 * 24))
    return days
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Discharge Summary</h1>
          <p className="text-slate-500">Manage patient discharges and summaries</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-sm text-slate-500">Active Admissions</p>
            <p className="text-3xl font-bold text-blue-600">{admissions.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-sm text-slate-500">Recent Discharges</p>
            <p className="text-3xl font-bold text-green-600">{discharges.length}</p>
          </div>
        </div>

        <div className="flex gap-2 border-b">
          {[
            { id: 'active', label: `Active (${admissions.length})` },
            { id: 'discharged', label: `Discharged (${discharges.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'active' && (
          <div className="bg-white rounded-xl shadow-sm border">
            {admissions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No active admissions</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Ward / Bed</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Diagnosis</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Days</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {admissions.map(adm => (
                      <tr key={adm.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium">
                          {adm.patients?.name}
                          <span className="block text-xs text-slate-400">{adm.patients?.patient_id}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {adm.wards?.name} / Bed {adm.beds?.bed_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{adm.diagnosis || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={daysAdmitted(adm) > 7 ? 'text-red-600 font-bold' : ''}>
                            {daysAdmitted(adm)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openDischargeForm(adm)}
                            className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700"
                          >
                            Discharge
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'discharged' && (
          <div className="bg-white rounded-xl shadow-sm border">
            {discharges.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No discharge records</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Diagnosis</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Condition</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Discharged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {discharges.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium">{d.patients?.name}</td>
                        <td className="px-4 py-3 text-sm">{d.final_diagnosis || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            d.discharge_condition === 'improved' ? 'bg-green-100 text-green-700' :
                            d.discharge_condition === 'unchanged' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {d.discharge_condition}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {d.discharge_date ? new Date(d.discharge_date).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {selectedAdmission && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-2">
                Discharge — {selectedAdmission.patients?.name}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {selectedAdmission.wards?.name} / Bed {selectedAdmission.beds?.bed_number} — Admitted {daysAdmitted(selectedAdmission)} day(s)
              </p>

              <form onSubmit={submitDischarge} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Final Diagnosis *</label>
                    <input
                      required
                      type="text"
                      value={formData.final_diagnosis}
                      onChange={(e) => setFormData({...formData, final_diagnosis: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ICD-10 Code</label>
                    <input
                      type="text"
                      value={formData.icd10_code}
                      onChange={(e) => setFormData({...formData, icd10_code: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. J18.9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Discharge Instructions *</label>
                  <textarea
                    required
                    value={formData.discharge_instructions}
                    onChange={(e) => setFormData({...formData, discharge_instructions: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Activity restrictions, diet, wound care, warning signs..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Medications at Discharge</label>
                  <textarea
                    value={formData.medications_at_discharge}
                    onChange={(e) => setFormData({...formData, medications_at_discharge: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="List medications with dosages..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      value={formData.follow_up_date}
                      onChange={(e) => setFormData({...formData, follow_up_date: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Discharge Condition</label>
                    <select
                      value={formData.discharge_condition}
                      onChange={(e) => setFormData({...formData, discharge_condition: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="improved">Improved</option>
                      <option value="unchanged">Unchanged</option>
                      <option value="deteriorated">Deteriorated</option>
                      <option value="cured">Cured</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Discharge Type</label>
                  <select
                    value={formData.discharge_type}
                    onChange={(e) => setFormData({...formData, discharge_type: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="against_advice">Against Medical Advice</option>
                    <option value="transfer">Transfer to Another Facility</option>
                    <option value="deceased">Deceased</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Notes</label>
                  <textarea
                    value={formData.follow_up_notes}
                    onChange={(e) => setFormData({...formData, follow_up_notes: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Clinic to follow up, specialist referral..."
                  />
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                    Complete Discharge
                  </button>
                  <button type="button" onClick={() => setSelectedAdmission(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Discharge
