import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'

/**
 * Queue Management System
 * Manages patient queues across all departments
 * Author: David Gabion Selorm
 */

const QueueManagement = () => {
  const { user, userRole } = useAuth()
  const [activeTab, setActiveTab] = useState('opd') 
  const [queues, setQueues] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedQueue, setSelectedQueue] = useState(null)
  const [formData, setFormData] = useState({
    patient_id: '',
    department: 'opd',
    priority: 'normal'
  })

  const departments = [
    { id: 'opd', name: 'OPD', icon: '🏥', color: 'blue' },
    { id: 'emergency', name: 'Emergency', icon: '🚨', color: 'red' },
    { id: 'pharmacy', name: 'Pharmacy', icon: '💊', color: 'green' },
    { id: 'laboratory', name: 'Laboratory', icon: '🔬', color: 'purple' },
    { id: 'radiology', name: 'Radiology', icon: '📷', color: 'indigo' },
    { id: 'billing', name: 'Billing', icon: '💰', color: 'yellow' },
    { id: 'records', name: 'Records', icon: '📋', color: 'gray' }
  ]

  useEffect(() => {
    fetchQueues()
    fetchPatients()
    
    // Real-time subscription
    const subscription = supabase
      .channel('queue_changes'    )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_management'
        },
        () => fetchQueues()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [activeTab])

  const fetchQueues = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('queue_management')
        .select(`
          *,
          patients (name, phone, patient_id),
          users:served_by (full_name, email)
        `)
        .eq('department', activeTab)
        .in('status', ['waiting', 'called', 'in_progress'])
        .order('priority', { ascending: false })
        .order('checked_in_at', { ascending: true })

      if (error) throw error
      setQueues(data || [])
    } catch (error) {
      console.error('Error fetching queues:', error)
      toast.error('Failed to load queue')
    } finally {
      setLoading(false)
    }
  }

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, patient_id, phone')
        .order('name')
        .limit(100)
      
      if (error) throw error
      setPatients(data || [])
    } catch (error) {
      console.error('Error fetching patients:', error)
    }
  }

  const getNextQueueNumber = async (department) => {
    const { data } = await supabase
      .from('queue_management')
      .select('queue_number')
      .eq('department', department)
      .order('queue_number', { ascending: false })
      .limit(1)
      .single()

    return (data?.queue_number || 0) + 1
  }

  const addToQueue = async (e) => {
    e.preventDefault()

    try {
      const queueNumber = await getNextQueueNumber(formData.department)
      
      const { data, error } = await supabase
        .from('queue_management')
        .insert([{
          ...formData,
          queue_number: queueNumber,
          status: 'waiting',
          checked_in_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error

      toast.success(`Patient added to queue #${queueNumber}`)
      setShowAddForm(false)
      setFormData({ patient_id: '', department: activeTab, priority: 'normal' })
      fetchQueues()
    } catch (error) {
      console.error('Error adding to queue:', error)
      toast.error('Failed to add patient to queue')
    }
  }

  const callNext = async () => {
    const nextPatient = queues.find(q => q.status === 'waiting')
    
    if (!nextPatient) {
      toast.info('No patients waiting in queue')
      return
    }

    try {
      const { error } = await supabase
        .from('queue_management')
        .update({ 
          status: 'called',
          called_at: new Date().toISOString()
        })
        .eq('id', nextPatient.id)

      if (error) throw error

      toast.success(`Calling ${nextPatient.patients?.name} - Queue #${nextPatient.queue_number}`)
      fetchQueues()
    } catch (error) {
      console.error('Error calling patient:', error)
      toast.error('Failed to call patient')
    }
  }

  const updateQueueStatus = async (queueId, newStatus) => {
    try {
      const updates = { 
        status: newStatus,
        served_by: user.id
      }

      if (newStatus === 'in_progress') {
        updates.started_at = new Date().toISOString()
      } else if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('queue_management')
        .update(updates)
        .eq('id', queueId)

      if (error) throw error

      toast.success(`Queue status updated to ${newStatus}`)
      fetchQueues()
    } catch (error) {
      console.error('Error updating queue:', error)
      toast.error('Failed to update queue status')
    }
  }

  const getWaitingCount = () => queues.filter(q => q.status === 'waiting').length
  const getAverageWaitTime = () => {
    const waiting = queues.filter(q => q.status === 'waiting')
    if (waiting.length === 0) return 0
    
    const totalWait = waiting.reduce((sum, q) => {
      const waitTime = (new Date() - new Date(q.checked_in_at)) / (1000 * 60)
      return sum + waitTime
    }, 0)
    
    return Math.round(totalWait / waiting.length)
  }

  const getPriorityBadge = (priority) => {
    const badges = {
      emergency: 'bg-red-100 text-red-800 border-red-300',
      urgent: 'bg-orange-100 text-orange-800 border-orange-300',
      normal: 'bg-blue-100 text-blue-800 border-blue-300'
    }
    return badges[priority] || badges.normal
  }

  const getStatusBadge = (status) => {
    const badges = {
      waiting: 'bg-yellow-100 text-yellow-800',
      called: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800'
    }
    return badges[status] || badges.waiting
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Queue Management</h1>
            <p className="text-gray-600 mt-1">Manage patient queues across departments</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              + Add to Queue
            </button>
            <button
              onClick={callNext}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              📢 Call Next
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <h4 className="text-blue-100 text-sm font-medium">Waiting</h4>
            <h2 className="text-4xl font-bold mt-2">{getWaitingCount()}</h2>
            <p className="text-blue-100 text-sm mt-1">Patients in queue</p>
          </div>
          
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <h4 className="text-green-100 text-sm font-medium">In Service</h4>
            <h2 className="text-4xl font-bold mt-2">
              {queues.filter(q => q.status === 'in_progress').length}
            </h2>
            <p className="text-green-100 text-sm mt-1">Currently being served</p>
          </div>
          
          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <h4 className="text-orange-100 text-sm font-medium">Avg Wait Time</h4>
            <h2 className="text-4xl font-bold mt-2">{getAverageWaitTime()}</h2>
            <p className="text-orange-100 text-sm mt-1">Minutes</p>
          </div>
        </div>

        {/* Department Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex overflow-x-auto">
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setActiveTab(dept.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap transition ${
                  activeTab === dept.id
                    ? `text-${dept.color}-600 bg-${dept.color}-50 border-b-2 border-${dept.color}-600`
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{dept.icon}</span>
                <span>{dept.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Queue List */}
        <div className="card">
          {loading ? (
            <div className="text-center py-12">
              <div className="spinner mx-auto mb-2"></div>
              <p className="text-gray-600">Loading queue...</p>
            </div>
          ) : queues.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-3">✅</div>
              <p className="font-medium">No patients in queue</p>
              <p className="text-sm mt-1">Queue is empty</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Queue #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wait Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {queues.map((queue) => {
                    const waitTime = Math.round((new Date() - new Date(queue.checked_in_at)) / (1000 * 60))
                    
                    return (
                      <tr key={queue.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-2xl font-bold text-blue-600">
                            {queue.queue_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{queue.patients?.name}</p>
                            <p className="text-sm text-gray-500">{queue.patients?.patient_id}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityBadge(queue.priority)}`}>
                            {queue.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(queue.status)}`}>
                            {queue.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={waitTime > 30 ? 'text-red-600 font-bold' : 'text-gray-600'}>
                            {waitTime} min
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {queue.status === 'waiting' && (
                              <button
                                onClick={() => updateQueueStatus(queue.id, 'called')}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Call
                              </button>
                            )}
                            {queue.status === 'called' && (
                              <button
                                onClick={() => updateQueueStatus(queue.id, 'in_progress')}
                                className="text-green-600 hover:text-green-800 text-sm font-medium"
                              >
                                Start
                              </button>
                            )}
                            {queue.status === 'in_progress' && (
                              <button
                                onClick={() => updateQueueStatus(queue.id, 'completed')}
                                className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                              >
                                Complete
                              </button>
                            )}
                            <button
                              onClick={() => updateQueueStatus(queue.id, 'cancelled')}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add to Queue Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Add Patient to Queue</h3>
              
              <form onSubmit={addToQueue} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient *
                  </label>
                  <select
                    required
                    value={formData.patient_id}
                    onChange={(e) => setFormData({...formData, patient_id: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} ({patient.patient_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department *
                  </label>
                  <select
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.icon} {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority *
                  </label>
                  <select
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Add to Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
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

export default QueueManagement
