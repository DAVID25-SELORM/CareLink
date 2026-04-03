import { useState, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

/**
 * User Management Page
 * Admin interface to manage system users and assign roles/specialties
 * Author: David Gabion Selorm
 */

const DOCTOR_SPECIALTIES = [
  'General Practitioner',
  'Cardiologist',
  'Pediatrician',
  'Gynecologist',
  'Dermatologist',
  'Orthopedic Surgeon',
  'Psychiatrist',
  'Ophthalmologist',
  'ENT Specialist',
  'Neurologist',
  'Oncologist',
  'Radiologist',
  'Anesthesiologist',
  'Pathologist',
  'Urologist',
  'Gastroenterologist',
  'Endocrinologist',
  'Rheumatologist',
  'Pulmonologist',
  'Nephrologist',
  'Dietician/Nutritionist',
  'Optometrist',
  'Physiotherapist',
  'Dentist',
  'General Surgeon',
  'Neurosurgeon',
  'Plastic Surgeon',
  'Obstetrician',
  'Speech Therapist',
  'Occupational Therapist',
  'Clinical Psychologist',
  'Hematologist',
  'Allergist/Immunologist',
  'Infectious Disease Specialist',
  'Geriatrician',
  'Emergency Medicine Specialist'
]

const NURSE_TYPES = [
  'General Nurse',
  'Midwife'
]

const ROLES = ['admin', 'doctor', 'pharmacist', 'cashier', 'nurse', 'records_officer']

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'doctor',
    specialty: '',
    full_name: '',
    phone: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Step 1: Create authentication user using regular signup
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: formData.role,
            full_name: formData.full_name,
            phone: formData.phone,
            specialty: (formData.role === 'doctor' || formData.role === 'nurse') ? formData.specialty : null
          }
        }
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('User creation failed - no user data returned')
      }

      // Step 2: Insert/Update user record with role and specialty
      const userData = {
        id: authData.user.id,
        email: formData.email,
        role: formData.role,
        full_name: formData.full_name,
        phone: formData.phone
      }

      // Add specialty for doctors and nurses
      if ((formData.role === 'doctor' || formData.role === 'nurse') && formData.specialty) {
        userData.specialty = formData.specialty
      }

      const { error: insertError } = await supabase
        .from('users')
        .upsert([userData], { onConflict: 'id' })

      if (insertError) throw insertError

      toast.success(`User ${formData.full_name || formData.email} created successfully! They can now login.`)
      setShowModal(false)
      resetForm()
      fetchUsers()

    } catch (error) {
      console.error('Error creating user:', error)
      toast.error(error.message || 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      role: 'doctor',
      specialty: '',
      full_name: '',
      phone: ''
    })
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      
      toast.success('User role updated successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user role')
    }
  }

  const updateUserSpecialty = async (userId, newSpecialty) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ specialty: newSpecialty })
        .eq('id', userId)

      if (error) throw error
      
      toast.success('Specialty updated successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error updating specialty:', error)
      toast.error('Failed to update specialty')
    }
  }

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      doctor: 'bg-blue-100 text-blue-800',
      pharmacist: 'bg-green-100 text-green-800',
      cashier: 'bg-purple-100 text-purple-800',
      nurse: 'bg-pink-100 text-pink-800',
      records_officer: 'bg-indigo-100 text-indigo-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
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
      'Oncologist': '🎗️'
    }
    return icons[specialty] || '🩺'
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
            <p className="text-gray-600 mt-1">Manage system users, roles, and specialties</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Add New User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {ROLES.map(role => {
            const count = users.filter(u => u.role === role).length
            return (
              <div key={role} className="bg-white rounded-lg shadow p-4">
                <p className="text-gray-600 text-sm capitalize">{role}s</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            )
          })}
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.phone || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        className={`text-xs px-3 py-1 rounded-full font-semibold ${getRoleBadgeColor(user.role)} border-none cursor-pointer`}
                      >
                        {ROLES.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'doctor' ? (
                        <select
                          value={user.specialty || ''}
                          onChange={(e) => updateUserSpecialty(user.id, e.target.value)}
                          className="text-sm px-3 py-1 border border-gray-300 rounded cursor-pointer bg-white"
                        >
                          <option value="">Select Specialty</option>
                          {DOCTOR_SPECIALTIES.map(specialty => (
                            <option key={specialty} value={specialty}>
                              {getSpecialtyIcon(specialty)} {specialty}
                            </option>
                          ))}
                        </select>
                      ) : user.role === 'nurse' ? (
                        <select
                          value={user.specialty || ''}
                          onChange={(e) => updateUserSpecialty(user.id, e.target.value)}
                          className="text-sm px-3 py-1 border border-gray-300 rounded cursor-pointer bg-white"
                        >
                          <option value="">Select Type</option>
                          {NURSE_TYPES.map(type => (
                            <option key={type} value={type}>
                              👩‍⚕️ {type}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add User Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Add New User</h2>
                <button
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Dr. Sarah Johnson"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="doctor@carelink.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Minimum 6 characters"
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+233244123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {ROLES.map(role => (
                      <option key={role} value={role} className="capitalize">
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.role === 'doctor' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Medical Specialty *
                    </label>
                    <select
                      required={formData.role === 'doctor'}
                      value={formData.specialty}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Specialty</option>
                      {DOCTOR_SPECIALTIES.map(specialty => (
                        <option key={specialty} value={specialty}>
                          {getSpecialtyIcon(specialty)} {specialty}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.role === 'nurse' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nurse Type *
                    </label>
                    <select
                      required={formData.role === 'nurse'}
                      value={formData.specialty}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Type</option>
                      {NURSE_TYPES.map(type => (
                        <option key={type} value={type}>
                          👩‍⚕️ {type}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {isSubmitting ? 'Creating...' : 'Create User'}
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

export default UserManagement
