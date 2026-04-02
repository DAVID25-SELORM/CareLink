import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'

/**
 * Appointments Page
 * Manage patient appointments
 */

const Appointments = () => {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    appointment_date: '',
    appointment_time: '',
    reason: ''
  })

  useEffect(() => {
    fetchAppointments()
    fetchPatients()
    fetchDoctors()
  }, [])

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients (name, phone),
          users (email, full_name)
        `)
        .order('appointment_date', { ascending: true })

      if (error) throw error
      setAppointments(data || [])
    } catch (error) {
      console.error('Error fetching appointments:', error)
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name')
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
        .select('id, email')
        .eq('role', 'doctor')

      if (error) throw error
      setDoctors(data || [])
    } catch (error) {
      console.error('Error fetching doctors:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const selectedDoctor = doctors.find((doctor) => doctor.id === formData.doctor_id)
      const appointmentPayload = {
        ...formData,
        doctor_name: selectedDoctor?.email || null,
        status: 'scheduled',
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert([appointmentPayload])
        .select()
        .single()

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'create_appointment',
        tableName: 'appointments',
        recordId: data.id,
        newValues: appointmentPayload,
      })

      toast.success('Appointment booked successfully!')
      setFormData({ patient_id: '', doctor_id: '', appointment_date: '', appointment_time: '', reason: '' })
      setShowAddForm(false)
      fetchAppointments()
    } catch (error) {
      console.error('Error booking appointment:', error)
      toast.error('Failed to book appointment')
    }
  }

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      const appointment = appointments.find((item) => item.id === appointmentId)
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId)

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'update_appointment_status',
        tableName: 'appointments',
        recordId: appointmentId,
        oldValues: { status: appointment?.status || null },
        newValues: { status: newStatus },
      })

      toast.success(`Appointment ${newStatus}!`)
      fetchAppointments()
    } catch (error) {
      console.error('Error updating appointment:', error)
      toast.error('Failed to update appointment')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="spinner"></div>
        </div>
      </DashboardLayout>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const upcomingAppointments = appointments.filter(a => a.appointment_date >= today && a.status === 'scheduled')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-slate-800">Appointments Schedule</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all-smooth shadow-sm hover:shadow"
          >
            {showAddForm ? '✕ Close' : '+ New Appointment'}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Upcoming</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{upcomingAppointments.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Today</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {appointments.filter(a => a.appointment_date === today).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Completed</p>
            <p className="text-3xl font-bold text-slate-700 mt-2">
              {appointments.filter(a => a.status === 'completed').length}
            </p>
          </div>
        </div>

        {/* Add Appointment Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-soft p-6 border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-5">Book New Appointment</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={formData.patient_id}
                onChange={(e) => setFormData({...formData, patient_id: e.target.value})}
                required
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Select Patient</option>
                {patients.map(patient => (
                  <option key={patient.id} value={patient.id}>{patient.name}</option>
                ))}
              </select>
              <select
                value={formData.doctor_id}
                onChange={(e) => setFormData({...formData, doctor_id: e.target.value})}
                required
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Select Doctor</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>{doctor.email}</option>
                ))}
              </select>
              <input
                type="date"
                value={formData.appointment_date}
                onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
                required
                min={today}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <input
                type="time"
                value={formData.appointment_time}
                onChange={(e) => setFormData({...formData, appointment_time: e.target.value})}
                required
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Reason for appointment..."
                rows="3"
                className="md:col-span-2 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                type="submit"
                className="md:col-span-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg transition-all-smooth font-medium text-sm shadow-sm"
              >
                Book Appointment
              </button>
            </form>
          </div>
        )}

        {/* Appointments Table */}
        <div className="bg-white rounded-xl shadow-soft overflow-hidden border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-500 text-sm">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-2">📅</span>
                      <p>No appointments scheduled yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{appointment.patients?.name}</div>
                      <div className="text-xs text-slate-500">{appointment.patients?.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {appointment.users?.full_name || appointment.users?.email || appointment.doctor_name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{new Date(appointment.appointment_date).toLocaleDateString('en-GB')}</div>
                      <div className="text-xs text-slate-500">{appointment.appointment_time}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {appointment.reason || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        appointment.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
                        appointment.status === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200' :
                        'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {appointment.status === 'scheduled' && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                            className="text-green-600 hover:text-green-700 text-sm font-medium"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Appointments
