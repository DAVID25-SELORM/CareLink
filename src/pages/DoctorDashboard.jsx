import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import { SpecialtyComponents } from '../components/SpecialtyDashboards'
import DoctorAppointmentBooking from '../components/DoctorAppointmentBooking'
import PatientReferral from '../components/PatientReferral'

/**
 * Doctor Dashboard Page
 * Personalized dashboard for doctors with specialty-specific views
 * Each of the 36 medical specialties has a customized dashboard
 * Author: David Gabion Selorm
 */

const DoctorDashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [doctorInfo, setDoctorInfo] = useState(null)
  const [stats, setStats] = useState({
    todayAppointments: 0,
    upcomingAppointments: 0,
    totalPatients: 0,
    prescriptionsThisWeek: 0,
    pendingLabResults: 0,
    completedToday: 0
  })
  const [todaySchedule, setTodaySchedule] = useState([])
  const [recentPrescriptions, setRecentPrescriptions] = useState([])
  const [pendingLabs, setPendingLabs] = useState([])
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)

  useEffect(() => {
    if (user) {
      fetchDoctorData()
    }
  }, [user])

  const fetchDoctorData = async () => {
    try {
      setLoading(true)

      // Get doctor info from users table
      const { data: doctorData, error: doctorError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (doctorError) throw doctorError
      setDoctorInfo(doctorData)

      // Get today's date
      const today = new Date().toISOString().split('T')[0]
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Fetch today's appointments
      const { data: todayAppts, error: todayError } = await supabase
        .from('appointments')
        .select('*, patients(name, phone)')
        .eq('doctor_id', user.id)
        .eq('appointment_date', today)
        .order('appointment_time', { ascending: true })

      if (todayError) throw todayError
      setTodaySchedule(todayAppts || [])

      // Fetch upcoming appointments (next 7 days)
      const { data: upcomingAppts, error: upcomingError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', user.id)
        .gte('appointment_date', today)
        .eq('status', 'scheduled')

      // Fetch completed appointments today
      const { data: completedAppts, error: completedError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', user.id)
        .eq('appointment_date', today)
        .eq('status', 'completed')

      // Fetch total unique patients
      const { data: patients, error: patientsError } = await supabase
        .from('prescriptions')
        .select('patient_id')
        .eq('doctor_id', user.id)

      const uniquePatients = patients ? [...new Set(patients.map(p => p.patient_id))].length : 0

      // Fetch prescriptions this week
      const { data: weekPrescriptions, error: weekError } = await supabase
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', user.id)
        .gte('created_at', oneWeekAgo)

      // Fetch recent prescriptions
      const { data: recentRx, error: recentError } = await supabase
        .from('prescriptions')
        .select('*, patients(name, age, gender)')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!recentError) setRecentPrescriptions(recentRx || [])

      // Fetch pending lab tests
      const { data: labs, error: labsError } = await supabase
        .from('lab_tests')
        .select('*, patients(name, age, gender)')
        .eq('requested_by', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5)

      if (!labsError) setPendingLabs(labs || [])

      // Set stats
      setStats({
        todayAppointments: todayAppts?.length || 0,
        upcomingAppointments: upcomingAppts?.length || 0,
        totalPatients: uniquePatients,
        prescriptionsThisWeek: weekPrescriptions?.length || 0,
        pendingLabResults: labs?.length || 0,
        completedToday: completedAppts?.length || 0
      })

    } catch (error) {
      console.error('Error fetching doctor data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const markAppointmentComplete = async (appointmentId) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId)

      if (error) throw error
      
      toast.success('Appointment marked as completed')
      fetchDoctorData() // Refresh data
    } catch (error) {
      console.error('Error updating appointment:', error)
      toast.error('Failed to update appointment')
    }
  }

  const getSpecialtyIcon = (specialty) => {
    const icons = {
      'General Practitioner': '🩺',
      'Cardiologist': '❤️',
      'Pediatrician': '👶',
      'Gynecologist': '👩‍⚕️',
      'Dermatologist': '🧴',
      'Orthopedic Surgeon': '🦴',
      'Psychiatrist': '🧠',
      'Ophthalmologist': '👁️',
      'ENT Specialist': '👂',
      'Neurologist': '🧠',
      'Oncologist': '🎗️',
      'Radiologist': '📷',
      'Anesthesiologist': '💉',
      'Pathologist': '🔬',
      'Urologist': '🩺',
      'Gastroenterologist': '🫀',
      'Endocrinologist': '⚕️',
      'Rheumatologist': '🦴',
      'Pulmonologist': '🫁',
      'Nephrologist': '🩺',
      'Dietician/Nutritionist': '🥗',
      'Optometrist': '👓',
      'Physiotherapist': '🏃',
      'Dentist': '🦷',
      'General Surgeon': '🔪',
      'Neurosurgeon': '🧠',
      'Plastic Surgeon': '✨',
      'Obstetrician': '🤰',
      'Speech Therapist': '🗣️',
      'Occupational Therapist': '🧩',
      'Clinical Psychologist': '💭',
      'Hematologist': '🩸',
      'Allergist/Immunologist': '🤧',
      'Infectious Disease Specialist': '🦠',
      'Geriatrician': '👴',
      'Emergency Medicine Specialist': '🚑'
    }
    return icons[specialty] || '🩺'
  }

  const getStatusColor = (status) => {
    const colors = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-purple-100 text-purple-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                {getSpecialtyIcon(doctorInfo?.specialty)}
                Dr. {doctorInfo?.full_name || user?.email}
              </h1>
              <p className="text-gray-600 mt-1">
                {doctorInfo?.specialty || 'General Practitioner'} • {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBookingModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
              >
                📅 Book Appointment
              </button>
              <button
                onClick={() => setShowReferralModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
              >
                🔄 Refer Patient
              </button>
              <button
                onClick={() => navigate('/prescriptions')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                📋 New Prescription
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Today's Appointments"
            value={stats.todayAppointments}
            icon="📅"
            color="border-blue-500"
            subtitle={`${stats.completedToday} completed`}
          />
          <StatCard
            title="Upcoming Appointments"
            value={stats.upcomingAppointments}
            icon="⏰"
            color="border-purple-500"
            subtitle="Next 7 days"
          />
          <StatCard
            title="Total Patients"
            value={stats.totalPatients}
            icon="👥"
            color="border-green-500"
            subtitle="Under your care"
          />
          <StatCard
            title="This Week"
            value={stats.prescriptionsThisWeek}
            icon="📋"
            color="border-orange-500"
            subtitle="Prescriptions written"
          />
        </div>

        {/* Specialty-Specific Dashboard Section */}
        {doctorInfo?.specialty && SpecialtyComponents[doctorInfo.specialty] && (
          <div className="mb-6">
            {(() => {
              const SpecialtyComponent = SpecialtyComponents[doctorInfo.specialty]
              return <SpecialtyComponent stats={stats} doctorInfo={doctorInfo} />
            })()}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              📅 Today's Schedule
              <span className="text-sm font-normal text-gray-600">({stats.todayAppointments} appointments)</span>
            </h2>
            
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">☕</p>
                <p>No appointments scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {todaySchedule.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {appointment.patients?.name || 'Unknown Patient'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{appointment.reason}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            ⏰ {appointment.appointment_time?.slice(0, 5)}
                          </span>
                          <span className="flex items-center gap-1">
                            📞 {appointment.patients?.phone}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(appointment.status)}`}>
                          {appointment.status}
                        </span>
                        {appointment.status === 'scheduled' && (
                          <button
                            onClick={() => markAppointmentComplete(appointment.id)}
                            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                          >
                            Mark Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => navigate('/appointments')}
              className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All Appointments →
            </button>
          </div>

          {/* Recent Prescriptions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              📋 Recent Prescriptions
            </h2>
            
            {recentPrescriptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">📄</p>
                <p>No prescriptions yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentPrescriptions.map((prescription) => (
                  <div
                    key={prescription.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {prescription.patients?.name || 'Unknown Patient'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{prescription.diagnosis}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(prescription.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(prescription.status)}`}>
                        {prescription.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => navigate('/prescriptions')}
              className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All Prescriptions →
            </button>
          </div>
        </div>

        {/* Pending Lab Results */}
        {stats.pendingLabResults > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              🔬 Pending Lab Results
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                {stats.pendingLabResults} pending
              </span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingLabs.map((lab) => (
                <div
                  key={lab.id}
                  className="border border-yellow-200 bg-yellow-50 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">
                        {lab.patients?.name || 'Unknown Patient'}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">{lab.test_name}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {lab.test_type} • {new Date(lab.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(lab.status)}`}>
                      {lab.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => navigate('/laboratory')}
              className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All Lab Tests →
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <DoctorAppointmentBooking 
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onSuccess={fetchDoctorData}
      />
      
      <PatientReferral 
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        onSuccess={fetchDoctorData}
      />
    </DashboardLayout>
  )
}

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-600 text-sm font-medium">{title}</p>
        <h3 className="text-3xl font-bold mt-2">{value}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="text-4xl">{icon}</div>
    </div>
  </div>
)

export default DoctorDashboard
