import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'

/**
 * Bed and Ward Management System
 * Track bed occupancy, manage admissions and discharges
 * Author: David Gabion Selorm
 */

const BedManagement = () => {
  const { user } = useAuth()
  const [wards, setWards] = useState([])
  const [beds, setBeds] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedWard, setSelectedWard] = useState(null)
  const [showAdmitForm, setShowAdmitForm] = useState(false)
  const [formData, setFormData] = useState({
    patient_id: '',
    ward_id: '',
    bed_id: '',
    diagnosis: '',
    admission_type: 'emergency',
    admission_notes: '',
    expected_discharge_date: ''
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([
      fetchWards(),
      fetchBeds(),
      fetchAdmissions(),
      fetchPatients()
    ])
    setLoading(false)
  }

  const fetchWards = async () => {
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setWards(data || [])
      if (data && data.length > 0 &&!selectedWard) {
        setSelectedWard(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching wards:', error)
    }
  }

  const fetchBeds = async () => {
    try {
      const {data, error } = await supabase
        .from('beds')
        .select(`
          *,
          patients (name, patient_id),
          wards (name, ward_type)
        `)
        .order('bed_number')

      if (error) throw error
      setBeds(data || [])
    } catch (error) {
      console.error('Error fetching beds:', error)
    }
  }

  const fetchAdmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('admissions')
        .select(`
          *,
          patients (name, phone, patient_id),
          beds (bed_number),
          wards (name),
          users:admitted_by (full_name, email)
        `)
        .eq('status', 'admitted')
        .order('admission_date', { ascending: false })

      if (error) throw error
      setAdmissions(data || [])
    } catch (error) {
      console.error('Error fetching admissions:', error)
    }
  }

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, patient_id, phone')
        .order('name')

      if (error) throw error
      setPatients(data || [])
    } catch (error) {
      console.error('Error fetching patients:', error)
    }
  }

  const admitPatient = async (e) => {
    e.preventDefault()

    try {
      // Check if bed is available
      const { data: bedData } = await supabase
        .from('beds')
        .select('status')
        .eq('id', formData.bed_id)
        .single()

      if (bedData?.status !== 'available') {
        toast.error('Selected bed is not available')
        return
      }

      // Create admission
      const { data: admission, error: admissionError } = await supabase
        .from('admissions')
        .insert([{
          ...formData,
          admitted_by: user.id,
          status: 'admitted'
        }])
        .select()
        .single()

      if (admissionError) throw admissionError

      // Update bed status
      const { error: bedError } = await supabase
        .from('beds')
        .update({
          status: 'occupied',
          current_patient_id: formData.patient_id,
          assigned_at: new Date().toISOString()
        })
        .eq('id', formData.bed_id)

      if (bedError) throw bedError

      // Update ward available beds
      const { error: wardError } = await supabase
        .rpc('decrement_ward_beds', { ward_id: formData.ward_id })

      toast.success('Patient admitted successfully!')
      setShowAdmitForm(false)
      setFormData({
        patient_id: '',
        ward_id: '',
        bed_id: '',
        diagnosis: '',
        admission_type: 'emergency',
        admission_notes: '',
        expected_discharge_date: ''
      })
      fetchAll()
    } catch (error) {
      console.error('Error admitting patient:', error)
      toast.error('Failed to admit patient')
    }
  }

  const dischargePatient = async (admissionId, bedId) => {
    if (!confirm('Are you sure you want to discharge this patient?')) return

    try {
      // Update admission
      const { error: admissionError } = await supabase
        .from('admissions')
        .update({
          status: 'discharged',
          discharge_date: new Date().toISOString(),
          discharged_by: user.id
        })
        .eq('id', admissionId)

      if (admissionError) throw admissionError

      // Free up bed
      const { error: bedError } = await supabase
        .from('beds')
        .update({
          status: 'cleaning',
          current_patient_id: null
        })
        .eq('id', bedId)

      if (bedError) throw bedError

      toast.success('Patient discharged successfully!')
      fetchAll()
    } catch (error) {
      console.error('Error discharging patient:', error)
      toast.error('Failed to discharge patient')
    }
  }

  const getWardBeds = (wardId) => beds.filter(b => b.ward_id === wardId)
  const getAvailableBeds = (wardId) => beds.filter(b => b.ward_id === wardId && b.status === 'available')
  
  const getBedStatusColor = (status) => {
    const colors = {
      available: 'bg-green-500',
      occupied: 'bg-red-500',
      reserved: 'bg-yellow-500',
      under_maintenance: 'bg-gray-500',
      cleaning: 'bg-blue-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const selectedWardData = wards.find(w => w.id === selectedWard)
  const selectedWardBeds = getWardBeds(selectedWard)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Bed & Ward Management</h1>
            <p className="text-gray-600 mt-1">Track bed occupancy and manage patient admissions</p>
          </div>
          <button
            onClick={() => setShowAdmitForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            + Admit Patient
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <h4 className="text-blue-100 text-sm font-medium">Total Beds</h4>
            <h2 className="text-4xl font-bold mt-2">{beds.length}</h2>
            <p className="text-blue-100 text-sm mt-1">All wards</p>
          </div>
          
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <h4 className="text-green-100 text-sm font-medium">Available</h4>
            <h2 className="text-4xl font-bold mt-2">
              {beds.filter(b => b.status === 'available').length}
            </h2>
            <p className="text-green-100 text-sm mt-1">Ready for use</p>
          </div>
          
          <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
            <h4 className="text-red-100 text-sm font-medium">Occupied</h4>
            <h2 className="text-4xl font-bold mt-2">
              {beds.filter(b => b.status === 'occupied').length}            </h2>
            <p className="text-red-100 text-sm mt-1">Currently in use</p>
          </div>
          
          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <h4 className="text-purple-100 text-sm font-medium">Admissions</h4>
            <h2 className="text-4xl font-bold mt-2">{admissions.length}</h2>
            <p className="text-purple-100 text-sm mt-1">Active patients</p>
          </div>
        </div>

        {/* Ward Selector */}
        <div className="card">
          <h3 className="font-semibold mb-3">Select Ward</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {wards.map((ward) => {
              const wardBeds = getWardBeds(ward.id)
              const available = wardBeds.filter(b => b.status === 'available').length
              const occupancy = ((wardBeds.length - available) / wardBeds.length * 100).toFixed(0)
              
              return (
                <button
                  key={ward.id}
                  onClick={() => setSelectedWard(ward.id)}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    selectedWard === ward.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h4 className="font-semibold text-sm">{ward.name}</h4>
                  <p className="text-xs text-gray-600 mt-1">{ward.ward_type}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${occupancy}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold">{occupancy}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {available}/{wardBeds.length} available
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bed Map */}
        {selectedWardData && (
          <div className="card">
            <h3 className="font-semibold mb-4">
              {selectedWardData.name} - Bed Layout
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
              {selectedWardBeds.map((bed) => (
                <div
                  key={bed.id}
                  className={`relative aspect-square rounded-lg ${getBedStatusColor(bed.status)} p-2 text-white flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition`}
                  title={`${bed.bed_number} - ${bed.status}${bed.patients ? `: ${bed.patients.name}` : ''}`}
                >
                  <div className="text-xs font-bold">{bed.bed_number}</div>
                  {bed.patients && (
                    <div className="text-[10px] mt-1 truncate w-full text-center">
                      {bed.patients.name.split(' ')[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span>Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span>Reserved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span>Cleaning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-500"></div>
                <span>Maintenance</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Admissions */}
        <div className="card">
          <h3 className="font-semibold mb-4">Active Admissions ({admissions.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ward</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diagnosis</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admitted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {admissions.map((admission) => (
                  <tr key={admission.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{admission.patients?.name}</div>
                      <div className="text-sm text-gray-500">{admission.patients?.patient_id}</div>
                    </td>
                    <td className="px-4 py-3">{admission.wards?.name}</td>
                    <td className="px-4 py-3">{admission.beds?.bed_number}</td>
                    <td className="px-4 py-3 text-sm">{admission.diagnosis}</td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(admission.admission_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => dischargePatient(admission.id, admission.bed_id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Discharge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admit Patient Modal */}
        {showAdmitForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Admit Patient</h3>
              
              <form onSubmit={admitPatient} className="space-y-4">
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
                    Ward *
                  </label>
                  <select
                    required
                    value={formData.ward_id}
                    onChange={(e) => {
                      setFormData({...formData, ward_id: e.target.value, bed_id: ''})
                    }}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select ward</option>
                    {wards.map((ward) => (
                      <option key={ward.id} value={ward.id}>
                        {ward.name} ({getAvailableBeds(ward.id).length} available)
                      </option>
                    ))}
                  </select>
                </div>

                {formData.ward_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bed *
                    </label>
                    <select
                      required
                      value={formData.bed_id}
                      onChange={(e) => setFormData({...formData, bed_id: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select bed</option>
                      {getAvailableBeds(formData.ward_id).map((bed) => (
                        <option key={bed.id} value={bed.id}>
                          {bed.bed_number} ({bed.bed_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diagnosis *
                  </label>
                  <textarea
                    required
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({...formData, diagnosis: e.target.value})}
                    rows="2"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admission Type *
                  </label>
                  <select
                    required
                    value={formData.admission_type}
                    onChange={(e) => setFormData({...formData, admission_type: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="emergency">Emergency</option>
                    <option value="planned">Planned</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Admit Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdmitForm(false)}
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

export default BedManagement
