import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'

/**
 * Patient Registration Page
 * Register new patients into the system
 */

// Private Health Insurance Companies in Ghana
const PRIVATE_INSURANCE_COMPANIES = [
  'Acacia Health Insurance',
  'Ace Medical Insurance',
  'Apex Health Insurance',
  'Best Assurance Health Insurance',
  'Cosmopolitan Health Insurance',
  'Dosh Health Insurance',
  'Emple Health Insurance',
  'Equity Health Insurance',
  'Glico Healthcare',
  'Healthnet Insurance Ghana',
  'International Health Insurance Ghana',
  'Nationwide Medical Insurance',
  'Nova Health Insurance',
  'Petra Health Insurance',
  'Premier Health Insurance',
  'Ultimate Health Insurance',
  'UnitedHealthcare Ghana',
  'Other'
]

const PatientRegistration = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    phone: '',
    nhis_number: '',
    insurance_type: '',
    insurance_name: '',
    insurance_number: '',
    address: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const patientPayload = {
        name: formData.name,
        age: parseInt(formData.age),
        gender: formData.gender,
        phone: formData.phone,
        nhis_number: formData.nhis_number || null,
        insurance_type: formData.insurance_type || null,
        insurance_name: formData.insurance_name || null,
        insurance_number: formData.insurance_number || null,
        address: formData.address || null,
      }

      const { data, error } = await supabase
        .from('patients')
        .insert([patientPayload])
        .select()
        .single()

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'create_patient',
        tableName: 'patients',
        recordId: data.id,
        newValues: patientPayload,
      })

      toast.success('Patient registered successfully!')
      navigate('/patients')
    } catch (error) {
      console.error('Error registering patient:', error)
      toast.error('Failed to register patient')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-2 sm:px-0">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 lg:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-dark mb-4 sm:mb-6">Register New Patient</h2>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base"
                  placeholder="Enter patient's full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  required
                  min="0"
                  max="150"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base"
                  placeholder="Age"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0241234567"
                />
              </div>
            </div>

            {/* Insurance Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Insurance Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance Type
                  </label>
                  <select
                    name="insurance_type"
                    value={formData.insurance_type}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">None</option>
                    <option value="nhis">NHIS</option>
                    <option value="private">Private Insurance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NHIS Number
                  </label>
                  <input
                    type="text"
                    name="nhis_number"
                    value={formData.nhis_number}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="NHIS number (if applicable)"
                  />
                </div>

                {formData.insurance_type === 'private' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Insurance Company Name <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="insurance_name"
                        value={formData.insurance_name}
                        onChange={handleChange}
                        required={formData.insurance_type === 'private'}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select Insurance Company</option>
                        {PRIVATE_INSURANCE_COMPANIES.map((company) => (
                          <option key={company} value={company}>
                            {company}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Insurance Number/Policy Number
                      </label>
                      <input
                        type="text"
                        name="insurance_number"
                        value={formData.insurance_number}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="e.g., HI-2024-123456"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Residential Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter patient's address"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => navigate('/patients')}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register Patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default PatientRegistration
