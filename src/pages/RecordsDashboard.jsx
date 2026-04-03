import { useState, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'

/**
 * Records Officer Dashboard
 * Comprehensive medical records management system
 * Manages patient records, documents, archives, and data verification
 * Author: David Gabion Selorm
 */

const RecordsDashboard = () => {
  const { user } = useAuth()
  const [recordsOfficer, setRecordsOfficer] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [patients, setPatients] = useState([])
  const [medicalRecords, setMedicalRecords] = useState([])
  const [recordRequests, setRecordRequests] = useState([])
  const [archivedRecords, setArchivedRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddRecordModal, setShowAddRecordModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [selectedPatient, setselectedPatient] = useState(null)
  const [selectedRecord, setSelectedRecord] = useState(null)

  const [recordForm, setRecordForm] = useState({
    record_type: 'consultation',
    document_name: '',
    description: '',
    record_date: '',
    file_number: '',
    category: 'medical'
  })

  const [requestForm, setRequestForm] = useState({
    requested_by: '',
    request_type: 'view',
    purpose: '',
    urgency: 'normal'
  })

  useEffect(() => {
    fetchRecordsOfficer()
    fetchPatients()
    fetchMedicalRecords()
    fetchRecordRequests()
    fetchArchivedRecords()
  }, [user])

  const fetchRecordsOfficer = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setRecordsOfficer(data)
    } catch (error) {
      console.error('Error fetching records officer info:', error)
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

      if (error) throw error
      setPatients(data || [])
    } catch (error) {
      console.error('Error fetching patients:', error)
      toast.error('Failed to load patients')
    }
  }

  const fetchMedicalRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select(`
          *,
          patients (name, age, gender, patient_id)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setMedicalRecords(data || [])
    } catch (error) {
      console.error('Error fetching medical records:', error)
    }
  }

  const fetchRecordRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('record_requests')
        .select(`
          *,
          patients (name, age, gender, patient_id)
        `)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      setRecordRequests(data || [])
    } catch (error) {
      console.error('Error fetching record requests:', error)
    }
  }

  const fetchArchivedRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select(`
          *,
          patients (name, age, gender, patient_id)
        `)
        .eq('status', 'archived')
        .order('archived_at', { ascending: false })
        .limit(30)

      if (error) throw error
      setArchivedRecords(data || [])
    } catch (error) {
      console.error('Error fetching archived records:', error)
    }
  }

  const handleAddRecord = async (e) => {
    e.preventDefault()

    if (!selectedPatient) {
      toast.error('Please select a patient')
      return
    }

    try {
      const recordData = {
        patient_id: selectedPatient.id,
        officer_id: user.id,
        officer_name: recordsOfficer?.full_name || user.email,
        record_type: recordForm.record_type,
        document_name: recordForm.document_name,
        description: recordForm.description,
        record_date: recordForm.record_date,
        file_number: recordForm.file_number,
        category: recordForm.category,
        status: 'active',
        created_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('medical_records')
        .insert([recordData])

      if (error) throw error

      toast.success('Medical record added successfully!')
      setShowAddRecordModal(false)
      resetRecordForm()
      fetchMedicalRecords()
    } catch (error) {
      console.error('Error adding record:', error)
      toast.error('Failed to add record')
    }
  }

  const handleCreateRequest = async (e) => {
    e.preventDefault()

    if (!selectedPatient) {
      toast.error('Please select a patient')
      return
    }

    try {
      const requestData = {
        patient_id: selectedPatient.id,
        requested_by: requestForm.requested_by.trim() || recordsOfficer?.full_name || user.email,
        request_type: requestForm.request_type,
        purpose: requestForm.purpose,
        urgency: requestForm.urgency,
      }

      const { error } = await supabase
        .from('record_requests')
        .insert([requestData])

      if (error) throw error

      toast.success('Record request submitted successfully!')
      setShowRequestModal(false)
      resetRequestForm()
      fetchRecordRequests()
      setActiveTab('requests')
    } catch (error) {
      console.error('Error creating record request:', error)
      toast.error('Failed to create record request')
    }
  }

  const handleProcessRequest = async (requestId, status) => {
    try {
      const { error } = await supabase
        .from('record_requests')
        .update({ 
          status,
          processed_by: user.id,
          processed_by_name: recordsOfficer?.full_name || user.email,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error

      toast.success(`Request ${status}!`)
      fetchRecordRequests()
    } catch (error) {
      console.error('Error processing request:', error)
      toast.error('Failed to process request')
    }
  }

  const handleArchiveRecord = async (recordId) => {
    try {
      const { error } = await supabase
        .from('medical_records')
        .update({ 
          status: 'archived',
          archived_by: user.id,
          archived_at: new Date().toISOString()
        })
        .eq('id', recordId)

      if (error) throw error

      toast.success('Record archived successfully!')
      fetchMedicalRecords()
      fetchArchivedRecords()
    } catch (error) {
      console.error('Error archiving record:', error)
      toast.error('Failed to archive record')
    }
  }

  const handleRestoreRecord = async (recordId) => {
    try {
      const { error } = await supabase
        .from('medical_records')
        .update({ 
          status: 'active',
          restored_by: user.id,
          restored_at: new Date().toISOString(),
          archived_by: null,
          archived_at: null
        })
        .eq('id', recordId)

      if (error) throw error

      toast.success('Record restored successfully!')
      fetchMedicalRecords()
      fetchArchivedRecords()
    } catch (error) {
      console.error('Error restoring record:', error)
      toast.error('Failed to restore record')
    }
  }

  const resetRecordForm = () => {
    setRecordForm({
      record_type: 'consultation',
      document_name: '',
      description: '',
      record_date: '',
      file_number: '',
      category: 'medical'
    })
    setselectedPatient(null)
  }

  const resetRequestForm = () => {
    setRequestForm({
      requested_by: recordsOfficer?.full_name || user?.email || '',
      request_type: 'view',
      purpose: '',
      urgency: 'normal'
    })
    setselectedPatient(null)
  }

  const openRequestModal = (patient = null) => {
    setselectedPatient(patient)
    setRequestForm({
      requested_by: recordsOfficer?.full_name || user?.email || '',
      request_type: 'view',
      purpose: '',
      urgency: 'normal'
    })
    setShowRequestModal(true)
  }

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      archived: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getUrgencyBadge = (urgency) => {
    const badges = {
      normal: 'bg-green-100 text-green-800',
      urgent: 'bg-orange-100 text-orange-800',
      emergency: 'bg-red-100 text-red-800'
    }
    return badges[urgency] || badges.normal
  }

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredRecords = medicalRecords.filter(record =>
    record.patients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.file_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.document_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pendingRequests = recordRequests.filter(r => r.status === 'pending')
  const todayRecords = medicalRecords.filter(r => 
    new Date(r.created_at).toDateString() === new Date().toDateString()
  )

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
            <span className="text-4xl">📂</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Medical Records Management
              </h1>
              <p className="text-gray-600">
                Welcome, {recordsOfficer?.full_name || user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-blue-100 text-sm mb-1">Total Records</p>
            <p className="text-3xl font-bold">{medicalRecords.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-green-100 text-sm mb-1">Added Today</p>
            <p className="text-3xl font-bold">{todayRecords.length}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-yellow-100 text-sm mb-1">Pending Requests</p>
            <p className="text-3xl font-bold">{pendingRequests.length}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-gray-100 text-sm mb-1">Archived</p>
            <p className="text-3xl font-bold">{archivedRecords.length}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-5 text-white">
            <p className="text-purple-100 text-sm mb-1">Total Patients</p>
            <p className="text-3xl font-bold">{patients.length}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Search by patient name, patient ID, or file number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddRecordModal(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <span className="text-xl">+</span>
                Add Record
              </button>
              <button
                onClick={() => openRequestModal()}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition"
              >
                New Request
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'records'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📁 Medical Records
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'requests'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📋 Record Requests
                {pendingRequests.length > 0 && (
                  <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'archived'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🗄️ Archived Records
              </button>
              <button
                onClick={() => setActiveTab('patients')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'patients'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                👥 Patients
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-3">Latest Records</h4>
                      {medicalRecords.slice(0, 5).map((record) => (
                        <div key={record.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                          <div>
                            <p className="font-medium text-sm">{record.patients?.name}</p>
                            <p className="text-xs text-gray-600">{record.document_name}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(record.status)}`}>
                            {record.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-3">Pending Requests</h4>
                      {pendingRequests.slice(0, 5).map((request) => (
                        <div key={request.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                          <div>
                            <p className="font-medium text-sm">{request.patients?.name}</p>
                            <p className="text-xs text-gray-600">{request.request_type} - {request.requested_by}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${getUrgencyBadge(request.urgency)}`}>
                            {request.urgency}
                          </span>
                        </div>
                      ))}
                      {pendingRequests.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">No pending requests</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Statistics by Category</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['medical', 'administrative', 'billing', 'laboratory'].map(category => {
                      const count = medicalRecords.filter(r => r.category === category).length
                      return (
                        <div key={category} className="border border-gray-200 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-blue-600">{count}</p>
                          <p className="text-sm text-gray-600 capitalize">{category}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Medical Records Tab */}
            {activeTab === 'records' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">All Medical Records</h3>
                {filteredRecords.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No records found</p>
                ) : (
                  <div className="space-y-3">
                    {filteredRecords.map((record) => (
                      <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-gray-800">
                                {record.patients?.name || 'Unknown Patient'}
                              </h4>
                              <span className="text-sm text-gray-600">
                                ID: {record.patients?.patient_id}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(record.status)}`}>
                                {record.status}
                              </span>
                            </div>
                            <p className="text-gray-800 font-medium">{record.document_name}</p>
                            <p className="text-sm text-gray-600">{record.description}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">File #:</span> {record.file_number}
                              </div>
                              <div>
                                <span className="font-medium">Type:</span> {record.record_type}
                              </div>
                              <div>
                                <span className="font-medium">Category:</span> {record.category}
                              </div>
                              <div>
                                <span className="font-medium">Date:</span> {new Date(record.record_date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {record.status === 'active' && (
                              <button
                                onClick={() => handleArchiveRecord(record.id)}
                                className="text-xs px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          Added by {record.officer_name} on {new Date(record.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Record Requests Tab */}
            {activeTab === 'requests' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Record Access Requests</h3>
                {recordRequests.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No requests found</p>
                ) : (
                  <div className="space-y-3">
                    {recordRequests.map((request) => (
                      <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-gray-800">
                                {request.patients?.name || 'Unknown Patient'}
                              </h4>
                              <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(request.status)}`}>
                                {request.status}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${getUrgencyBadge(request.urgency)}`}>
                                {request.urgency}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Requested by:</span> {request.requested_by}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Type:</span> {request.request_type}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Purpose:</span> {request.purpose}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Requested on {new Date(request.created_at).toLocaleString()}
                            </p>
                          </div>
                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleProcessRequest(request.id, 'approved')}
                                className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => handleProcessRequest(request.id, 'rejected')}
                                className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                ✗ Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Archived Records Tab */}
            {activeTab === 'archived' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Archived Records</h3>
                {archivedRecords.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No archived records</p>
                ) : (
                  <div className="space-y-3">
                    {archivedRecords.map((record) => (
                      <div key={record.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-1">
                              {record.patients?.name || 'Unknown Patient'}
                            </h4>
                            <p className="text-gray-800">{record.document_name}</p>
                            <p className="text-sm text-gray-600">{record.description}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              Archived on {new Date(record.archived_at).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRestoreRecord(record.id)}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Patients Tab */}
            {activeTab === 'patients' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">All Patients</h3>
                {filteredPatients.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No patients found</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPatients.map((patient) => {
                      const patientRecords = medicalRecords.filter(r => r.patient_id === patient.id)
                      return (
                        <div key={patient.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-800">{patient.name}</h4>
                              <p className="text-sm text-gray-600">
                                ID: {patient.patient_id}
                              </p>
                              <p className="text-sm text-gray-600">
                                {patient.age}yo • {patient.gender}
                              </p>
                              <p className="text-sm text-gray-600">{patient.phone}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-blue-600">{patientRecords.length}</p>
                              <p className="text-xs text-gray-600">Records</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setselectedPatient(patient)
                              setShowAddRecordModal(true)
                            }}
                            className="w-full mt-2 text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Add Record
                          </button>
                          <button
                            onClick={() => openRequestModal(patient)}
                            className="w-full mt-2 text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            Create Request
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add Record Modal */}
        {showAddRecordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">📁 Add Medical Record</h2>
                  <button
                    onClick={() => {
                      setShowAddRecordModal(false)
                      resetRecordForm()
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddRecord} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Patient *
                  </label>
                  <select
                    required
                    value={selectedPatient?.id || ''}
                    onChange={(e) => {
                      const patient = patients.find(p => p.id === e.target.value)
                      setselectedPatient(patient)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a patient...</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} - {patient.patient_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Record Type *
                    </label>
                    <select
                      required
                      value={recordForm.record_type}
                      onChange={(e) => setRecordForm({ ...recordForm, record_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="consultation">Consultation</option>
                      <option value="lab_result">Lab Result</option>
                      <option value="imaging">Imaging</option>
                      <option value="prescription">Prescription</option>
                      <option value="discharge_summary">Discharge Summary</option>
                      <option value="admission">Admission</option>
                      <option value="surgery">Surgery</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      required
                      value={recordForm.category}
                      onChange={(e) => setRecordForm({ ...recordForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="medical">Medical</option>
                      <option value="administrative">Administrative</option>
                      <option value="billing">Billing</option>
                      <option value="laboratory">Laboratory</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={recordForm.document_name}
                    onChange={(e) => setRecordForm({ ...recordForm, document_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Blood Test Results - January 2026"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    value={recordForm.description}
                    onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Brief description of the record..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      File Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={recordForm.file_number}
                      onChange={(e) => setRecordForm({ ...recordForm, file_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., MR-2026-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Record Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={recordForm.record_date}
                      onChange={(e) => setRecordForm({ ...recordForm, record_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddRecordModal(false)
                      resetRecordForm()
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Create Record Request</h2>
                  <button
                    onClick={() => {
                      setShowRequestModal(false)
                      resetRequestForm()
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Patient *
                  </label>
                  <select
                    required
                    value={selectedPatient?.id || ''}
                    onChange={(e) => {
                      const patient = patients.find((item) => item.id === e.target.value)
                      setselectedPatient(patient || null)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Choose a patient...</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} - {patient.patient_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Requested By *
                    </label>
                    <input
                      type="text"
                      required
                      value={requestForm.requested_by}
                      onChange={(e) => setRequestForm({ ...requestForm, requested_by: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="Requester name or department"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Request Type *
                    </label>
                    <select
                      required
                      value={requestForm.request_type}
                      onChange={(e) => setRequestForm({ ...requestForm, request_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="view">View</option>
                      <option value="copy">Copy</option>
                      <option value="transfer">Transfer</option>
                      <option value="audit">Audit</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purpose *
                  </label>
                  <textarea
                    required
                    value={requestForm.purpose}
                    onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="State why this record is being requested..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Urgency *
                  </label>
                  <select
                    required
                    value={requestForm.urgency}
                    onChange={(e) => setRequestForm({ ...requestForm, urgency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false)
                      resetRequestForm()
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    Submit Request
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

export default RecordsDashboard
