import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'

/**
 * Blood Bank Management System
 * Track blood inventory, donations, and requests
 * Author: David Gabion Selorm
 */

const BloodBank = () => {
  const { user } = useAuth()
  const [inventory, setInventory] = useState([])
  const [donations, setDonations] = useState([])
  const [requests, setRequests] = useState([])
  const [activeTab, setActiveTab] = useState('inventory')
  const [showDonationForm, setShowDonationForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [patients, setPatients] = useState([])
  const [donationFormData, setDonationFormData] = useState({
    donor_name: '',
    donor_phone: '',
    blood_type: 'o_positive',
    units: '1',
    screening_results: 'safe',
    expiry_date: ''
  })
  const [requestFormData, setRequestFormData] = useState({
    patient_id: '',
    blood_type: 'o_positive',
    units_requested: '1',
    urgency: 'routine',
    reason: ''
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const [invData, donData, reqData, patData] = await Promise.all([
      supabase.from('blood_inventory').select('*').order('blood_type'),
      supabase.from('blood_donations').select('*, users(full_name)').order('created_at', { ascending: false }).limit(20),
      supabase.from('blood_requests').select('*, patients(name, patient_id), users(full_name)').order('created_at', { ascending: false }).limit(20),
      supabase.from('patients').select('id, name, patient_id').order('name')
    ])
    setInventory(invData.data || [])
    setDonations(donData.data || [])
    setRequests(reqData.data || [])
    setPatients(patData.data || [])
  }

  const recordDonation = async (e) => {
    e.preventDefault()
    try {
      const units = parseInt(donationFormData.units)
      
      const { error: donError } = await supabase.from('blood_donations').insert([{
        ...donationFormData,
        units,
        collected_by: user.id
      }])

      if (donError) throw donError

      await logAuditEvent({ user, action: 'record_blood_donation', tableName: 'blood_donations', newValues: { ...donationFormData, units, collected_by: user.id } })

      // Update inventory
      const existing = inventory.find(i => i.blood_type === donationFormData.blood_type)
      if (existing) {
        await supabase.from('blood_inventory').update({
          units_available: existing.units_available + units
        }).eq('id', existing.id)
      }

      toast.success('Donation recorded!')
      setShowDonationForm(false)
      setDonationFormData({ donor_name: '', donor_phone: '', blood_type: 'o_positive', units: '1', screening_results: 'safe', expiry_date: '' })
      fetchAll()
    } catch (error) {
      toast.error('Failed to record donation')
    }
  }

  const submitRequest = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('blood_requests').insert([{
        ...requestFormData,
        units_requested: parseInt(requestFormData.units_requested),
        requested_by: user.id,
        status: 'pending'
      }])

      if (error) throw error

      await logAuditEvent({ user, action: 'submit_blood_request', tableName: 'blood_requests', newValues: { ...requestFormData, units_requested: parseInt(requestFormData.units_requested), requested_by: user.id, status: 'pending' } })

      toast.success('Blood request submitted!')
      setShowRequestForm(false)
      setRequestFormData({ patient_id: '', blood_type: 'o_positive', units_requested: '1', urgency: 'routine', reason: '' })
      fetchAll()
    } catch (error) {
      toast.error('Failed to submit request')
    }
  }

  const fulfillRequest = async (requestId, bloodType, units) => {
    const inventoryItem = inventory.find(i => i.blood_type === bloodType)
    if (!inventoryItem || inventoryItem.units_available < units) {
      toast.error('Insufficient blood units available!')
      return
    }

    try {
      await supabase.from('blood_requests').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() }).eq('id', requestId)
      await supabase.from('blood_inventory').update({ units_available: inventoryItem.units_available - units }).eq('id', inventoryItem.id)
      
      toast.success('Request fulfilled!')
      fetchAll()
    } catch (error) {
      toast.error('Failed to fulfill request')
    }
  }

  const bloodTypes = {
    'a_positive': 'A+', 'a_negative': 'A-', 'b_positive': 'B+', 'b_negative': 'B-',
    'ab_positive': 'AB+', 'ab_negative': 'AB-', 'o_positive': 'O+', 'o_negative': 'O-'
  }

  const totalUnits = inventory.reduce((sum, item) => sum + item.units_available, 0)
  const criticalStock = inventory.filter(i => i.units_available < i.minimum_units)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Blood Bank</h1>
            <p className="text-gray-600">Manage blood inventory & requests</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDonationForm(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg">
              🩸 Record Donation
            </button>
            <button onClick={() => setShowRequestForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
              📋 Request Blood
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
            <h4 className="text-red-100 text-sm">Total Units</h4>
            <h2 className="text-5xl font-bold mt-2">{totalUnits}</h2>
          </div>
          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <h4 className="text-orange-100 text-sm">Critical Stock</h4>
            <h2 className="text-5xl font-bold mt-2">{criticalStock.length}</h2>
          </div>
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <h4 className="text-blue-100 text-sm">Pending Requests</h4>
            <h2 className="text-5xl font-bold mt-2">{requests.filter(r => r.status === 'pending').length}</h2>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border">
          <div className="flex overflow-x-auto">
            {['inventory', 'donations', 'requests'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium ${activeTab === tab ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-600'}`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'inventory' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {inventory.map(item => (
              <div key={item.id} className={`card ${item.units_available < item.minimum_units ? 'border-2 border-red-500' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-3xl font-bold text-red-600">{bloodTypes[item.blood_type]}</div>
                  {item.units_available < item.minimum_units && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">LOW</span>}
                </div>
                <div className="text-4xl font-bold mb-1">{item.units_available}</div>
                <div className="text-sm text-gray-600">units available</div>
                <div className="text-xs text-gray-500 mt-2">Min: {item.minimum_units} units</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'donations' && (
          <div className="card">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blood Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Screening</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {donations.map(donation => {
                  const isExpiringSoon = donation.expiry_date && (() => {
                    const daysLeft = Math.ceil((new Date(donation.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
                    return daysLeft <= 7
                  })()
                  const isExpired = donation.expiry_date && new Date(donation.expiry_date) < new Date()
                  return (
                  <tr key={donation.id} className={`border-t ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3 text-sm">{new Date(donation.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{donation.donor_name}</div>
                      <div className="text-sm text-gray-500">{donation.donor_phone}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600">{bloodTypes[donation.blood_type]}</td>
                    <td className="px-4 py-3">{donation.units}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${donation.screening_results === 'safe' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {donation.screening_results}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {donation.expiry_date ? (
                        <span className={`px-2 py-1 rounded text-xs ${
                          isExpired ? 'bg-red-100 text-red-800 font-semibold' :
                          isExpiringSoon ? 'bg-yellow-100 text-yellow-800 font-semibold' :
                          'text-gray-600'
                        }`}>
                          {new Date(donation.expiry_date).toLocaleDateString()}
                          {isExpired && ' ⚠ EXPIRED'}
                          {!isExpired && isExpiringSoon && ' ⚠ Soon'}
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="card">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blood Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{req.patients?.name}</div>
                      <div className="text-sm text-gray-500">{req.patients?.patient_id}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600">{bloodTypes[req.blood_type]}</td>
                    <td className="px-4 py-3">{req.units_requested}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${req.urgency === 'emergency' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {req.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${req.status === 'fulfilled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {req.status === 'pending' && (
                        <button onClick={() => fulfillRequest(req.id, req.blood_type, req.units_requested)} className="text-green-600 text-sm font-medium">
                          Fulfill
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showDonationForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Record Blood Donation</h3>
              <form onSubmit={recordDonation} className="space-y-4">
                <input required type="text" placeholder="Donor Name" value={donationFormData.donor_name} onChange={(e) => setDonationFormData({...donationFormData, donor_name: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <input required type="tel" placeholder="Donor Phone" value={donationFormData.donor_phone} onChange={(e) => setDonationFormData({...donationFormData, donor_phone: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <select required value={donationFormData.blood_type} onChange={(e) => setDonationFormData({...donationFormData, blood_type: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                  {Object.entries(bloodTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <input required type="number" min="1" placeholder="Units" value={donationFormData.units} onChange={(e) => setDonationFormData({...donationFormData, units: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <select required value={donationFormData.screening_results} onChange={(e) => setDonationFormData({...donationFormData, screening_results: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                  <option value="safe">Safe</option>
                  <option value="rejected">Rejected</option>
                </select>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" value={donationFormData.expiry_date} onChange={(e) => setDonationFormData({...donationFormData, expiry_date: e.target.value})} className="w-full px-4 py-2 border rounded-lg" min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg">Save</button>
                  <button type="button" onClick={() => setShowDonationForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showRequestForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Blood Request</h3>
              <form onSubmit={submitRequest} className="space-y-4">
                <select required value={requestFormData.patient_id} onChange={(e) => setRequestFormData({...requestFormData, patient_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                  <option value="">Select Patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name} - {p.patient_id}</option>)}
                </select>
                <select required value={requestFormData.blood_type} onChange={(e) => setRequestFormData({...requestFormData, blood_type: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                  {Object.entries(bloodTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <input required type="number" min="1" placeholder="Units Needed" value={requestFormData.units_requested} onChange={(e) => setRequestFormData({...requestFormData, units_requested: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <select required value={requestFormData.urgency} onChange={(e) => setRequestFormData({...requestFormData, urgency: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
                <textarea required placeholder="Reason" value={requestFormData.reason} onChange={(e) => setRequestFormData({...requestFormData, reason: e.target.value})} className="w-full px-4 py-2 border rounded-lg" rows="2" />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg">Submit</button>
                  <button type="button" onClick={() => setShowRequestForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default BloodBank
