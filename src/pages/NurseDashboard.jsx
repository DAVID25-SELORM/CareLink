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
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [recentVitals, setRecentVitals] = useState([])
  const [medications, setMedications] = useState([])
  const [nurseNotes, setNurseNotes] = useState([])
  const [tasks, setTasks] = useState([])
  const [handoverNotes, setHandoverNotes] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

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

  const [taskForm, setTaskForm] = useState({
    task_type: 'medication',
    description: '',
    priority: 'normal',
    due_time: ''
  })

  const [handoverForm, setHandoverForm] = useState({
    shift: '',
    summary: '',
    concerns: '',
    pending_tasks: ''
  })

  useEffect(() => {
    if (!user) return

    fetchNurseInfo()
    fetchPatients()
    fetchRecentVitals()
    fetchMedications()
    fetchNurseNotes()
    fetchTasks()
    fetchHandoverNotes()
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
          id,
          status,
          created_at,
          patients (name, age, gender),
          prescription_items (id, drug_name, dosage, frequency, instructions, quantity)
        `)
        .in('status', ['pending', 'dispensed'])
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      const medicationRows = (data || []).flatMap((prescription) =>
        (prescription.prescription_items || []).map((item) => ({
          ...item,
          prescription_id: prescription.id,
          status: prescription.status,
          created_at: prescription.created_at,
          patients: prescription.patients,
        })),
      )

      setMedications(medicationRows)
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

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('nurse_tasks')
        .select(`
          *,
          patients (name, age, gender)
        `)
        .eq('nurse_id', user?.id)
        .order('due_time', { ascending: true })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const fetchHandoverNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_handovers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setHandoverNotes(data || [])
    } catch (error) {
      console.error('Error fetching handover notes:', error)
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

  const handleAddTask = async (e) => {
    e.preventDefault()

    if (!selectedPatient) {
      toast.error('Please select a patient')
      return
    }

    try {
      const taskData = {
        patient_id: selectedPatient.id,
        nurse_id: user.id,
        nurse_name: nurseInfo?.full_name || user.email,
        task_type: taskForm.task_type,
        description: taskForm.description,
        priority: taskForm.priority,
        due_time: taskForm.due_time ? new Date(taskForm.due_time).toISOString() : null,
        status: 'pending',
        created_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('nurse_tasks')
        .insert([taskData])

      if (error) throw error

      toast.success('Task created successfully!')
      setShowTaskModal(false)
      resetTaskForm()
      fetchTasks()
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task')
    }
  }

  const handleCompleteTask = async (taskId) => {
    try {
      const { error } = await supabase
        .from('nurse_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (error) throw error

      toast.success('Task marked as completed!')
      fetchTasks()
    } catch (error) {
      console.error('Error completing task:', error)
      toast.error('Failed to complete task')
    }
  }

  const handleAddHandover = async (e) => {
    e.preventDefault()

    try {
      const handoverData = {
        nurse_id: user.id,
        nurse_name: nurseInfo?.full_name || user.email,
        nurse_type: nurseInfo?.specialty || 'General Nurse',
        shift: handoverForm.shift,
        summary: handoverForm.summary,
        concerns: handoverForm.concerns,
        pending_tasks: handoverForm.pending_tasks,
        created_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('shift_handovers')
        .insert([handoverData])

      if (error) throw error

      toast.success('Handover note submitted successfully!')
      setShowHandoverModal(false)
      resetHandoverForm()
      fetchHandoverNotes()
    } catch (error) {
      console.error('Error adding handover:', error)
      toast.error('Failed to submit handover')
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

  const resetTaskForm = () => {
    setTaskForm({
      task_type: 'medication',
      description: '',
      priority: 'normal',
      due_time: ''
    })
    setSelectedPatient(null)
  }

  const resetHandoverForm = () => {
    setHandoverForm({
      shift: '',
      summary: '',
      concerns: '',
      pending_tasks: ''
    })
  }

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone?.includes(searchTerm)
  )

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus
    const searchValue = searchTerm.toLowerCase()
    const matchesSearch =
      !searchValue ||
      task.patients?.name?.toLowerCase().includes(searchValue) ||
      task.description?.toLowerCase().includes(searchValue)

    return matchesStatus && matchesSearch
  })

  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed')

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

  const getTaskStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800'
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getMedicationStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      dispensed: 'bg-green-100 text-green-800'
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
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
          <button
            onClick={() => setShowTaskModal(true)}
            className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition"
          >
            Add Care Task
          </button>
          <button
            onClick={() => setShowHandoverModal(true)}
            className="bg-slate-700 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            Add Shift Handover
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('vitals')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'vitals'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📊 Recent Vitals
              </button>
              <button
                onClick={() => setActiveTab('medications')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'medications'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                💊 Medications
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📝 My Notes
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'tasks'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Care Tasks
              </button>
              <button
                onClick={() => setActiveTab('handover')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'handover'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Shift Handovers
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
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getMedicationStatusBadge(med.status)}`}>
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

            {activeTab === 'tasks' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                    <p className="text-sm text-yellow-700">Pending Tasks</p>
                    <p className="text-3xl font-bold text-yellow-900">{pendingTasks.length}</p>
                  </div>
                  <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-700">Completed Tasks</p>
                    <p className="text-3xl font-bold text-green-900">{completedTasks.length}</p>
                  </div>
                  <div className="border border-slate-200 bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">All Tasks</p>
                    <p className="text-3xl font-bold text-slate-900">{tasks.length}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by patient or task description"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {filteredTasks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No care tasks found</p>
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map((task) => (
                      <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div>
                              <h4 className="font-semibold text-gray-800">
                                {task.patients?.name || 'Unknown Patient'}
                              </h4>
                              <p className="text-sm text-gray-600 capitalize">
                                {task.task_type} task
                              </p>
                            </div>
                            <p className="text-gray-700">{task.description}</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className={`rounded-full px-3 py-1 font-medium ${getPriorityBadge(task.priority)}`}>
                                {task.priority}
                              </span>
                              <span className={`rounded-full px-3 py-1 font-medium ${getTaskStatusBadge(task.status)}`}>
                                {task.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">
                              Due: {task.due_time ? new Date(task.due_time).toLocaleString() : 'Not set'}
                            </p>
                          </div>
                          {task.status === 'pending' && (
                            <button
                              onClick={() => handleCompleteTask(task.id)}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                            >
                              Mark Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'handover' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Shift Handover Notes</h3>
                    <p className="text-sm text-gray-600">
                      Share key patient-care updates across shifts.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowHandoverModal(true)}
                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    New Handover
                  </button>
                </div>

                {handoverNotes.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No shift handovers submitted yet</p>
                ) : (
                  <div className="space-y-3">
                    {handoverNotes.map((handover) => (
                      <div key={handover.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {handover.shift ? `${handover.shift} shift` : 'Shift handover'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {handover.nurse_name}
                              {handover.nurse_type ? ` • ${handover.nurse_type}` : ''}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(handover.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-3 space-y-3 text-sm text-gray-700">
                          <div>
                            <p className="font-medium text-gray-900">Summary</p>
                            <p className="whitespace-pre-line">{handover.summary}</p>
                          </div>
                          {handover.concerns ? (
                            <div>
                              <p className="font-medium text-gray-900">Concerns</p>
                              <p className="whitespace-pre-line">{handover.concerns}</p>
                            </div>
                          ) : null}
                          {handover.pending_tasks ? (
                            <div>
                              <p className="font-medium text-gray-900">Pending Tasks</p>
                              <p className="whitespace-pre-line">{handover.pending_tasks}</p>
                            </div>
                          ) : null}
                        </div>
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

        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Add Care Task</h2>
                  <button
                    onClick={() => {
                      setShowTaskModal(false)
                      resetTaskForm()
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddTask} className="space-y-4 p-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Select Patient *
                  </label>
                  <select
                    required
                    value={selectedPatient?.id || ''}
                    onChange={(e) => {
                      const patient = patients.find((item) => item.id === e.target.value)
                      setSelectedPatient(patient || null)
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a patient...</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} - {patient.age}yo {patient.gender}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Task Type *
                    </label>
                    <select
                      required
                      value={taskForm.task_type}
                      onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="medication">Medication</option>
                      <option value="vitals">Vitals Follow-up</option>
                      <option value="observation">Observation</option>
                      <option value="wound_care">Wound Care</option>
                      <option value="patient_education">Patient Education</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Priority *
                    </label>
                    <select
                      required
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Due Time
                  </label>
                  <input
                    type="datetime-local"
                    value={taskForm.due_time}
                    onChange={(e) => setTaskForm({ ...taskForm, due_time: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description *
                  </label>
                  <textarea
                    required
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows="5"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the care task and any administration notes..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTaskModal(false)
                      resetTaskForm()
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
                  >
                    Save Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showHandoverModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Add Shift Handover</h2>
                  <button
                    onClick={() => {
                      setShowHandoverModal(false)
                      resetHandoverForm()
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddHandover} className="space-y-4 p-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Shift *
                  </label>
                  <select
                    required
                    value={handoverForm.shift}
                    onChange={(e) => setHandoverForm({ ...handoverForm, shift: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a shift...</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="night">Night</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Shift Summary *
                  </label>
                  <textarea
                    required
                    value={handoverForm.summary}
                    onChange={(e) => setHandoverForm({ ...handoverForm, summary: e.target.value })}
                    rows="4"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="Summarize the shift, admissions, discharges, and key care updates..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Concerns
                  </label>
                  <textarea
                    value={handoverForm.concerns}
                    onChange={(e) => setHandoverForm({ ...handoverForm, concerns: e.target.value })}
                    rows="3"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="Document any unstable patients, escalations, or follow-up concerns..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Pending Tasks
                  </label>
                  <textarea
                    value={handoverForm.pending_tasks}
                    onChange={(e) => setHandoverForm({ ...handoverForm, pending_tasks: e.target.value })}
                    rows="3"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="List any unfinished medication rounds, observations, or patient requests..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHandoverModal(false)
                      resetHandoverForm()
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800"
                  >
                    Save Handover
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
