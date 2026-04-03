import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'

/**
 * Referrals Management Page
 * View and manage patient referrals (received and sent)
 * Author: David Gabion Selorm
 */

const Referrals = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('received') // 'received' or 'sent'
  const [receivedReferrals, setReceivedReferrals] = useState([])
  const [sentReferrals, setSentReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReferral, setSelectedReferral] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    if (user) {
      fetchReferrals()
    }
  }, [user])

  const fetchReferrals = async () => {
    try {
      setLoading(true)

      // Fetch received referrals (where I'm the referred-to doctor)
      const { data: received, error: receivedError } = await supabase
        .from('referrals')
        .select('*, patients(name, age, gender, phone)')
        .eq('referred_to_doctor_id', user.id)
        .order('created_at', { ascending: false })

      if (receivedError) throw receivedError
      setReceivedReferrals(received || [])

      // Fetch sent referrals (where I'm the referring doctor)
      const { data: sent, error: sentError } = await supabase
        .from('referrals')
        .select('*, patients(name, age, gender, phone)')
        .eq('referring_doctor_id', user.id)
        .order('created_at', { ascending: false })

      if (sentError) throw sentError
      setSentReferrals(sent || [])

    } catch (error) {
      console.error('Error fetching referrals:', error)
      toast.error('Failed to load referrals')
    } finally {
      setLoading(false)
    }
  }

  const updateReferralStatus = async (referralId, newStatus) => {
    try {
      const referral = receivedReferrals.find(r => r.id === referralId)
      
      const { error } = await supabase
        .from('referrals')
        .update({ status: newStatus })
        .eq('id', referralId)

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'update_referral_status',
        tableName: 'referrals',
        recordId: referralId,
        oldValues: { status: referral?.status },
        newValues: { status: newStatus }
      })

      toast.success(`Referral ${newStatus}!`)
      fetchReferrals()
    } catch (error) {
      console.error('Error updating referral:', error)
      toast.error('Failed to update referral')
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'accepted': 'bg-blue-100 text-blue-800 border-blue-300',
      'completed': 'bg-green-100 text-green-800 border-green-300',
      'rejected': 'bg-red-100 text-red-800 border-red-300'
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getUrgencyColor = (urgency) => {
    const colors = {
      'routine': 'bg-gray-100 text-gray-700',
      'urgent': 'bg-orange-100 text-orange-700',
      'emergency': 'bg-red-100 text-red-700'
    }
    return colors[urgency] || 'bg-gray-100 text-gray-700'
  }

  const getUrgencyIcon = (urgency) => {
    const icons = {
      'routine': '📅',
      'urgent': '⚠️',
      'emergency': '🚨'
    }
    return icons[urgency] || '📅'
  }

  const ReferralCard = ({ referral, type }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-800">
            {referral.patients?.name || 'Unknown Patient'}
          </h3>
          <p className="text-sm text-gray-600">
            {referral.patients?.age}y, {referral.patients?.gender} • {referral.patients?.phone}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(referral.status)}`}>
            {referral.status.toUpperCase()}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${getUrgencyColor(referral.urgency)}`}>
            {getUrgencyIcon(referral.urgency)} {referral.urgency.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {type === 'received' ? (
          <div className="text-sm">
            <span className="text-gray-600">From:</span>
            <span className="font-medium text-gray-800 ml-2">
              {referral.referring_doctor_name} ({referral.referring_doctor_specialty})
            </span>
          </div>
        ) : (
          <div className="text-sm">
            <span className="text-gray-600">To:</span>
            <span className="font-medium text-gray-800 ml-2">
              {referral.referred_to_doctor_name} ({referral.referred_to_doctor_specialty})
            </span>
          </div>
        )}

        <div className="text-sm">
          <span className="text-gray-600">Reason:</span>
          <p className="text-gray-800 mt-1">{referral.reason}</p>
        </div>

        {referral.notes && (
          <div className="text-sm">
            <span className="text-gray-600">Clinical Notes:</span>
            <p className="text-gray-700 mt-1 bg-gray-50 p-2 rounded">{referral.notes}</p>
          </div>
        )}

        <div className="text-xs text-gray-500 mt-2">
          Referred on {new Date(referral.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t">
        <button
          onClick={() => {
            setSelectedReferral(referral)
            setShowDetailsModal(true)
          }}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
        >
          View Details
        </button>

        {type === 'received' && referral.status === 'pending' && (
          <>
            <button
              onClick={() => updateReferralStatus(referral.id, 'accepted')}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              ✓ Accept
            </button>
            <button
              onClick={() => updateReferralStatus(referral.id, 'rejected')}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
            >
              ✗ Reject
            </button>
          </>
        )}

        {type === 'received' && referral.status === 'accepted' && (
          <button
            onClick={() => updateReferralStatus(referral.id, 'completed')}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            Mark Completed
          </button>
        )}
      </div>
    </div>
  )

  const DetailsModal = () => {
    if (!showDetailsModal || !selectedReferral) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Referral Details</h2>
            <button
              onClick={() => setShowDetailsModal(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Patient Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Patient Information</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Name:</strong> {selectedReferral.patients?.name}</p>
                <p><strong>Age:</strong> {selectedReferral.patients?.age} years</p>
                <p><strong>Gender:</strong> {selectedReferral.patients?.gender}</p>
                <p><strong>Phone:</strong> {selectedReferral.patients?.phone}</p>
              </div>
            </div>

            {/* Referral Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Referral Information</h3>
              <div className="space-y-2 text-sm">
                <p><strong>From:</strong> {selectedReferral.referring_doctor_name} ({selectedReferral.referring_doctor_specialty})</p>
                <p><strong>To:</strong> {selectedReferral.referred_to_doctor_name} ({selectedReferral.referred_to_doctor_specialty})</p>
                <p><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedReferral.status)}`}>{selectedReferral.status}</span></p>
                <p><strong>Urgency:</strong> <span className={`px-2 py-1 rounded text-xs ${getUrgencyColor(selectedReferral.urgency)}`}>{selectedReferral.urgency}</span></p>
                <p><strong>Date:</strong> {new Date(selectedReferral.created_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Clinical Details */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Clinical Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Reason for Referral:</p>
                  <p className="text-gray-800 mt-1">{selectedReferral.reason}</p>
                </div>
                {selectedReferral.notes && (
                  <div>
                    <p className="font-medium text-gray-700">Clinical Notes:</p>
                    <p className="text-gray-800 mt-1 whitespace-pre-wrap">{selectedReferral.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <button
              onClick={() => setShowDetailsModal(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading referrals...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const currentReferrals = activeTab === 'received' ? receivedReferrals : sentReferrals

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">🔄 Patient Referrals</h1>
          <p className="text-gray-600 mt-1">Manage your incoming and outgoing patient referrals</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'received'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📥 Received ({receivedReferrals.length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'sent'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📤 Sent ({sentReferrals.length})
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700">Pending Received</p>
            <p className="text-2xl font-bold text-yellow-900">
              {receivedReferrals.filter(r => r.status === 'pending').length}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">Accepted</p>
            <p className="text-2xl font-bold text-blue-900">
              {receivedReferrals.filter(r => r.status === 'accepted').length}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">Completed</p>
            <p className="text-2xl font-bold text-green-900">
              {receivedReferrals.filter(r => r.status === 'completed').length}
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-700">Total Sent</p>
            <p className="text-2xl font-bold text-purple-900">
              {sentReferrals.length}
            </p>
          </div>
        </div>

        {/* Referrals List */}
        {currentReferrals.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-4xl mb-3">
              {activeTab === 'received' ? '📥' : '📤'}
            </p>
            <p className="text-gray-600 text-lg">
              {activeTab === 'received' 
                ? 'No referrals received yet'
                : 'No referrals sent yet'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {currentReferrals.map(referral => (
              <ReferralCard
                key={referral.id}
                referral={referral}
                type={activeTab}
              />
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      <DetailsModal />
    </DashboardLayout>
  )
}

export default Referrals
