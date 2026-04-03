import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import { logAuditEvent } from '../services/auditLog'

/**
 * Patient Referral Component
 * Allows doctors to refer patients to other specialists/doctors
 * Author: David Gabion Selorm
 */

const PatientReferral = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth()
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    patient_id: '',
    referred_to_doctor_id: '',
    reason: '',
    notes: '',
    urgency: 'routine'
  })

  useEffect(() => {
    if (isOpen) {
      fetchPatients()
      fetchDoctors()
    }
  }, [isOpen, user])

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, phone, age, gender')
        .order('name')

      if (error) throw error
      setPatients(data || [])
    } catch (error) {
      console.error('Error fetching patients:', error)
      toast.error('Failed to load patients')
    }
  }

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, specialty')
        .eq('role', 'doctor')
        .neq('id', user.id) // Exclude current doctor
        .order('specialty')

      if (error) throw error
      setDoctors(data || [])
    } catch (error) {
      console.error('Error fetching doctors:', error)
      toast.error('Failed to load doctors')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Get referring doctor info
      const { data: referringDoctor, error: doctorError } = await supabase
        .from('users')
        .select('full_name, email, specialty')
        .eq('id', user.id)
        .single()

      if (doctorError) throw doctorError

      // Get referred-to doctor info
      const { data: referredDoctor, error: refDoctorError } = await supabase
        .from('users')
        .select('full_name, email, specialty')
        .eq('id', formData.referred_to_doctor_id)
        .single()

      if (refDoctorError) throw refDoctorError

      // Create referral
      const referralPayload = {
        patient_id: formData.patient_id,
        referring_doctor_id: user.id,
        referring_doctor_name: referringDoctor.full_name || referringDoctor.email,
        referring_doctor_specialty: referringDoctor.specialty,
        referred_to_doctor_id: formData.referred_to_doctor_id,
        referred_to_doctor_name: referredDoctor.full_name || referredDoctor.email,
        referred_to_doctor_specialty: referredDoctor.specialty,
        reason: formData.reason,
        notes: formData.notes,
        urgency: formData.urgency,
        status: 'pending'
      }

      const { data, error } = await supabase
        .from('referrals')
        .insert([referralPayload])
        .select()
        .single()

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'create_referral',
        tableName: 'referrals',
        recordId: data.id,
        newValues: referralPayload
      })

      toast.success(`Patient referred to ${referredDoctor.full_name || referredDoctor.email} successfully!`)
      setFormData({ patient_id: '', referred_to_doctor_id: '', reason: '', notes: '', urgency: 'routine' })
      onSuccess && onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating referral:', error)
      if (error.code === '42P01') {
        toast.error('Referrals table not found. Please run the database setup script.')
      } else {
        toast.error('Failed to create referral')
      }
    } finally {
      setLoading(false)
    }
  }

  // Group doctors by specialty
  const groupedDoctors = doctors.reduce((acc, doctor) => {
    const specialty = doctor.specialty || 'General Practitioner'
    if (!acc[specialty]) {
      acc[specialty] = []
    }
    acc[specialty].push(doctor)
    return acc
  }, {})

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">🔄 Refer Patient</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Patient *
            </label>
            <select
              value={formData.patient_id}
              onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a patient --</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} ({patient.age}y, {patient.gender}) - {patient.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Selection (Grouped by Specialty) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refer to Specialist/Doctor *
            </label>
            <select
              value={formData.referred_to_doctor_id}
              onChange={(e) => setFormData({ ...formData, referred_to_doctor_id: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a specialist --</option>
              {Object.entries(groupedDoctors).map(([specialty, docs]) => (
                <optgroup key={specialty} label={specialty}>
                  {docs.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.full_name || doctor.email} ({specialty})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {doctors.length} active doctors available
            </p>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Urgency Level *
            </label>
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="routine">Routine - Within 2 weeks</option>
              <option value="urgent">Urgent - Within 3 days</option>
              <option value="emergency">Emergency - Same day</option>
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Referral *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              required
              rows={2}
              placeholder="E.g., Suspected cardiac condition, Skin lesion requiring specialist evaluation..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinical Notes & Findings
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Patient history, relevant findings, test results, current medications..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Referring...' : 'Submit Referral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PatientReferral
