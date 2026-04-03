import { useState, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'

/**
 * Nurse Dashboard Page
 * Specialized interface for nurses to manage patient care
 * Includes vitals recording, medication administration, and patient notes
 * Author: David Gabion Selorm
 */

const NurseDashboard = () => {
  const { user } = useAuth()
  const [nurseInfo, setNurseInfo] = useState(null)
  const [activeTab, setActiveTab] = useState('vitals')
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showVitalsModal, setShowVitalsModal] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [showAdministerModal, setShowAdministerModal] = useState(false)
  const [recentVitals, setRecentVitals] = useState([])
  const [medications, setMedications] = useState([])
  const [nurseNotes, setNurseNotes] = useState([])

  const [vitalsForm, setVitalsForm] = useState({
    temperature: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    heart_rate: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    weight: '',
    height: '',
    notes: ''
  })

  const [noteForm, setNoteForm] = useState({
    note_type: 'general',
    content: '',
    priority: 'normal'
  })

  useEffect(() => {
    fetchNurseInfo()
    fetchPatients()
    fetchRecentVitals()
    fetchMedications()
    fetchNurseNotes()
  }, [user])

  const fetchNurseInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setNurseInfo(data)
    } catch (error) {
      console.error('Error fetching nurse info:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setPatients(data || [])
    } catch (error) {
      console.error('Error fetching patients:', error)
      toast.error('Failed to load patients')
    }
  }

  const fetchRecentVitals = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_vitals')
        .select(`
          *,
          patients (name, age, gender)
        `)
        .order('recorded_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentVitals(data || [])
    } catch (error) {
      console.error('Error fetching vitals:', error)
    }
  }

  const fetchMedications = async () => {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patients (name, age, gender)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setMedications(data || [])
    } catch (error) {
      console.error('Error fetching medications:', error)
    }
  }

  const fetchNurseNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('nurse_notes')
        .select(`
          *,
          patients (name, age, gender)
        `)
        .eq('nurse_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(15)

      if (error) throw error
      setNurseNotes(data || [])
    } catch (error) {
      console.error('Error fetching nurse notes:', error)
    }
  }

  const handleRecordVitals = async (e) => {
    e.preventDefault()

    if (!selectedPatient) {
      toast.error('Please select a patient')
      return
    }

    try {
      const vitalsData = {
        patient_id: selectedPatient.id,
        nurse_id: user.id,
        nurse_name: nurseInfo?.full_name || user.email,
        temperature: parseFloat(vitalsForm.temperature) || null,
        blood_pressure: vitalsForm.blood_pressure_systolic && vitalsForm.blood_pressure_diastolic
          ? `${vitalsForm.blood_pressure_systolic}/${vitalsForm.blood_pressure_diastolic}`
          : null,
        heart_rate: parseInt(vitalsForm.heart_rate) || null,
        respiratory_rate: parseInt(vitalsForm.respiratory_rate) || null,
        oxygen_saturation: parseFloat(vitalsForm.oxygen_saturation) || null,
        weight: parseFloat(vitalsForm.weight) || null,
        height: parseFloat(vitalsForm.height) || null,
        notes: vitalsForm.notes,
        recorded_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('patient_vitals')
        .insert([vitalsData])

      if (error) throw error

      toast.success('Vitals recorded successfully!')
      setShowVitalsModal(false)
      resetVitalsForm()
      fetchRecentVitals()
    } catch (error) {
      console.error('Error recording vitals:', error)
      toast.error('Failed to record vitals')
    }
  }

  const handleAddNote = async (e) => {
    e.preventDefault()

    if (!selectedPatient) {
      toast.error('Please select a patient')
      return
    }

    try {
      const noteData = {
        patient_id: selectedPatient.id,
        nurse_id: user.id,
        nurse_name: nurseInfo?.full_name || user.email,
        nurse_type: nurseInfo?.specialty || 'General Nurse',
        note_type: noteForm.note_type,
        content: noteForm.content,
        priority: noteForm.priority,
        created_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('nurse_notes')
        .insert([noteData])

      if (error) throw error

      toast.success('Note added successfully!')
      setShowNotesModal(false)
      resetNoteForm()
      fetchNurseNotes()
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error('Failed to add note')
    }
  }

  const resetVitalsForm = () => {
    setVitalsForm({
      temperature: '',
      blood_pressure_systolic: '',
      blood_pressure_diastolic: '',
      heart_rate: '',
      respiratory_rate: '',
      oxygen_saturation: '',
      weight: '',
      height: '',
      notes: ''
    })
    setSelectedPatient(null)
  }

  const resetNoteForm = () => {
    setNoteForm({
      note_type: 'general',
      content: '',
      priority: 'normal'
    })
    setSelectedPatient(null)
  }

  const getNurseTypeIcon = (type) => {
    if (type === 'Midwife') return '👶'
    return '💉'
  }

  const getPriorityBadge = (priority) => {
    const badges = {
      normal: 'bg-green-100 text-green-800',
      moderate: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    }
    return badges[priority] || badges.normal
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{getNurseTypeIcon(nurseInfo?.specialty)}</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {nurseInfo?.specialty || 'Nurse'} Dashboard
              </h1>
              <p className="text-gray-600">
                Welcome, {nurseInfo?.full_name || user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-blue-100 text-sm mb-1">Total Patients</p>
            <p className="text-3xl font-bold">{patients.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-green-100 text-sm mb-1">Vitals Recorded Today</p>
            <p className="text-3xl font-bold">
              {recentVitals.filter(v => new Date(v.recorded_at).toDateString() === new Date().toDateString()).length}
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-purple-100 text-sm mb-1">Active Medications</p>
            <p className="text-3xl font-bold">{medications.length}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-orange-100 text-sm mb-1">My Notes</p>
            <p className="text-3xl font-bold">{nurseNotes.length}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowVitalsModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            📊 Record Vitals
          </button>
          <button
            onClick={() => setShowNotesModal(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            📝 Add Nurse Note
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('vitals')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'vitals'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📊 Recent Vitals
              </button>
              <button
                onClick={() => setActiveTab('medications')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'medications'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                💊 Medications
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'notes'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📝 My Notes
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Recent Vitals Tab */}
            {activeTab === 'vitals' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Recent Vital Signs</h3>
                {recentVitals.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No vitals recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {recentVitals.map((vital) => (
                      <div key={vital.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {vital.patients?.name || 'Unknown Patient'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {vital.patients?.age}yo • {vital.patients?.gender}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(vital.recorded_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {vital.temperature && (
                            <div>
                              <span className="text-gray-600">Temp:</span>
                              <span className="ml-2 font-medium">{vital.temperature}°C</span>
                            </div>
                          )}
                          {vital.blood_pressure && (
                            <div>
                              <span className="text-gray-600">BP:</span>
                              <span className="ml-2 font-medium">{vital.blood_pressure}</span>
                            </div>
                          )}
                          {vital.heart_rate && (
                            <div>
                              <span className="text-gray-600">HR:</span>
                              <span className="ml-2 font-medium">{vital.heart_rate} bpm</span>
                            </div>
                          )}
                          {vital.oxygen_saturation && (
                            <div>
                              <span className="text-gray-600">SpO2:</span>
                              <span className="ml-2 font-medium">{vital.oxygen_saturation}%</span>
                            </div>
                          )}
                        </div>
                        {vital.notes && (
                          <p className="text-sm text-gray-700 mt-2 italic">
                            Note: {vital.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Medications Tab */}
            {activeTab === 'medications' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Active Medications to Administer</h3>
                {medications.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No active medications</p>
                ) : (
                  <div className="space-y-3">
                    {medications.map((med) => (
                      <div key={med.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {med.patients?.name || 'Unknown Patient'}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {med.patients?.age}yo • {med.patients?.gender}
                            </p>
                            <p className="text-gray-800">
                              💊 <span className="font-medium">{med.drug_name}</span>
                            </p>
                            <p className="text-sm text-gray-600">{med.dosage} • {med.frequency}</p>
                            {med.instructions && (
                              <p className="text-sm text-gray-700 mt-1">
                                Instructions: {med.instructions}
                              </p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            med.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {med.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">My Nurse Notes</h3>
                {nurseNotes.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No notes recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {nurseNotes.map((note) => (
                      <div key={note.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {note.patients?.name || 'Unknown Patient'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {note.patients?.age}yo • {note.patients?.gender}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityBadge(note.priority)}`}>
                              {note.priority}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(note.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2 capitalize font-medium">
                          {note.note_type} Note
                        </p>
                        <p className="text-gray-800">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Record Vitals Modal */}
        {showVitalsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">📊 Record Patient Vitals</h2>
                  <button
                    onClick={() => {
                      setShowVitalsModal(false)
                      resetVitalsForm()
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleRecordVitals} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Patient *
                  </label>
                  <select
                    required
                    value={selectedPatient?.id || ''}
                    onChange={(e) => {
                      const patient = patients.find(p => p.id === e.target.value)
                      setSelectedPatient(patient)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a patient...</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} - {patient.age}yo {patient.gender}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temperature (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsForm.temperature}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="36.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      value={vitalsForm.heart_rate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, heart_rate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="72"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      BP Systolic (mmHg)
                    </label>
                    <input
                      type="number"
                      value={vitalsForm.blood_pressure_systolic}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure_systolic: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="120"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      BP Diastolic (mmHg)
                    </label>
                    <input
                      type="number"
                      value={vitalsForm.blood_pressure_diastolic}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure_diastolic: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="80"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Respiratory Rate (breaths/min)
                    </label>
                    <input
                      type="number"
                      value={vitalsForm.respiratory_rate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, respiratory_rate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="16"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Oxygen Saturation (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsForm.oxygen_saturation}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, oxygen_saturation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="98"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsForm.weight}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="70"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsForm.height}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="170"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={vitalsForm.notes}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Any observations or notes..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVitalsModal(false)
                      resetVitalsForm()
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Record Vitals
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Note Modal */}
        {showNotesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">📝 Add Nurse Note</h2>
                  <button
                    onClick={() => {
                      setShowNotesModal(false)
                      resetNoteForm()
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddNote} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Patient *
                  </label>
                  <select
                    required
                    value={selectedPatient?.id || ''}
                    onChange={(e) => {
                      const patient = patients.find(p => p.id === e.target.value)
                      setSelectedPatient(patient)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a patient...</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} - {patient.age}yo {patient.gender}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note Type *
                    </label>
                    <select
                      required
                      value={noteForm.note_type}
                      onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="general">General</option>
                      <option value="assessment">Assessment</option>
                      <option value="intervention">Intervention</option>
                      <option value="observation">Observation</option>
                      <option value="care_plan">Care Plan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority *
                    </label>
                    <select
                      required
                      value={noteForm.priority}
                      onChange={(e) => setNoteForm({ ...noteForm, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Content *
                  </label>
                  <textarea
                    required
                    value={noteForm.content}
                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="6"
                    placeholder="Enter detailed nursing note..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotesModal(false)
                      resetNoteForm()
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add Note
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

export default NurseDashboard
