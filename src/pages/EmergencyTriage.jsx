import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'

/**
 * Emergency & Triage System
 * Red/Yellow/Green severity classification
 * Author: David Gabion Selorm
 */

const EmergencyTriage = () => {
  const { user } = useAuth()
  const [patients, setPatients] = useState([])
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    patient_id: '',
    chief_complaint: '',
    vital_signs: {
      blood_pressure: '',
      heart_rate: '',
      respiratory_rate: '',
      temperature: '',
      oxygen_saturation: ''
    },
    severity: 'yellow',
    pain_score: '0',
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [patientsData, assessmentsData] = await Promise.all([
      supabase.from('patients').select('*').order('name'),
      supabase.from('triage_assessments')
        .select('*, patients(name, patient_id, phone), users(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(50)
    ])
    setPatients(patientsData.data || [])
    setAssessments(assessmentsData.data || [])
    setLoading(false)
  }

  const submitAssessment = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('triage_assessments').insert([{
        ...formData,
        assessed_by: user.id
      }])

      if (error) throw error

      // Create notification for high-severity cases
      if (formData.severity === 'red') {
        await supabase.from('notifications').insert([{
          user_id: user.id,
          title: 'Critical Patient Triaged',
          message: `RED severity: ${formData.chief_complaint}`,
          type: 'urgent_referral',
          priority: 'urgent'
        }])
      }

      toast.success('Triage assessment completed!')
      setShowForm(false)
      setFormData({ patient_id: '', chief_complaint: '', vital_signs: { blood_pressure: '', heart_rate: '', respiratory_rate: '', temperature: '', oxygen_saturation: '' }, severity: 'yellow', pain_score: '0', notes: '' })
      fetchData()
    } catch (error) {
      toast.error('Failed to submit assessment')
    }
  }

  const severityConfig = {
    red: { label: 'RED - Critical', color: 'bg-red-600 text-white', description: 'Life-threatening, immediate attention' },
    yellow: { label: 'YELLOW - Urgent', color: 'bg-yellow-500 text-black', description: 'Serious, needs prompt care' },
    green: { label: 'GREEN - Non-urgent', color: 'bg-green-600 text-white', description: 'Stable, can wait' }
  }

  const redCases = assessments.filter(a => a.severity === 'red')
  const yellowCases = assessments.filter(a => a.severity === 'yellow')
  const greenCases = assessments.filter(a => a.severity === 'green')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Emergency & Triage</h1>
            <p className="text-gray-600">Patient severity assessment & prioritization</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
            🚨 New Triage
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-red-100 text-sm">Critical (RED)</h4>
                <h2 className="text-5xl font-bold mt-2">{redCases.length}</h2>
                <p className="text-red-100 text-xs mt-1">Immediate attention</p>
              </div>
              <div className="text-6xl opacity-20">🚨</div>
            </div>
          </div>
          <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-yellow-100 text-sm">Urgent (YELLOW)</h4>
                <h2 className="text-5xl font-bold mt-2">{yellowCases.length}</h2>
                <p className="text-yellow-100 text-xs mt-1">Prompt care needed</p>
              </div>
              <div className="text-6xl opacity-20">⚠️</div>
            </div>
          </div>
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-green-100 text-sm">Non-urgent (GREEN)</h4>
                <h2 className="text-5xl font-bold mt-2">{greenCases.length}</h2>
                <p className="text-green-100 text-xs mt-1">Can wait</p>
              </div>
              <div className="text-6xl opacity-20">✅</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Recent Assessments</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Complaint</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vitals</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assessed By</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map(assessment => (
                  <tr key={assessment.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{new Date(assessment.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{assessment.patients?.name}</div>
                      <div className="text-sm text-gray-500">{assessment.patients?.patient_id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{assessment.chief_complaint}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>BP: {assessment.vital_signs?.blood_pressure || 'N/A'}</div>
                      <div>HR: {assessment.vital_signs?.heart_rate || 'N/A'}</div>
                      <div>Temp: {assessment.vital_signs?.temperature || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${severityConfig[assessment.severity].color}`}>
                        {assessment.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{assessment.users?.full_name || assessment.users?.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
              <h3 className="text-xl font-bold mb-4">Emergency Triage Assessment</h3>
              <form onSubmit={submitAssessment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Patient</label>
                  <select required value={formData.patient_id} onChange={(e) => setFormData({...formData, patient_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                    <option value="">Select Patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.patient_id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Chief Complaint</label>
                  <textarea required value={formData.chief_complaint} onChange={(e) => setFormData({...formData, chief_complaint: e.target.value})} className="w-full px-4 py-2 border rounded-lg" rows="2" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Blood Pressure</label>
                    <input type="text" placeholder="120/80" value={formData.vital_signs.blood_pressure} onChange={(e) => setFormData({...formData, vital_signs: {...formData.vital_signs, blood_pressure: e.target.value}})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Heart Rate</label>
                    <input type="text" placeholder="72 bpm" value={formData.vital_signs.heart_rate} onChange={(e) => setFormData({...formData, vital_signs: {...formData.vital_signs, heart_rate: e.target.value}})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Resp. Rate</label>
                    <input type="text" placeholder="16" value={formData.vital_signs.respiratory_rate} onChange={(e) => setFormData({...formData, vital_signs: {...formData.vital_signs, respiratory_rate: e.target.value}})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Temperature</label>
                    <input type="text" placeholder="37°C" value={formData.vital_signs.temperature} onChange={(e) => setFormData({...formData, vital_signs: {...formData.vital_signs, temperature: e.target.value}})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">O2 Saturation</label>
                    <input type="text" placeholder="98%" value={formData.vital_signs.oxygen_saturation} onChange={(e) => setFormData({...formData, vital_signs: {...formData.vital_signs, oxygen_saturation: e.target.value}})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Pain Score (0-10)</label>
                    <input type="number" min="0" max="10" value={formData.pain_score} onChange={(e) => setFormData({...formData, pain_score: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Severity Level</label>
                  <div className="space-y-2">
                    {Object.entries(severityConfig).map(([key, config]) => (
                      <label key={key} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="severity" value={key} checked={formData.severity === key} onChange={(e) => setFormData({...formData, severity: e.target.value})} className="mr-3" />
                        <div>
                          <div className={`inline-block px-2 py-1 rounded text-xs font-bold ${config.color} mb-1`}>{config.label}</div>
                          <div className="text-sm text-gray-600">{config.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Additional Notes</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full px-4 py-2 border rounded-lg" rows="3" />
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">Submit Assessment</button>
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default EmergencyTriage
