import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'
import VideoCallRoom from '../components/VideoCallRoom'

/**
 * Telemedicine/Virtual Consultations
 * Video consultation platform for remote healthcare with inbuilt WebRTC video/audio
 * Author: David Gabion Selorm
 */

const Telemedicine = () => {
  const { user, userRole } = useAuth()
  const [consultations, setConsultations] = useState([])
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [selectedConsultation, setSelectedConsultation] = useState(null)
  const [showNotesSidebar, setShowNotesSidebar] = useState(false)
  const [inVideoCall, setInVideoCall] = useState(false)
  const [activeCallConsultation, setActiveCallConsultation] = useState(null)
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: userRole === 'doctor' ? user.id : '',
    scheduled_time: '',
    duration: 30,
    meeting_platform: 'carelink_video'
  })

  useEffect(() => {
    fetchConsultations()
    fetchPatients()
    if (userRole === 'admin') {
      fetchDoctors()
    }
  }, [])

  const fetchConsultations = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('virtual_consultations')
        .select(`
          *,
          patients (name, phone, patient_id),
          users (full_name, email, specialty)
        `)
        .order('scheduled_time', { ascending: true })

      // Filter by doctor if not admin
      if (userRole === 'doctor') {
        query = query.eq('doctor_id', user.id)
      }

      const { data, error } = await query

      if (error) throw error
      setConsultations(data || [])
    } catch (error) {
      console.error('Error fetching consultations:', error)
      toast.error('Failed to load consultations')
    } finally {
      setLoading(false)
    }
  }

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, patient_id, phone, email')
        .order('name')

      if (error) throw error
      setPatients(data || [])
    } catch (error) {
      console.error('Error fetching patients:', error)
    }
  }

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, specialty')
        .eq('role', 'doctor')
        .order('full_name')

      if (error) throw error
      setDoctors(data || [])
    } catch (error) {
      console.error('Error fetching doctors:', error)
    }
  }

  const generateMeetingLink = (platform, consultationId) => {
    const baseUrls = {
      zoom: 'https://zoom.us/j/',
      google_meet: 'https://meet.google.com/',
      microsoft_teams: 'https://teams.microsoft.com/l/meetup-join/',
      custom: '#'
    }
    
    // For production, integrate with actual video platform APIs
    const meetingId = consultationId.substring(0, 11).replace(/-/g, '')
    return `${baseUrls[platform]}${meetingId}`
  }

  const scheduleConsultation = async (e) => {
    e.preventDefault()

    try {
      const consultationData = {
        ...formData,
        status: 'scheduled',
        meeting_link: '',
        meeting_id: ''
      }

      const { data, error } = await supabase
        .from('virtual_consultations')
        .insert([consultationData])
        .select()
        .single()

      if (error) throw error

      //Generate meeting link
      const meetingLink = generateMeetingLink(formData.meeting_platform, data.id)
      
      await supabase
        .from('virtual_consultations')
        .update({ 
          meeting_link: meetingLink,
          meeting_id: data.id.substring(0, 11)
        })
        .eq('id', data.id)

      await logAuditEvent({
        user,
        action: 'schedule_virtual_consultation',
        tableName: 'virtual_consultations',
        recordId: data.id,
        newValues: consultationData
      })

      toast.success('Virtual consultation scheduled successfully!')
      setShowScheduleForm(false)
      setFormData({
        patient_id: '',
        doctor_id: userRole === 'doctor' ? user.id : '',
        scheduled_time: '',
        duration: 30,
        meeting_platform: 'carelink_video'
      })
      fetchConsultations()
    } catch (error) {
      console.error('Error scheduling consultation:', error)
      toast.error('Failed to schedule consultation')
    }
  }

  const updateConsultationStatus = async (consultationId, newStatus, additionalData = {}) => {
    try {
      const updates = { status: newStatus, ...additionalData }

      if (newStatus === 'in_progress') {
        updates.started_at = new Date().toISOString()
      } else if (newStatus === 'completed') {
        updates.ended_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('virtual_consultations')
        .update(updates)
        .eq('id', consultationId)

      if (error) throw error

      toast.success(`Consultation ${newStatus}`)
      fetchConsultations()
    } catch (error) {
      console.error('Error updating consultation:', error)
      toast.error('Failed to update consultation')
    }
  }

  const startVideoCall = async (consultation) => {
    setActiveCallConsultation(consultation)
    setInVideoCall(true)
    await updateConsultationStatus(consultation.id, 'in_progress', {
      call_mode: consultation.meeting_platform === 'carelink_audio' ? 'audio' : 'video'
    })
  }

  const endVideoCall = async (callDuration) => {
    if (activeCallConsultation) {
      const durationMinutes = Math.ceil(callDuration / 60)
      await updateConsultationStatus(activeCallConsultation.id, 'completed', {
        actual_duration: durationMinutes
      })
      
      await logAuditEvent({
        user,
        action: 'complete_virtual_consultation',
        tableName: 'virtual_consultations',
        recordId: activeCallConsultation.id,
        newValues: { status: 'completed', duration: durationMinutes }
      })

      toast.success(`Call ended. Duration: ${Math.floor(callDuration / 60)}m ${callDuration % 60}s`)
    }
    setInVideoCall(false)
    setActiveCallConsultation(null)
  }

  const saveConsultationNotes = async () => {
    if (!selectedConsultation) return

    try {
      const { error } = await supabase
        .from('virtual_consultations')
        .update({ 
          consultation_notes: selectedConsultation.consultation_notes,
          follow_up_required: selectedConsultation.follow_up_required || false,
          follow_up_date: selectedConsultation.follow_up_date || null
        })
        .eq('id', selectedConsultation.id)

      if (error) throw error

      toast.success('Notes saved successfully!')
      setShowNotesSidebar(false)
      fetchConsultations()
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error('Failed to save notes')
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      waiting: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-orange-100 text-orange-800'
    }
    return badges[status] || badges.scheduled
  }

  const getPlatformIcon = (platform) => {
    const icons = {
      zoom: '📹',
      google_meet: '🎥',
      microsoft_teams: '💼',
      custom: '🌐'
    }
    return icons[platform] || '🎥'
  }

  const upcomingConsultations = consultations.filter(c => 
    new Date(c.scheduled_time) >= new Date() && c.status !== 'completed' && c.status !== 'cancelled'
  )
  
  const pastConsultations = consultations.filter(c => 
    c.status === 'completed' || c.status === 'cancelled'
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Telemedicine</h1>
            <p className="text-gray-600 mt-1">Virtual consultations and remote healthcare</p>
          </div>
          <button
            onClick={() => setShowScheduleForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            📅 Schedule Consultation
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <h4 className="text-blue-100 text-sm font-medium">Upcoming</h4>
            <h2 className="text-4xl font-bold mt-2">{upcomingConsultations.length}</h2>
            <p className="text-blue-100 text-sm mt-1">Scheduled</p>
          </div>
          
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <h4 className="text-green-100 text-sm font-medium">Today</h4>
            <h2 className="text-4xl font-bold mt-2">
              {consultations.filter(c => 
                new Date(c.scheduled_time).toDateString() === new Date().toDateString()
              ).length}
            </h2>
            <p className="text-green-100 text-sm mt-1">Consultations</p>
          </div>
          
          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <h4 className="text-purple-100 text-sm font-medium">In Progress</h4>
            <h2 className="text-4xl font-bold mt-2">
              {consultations.filter(c => c.status === 'in_progress').length}
            </h2>
            <p className="text-purple-100 text-sm mt-1">Active now</p>
          </div>
          
          <div className="card bg-gradient-to-br from-gray-500 to-gray-600 text-white">
            <h4 className="text-gray-100 text-sm font-medium">Completed</h4>
            <h2 className="text-4xl font-bold mt-2">{pastConsultations.length}</h2>
            <p className="text-gray-100 text-sm mt-1">All time</p>
          </div>
        </div>

        {/* Upcoming Consultations */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Upcoming Consultations</h3>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="spinner mx-auto mb-2"></div>
              <p className="text-gray-600">Loading consultations...</p>
            </div>
          ) : upcomingConsultations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-3">📅</div>
              <p className="font-medium">No upcoming consultations</p>
              <p className="text-sm mt-1">Schedule your first virtual consultation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingConsultations.map((consultation) => (
                <div
                  key={consultation.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-lg">{consultation.patients?.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(consultation.status)}`}>
                          {consultation.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>👨‍⚕️ Dr. {consultation.users?.full_name || consultation.users?.email}</div>
                        <div>🕐 {new Date(consultation.scheduled_time).toLocaleString()}</div>
                        <div>{getPlatformIcon(consultation.meeting_platform)} {consultation.meeting_platform}</div>
                        <div>⏱️ {consultation.duration} minutes</div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {consultation.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => startVideoCall(consultation)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm text-center font-medium"
                          >
                            🎥 Join Video Call
                          </button>
                          <button
                            onClick={() => updateConsultationStatus(consultation.id, 'cancelled')}
                            className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      
                      {consultation.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => startVideoCall(consultation)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                          >
                            🎥 Rejoin Call
                          </button>
                          <button
                            onClick={() => {
                              setSelectedConsultation(consultation)
                              setShowNotesSidebar(true)
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
                          >
                            📝 Notes
                          </button>
                          <button
                            onClick={() => updateConsultationStatus(consultation.id, 'completed')}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm"
                          >
                            ✓ Complete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Call Room */}
        {inVideoCall && activeCallConsultation && (
          <VideoCallRoom
            consultation={activeCallConsultation}
            onEndCall={endVideoCall}
            currentUser={user}
          />
        )}

        {/* Past Consultations */}
        {pastConsultations.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Past Consultations</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pastConsultations.map((consultation) => (
                    <tr key={consultation.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {new Date(consultation.scheduled_time).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{consultation.patients?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {consultation.users?.full_name || consultation.users?.email}
                      </td>
                      <td className="px-4 py-3 text-sm">{consultation.duration} min</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(consultation.status)}`}>
                          {consultation.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setSelectedConsultation(consultation)
                            setShowNotesSidebar(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Notes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedule Form Modal */}
        {showScheduleForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Schedule Virtual Consultation</h3>
              
              <form onSubmit={scheduleConsultation} className="space-y-4">
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

                {userRole === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Doctor *
                    </label>
                    <select
                      required
                      value={formData.doctor_id}
                      onChange={(e) => setFormData({...formData, doctor_id: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.full_name} - {doctor.specialty}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({...formData, scheduled_time: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes) *
                  </label>
                  <select
                    required
                    value={formData.duration}
                    onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Platform *
                  </label>
                  <select
                    required
                    value={formData.meeting_platform}
                    onChange={(e) => setFormData({...formData, meeting_platform: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="carelink_video">🎥 CareLink Video (Built-in)</option>
                    <option value="carelink_audio">🎧 CareLink Audio Only</option>
                    <option value="zoom">📹 Zoom</option>
                    <option value="google_meet">🎥 Google Meet</option>
                    <option value="microsoft_teams">💼 Microsoft Teams</option>
                    <option value="custom">🌐 Custom Platform</option>
                  </select>
                </div>
                
                {(formData.meeting_platform === 'carelink_video' || formData.meeting_platform === 'carelink_audio') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      ✨ <strong>Built-in Call:</strong> High-quality, secure {formData.meeting_platform === 'carelink_video' ? 'video/audio' : 'audio-only'} consultation built right into CareLink. 
                      {formData.meeting_platform === 'carelink_video' && ' You can switch between video and audio modes during the call with permission.'}
                      {' '}No external apps needed!
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleForm(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notes Sidebar */}
        {showNotesSidebar && selectedConsultation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
            <div className="bg-white w-full max-w-lg p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Consultation Notes</h3>
                <button
                  onClick={() => setShowNotesSidebar(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p><strong>Patient:</strong> {selectedConsultation.patients?.name}</p>
                  <p><strong>Date:</strong> {new Date(selectedConsultation.scheduled_time).toLocaleString()}</p>
                  <p><strong>Duration:</strong> {selectedConsultation.duration} minutes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Consultation Notes
                  </label>
                  <textarea
                    value={selectedConsultation.consultation_notes || ''}
                    onChange={(e) => setSelectedConsultation({
                      ...selectedConsultation,
                      consultation_notes: e.target.value
                    })}
                    rows="10"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter consultation notes, diagnosis, treatment plan..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="follow_up"
                    checked={selectedConsultation.follow_up_required || false}
                    onChange={(e) => setSelectedConsultation({
                      ...selectedConsultation,
                      follow_up_required: e.target.checked
                    })}
                    className="rounded"
                  />
                  <label htmlFor="follow_up" className="text-sm font-medium text-gray-700">
                    Follow-up required
                  </label>
                </div>

                {selectedConsultation.follow_up_required && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={selectedConsultation.follow_up_date || ''}
                      onChange={(e) => setSelectedConsultation({
                        ...selectedConsultation,
                        follow_up_date: e.target.value
                      })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <button
                  onClick={saveConsultationNotes}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  💾 Save Notes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Telemedicine
