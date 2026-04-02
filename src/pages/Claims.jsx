import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'

/**
 * Claims Management Page
 * Track and manage insurance claims (NHIS & Private)
 */

const Claims = () => {
  const { user } = useAuth()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchClaims()
  }, [])

  const fetchClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('claims')
        .select(`
          *,
          patients (name, phone)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setClaims(data || [])
    } catch (error) {
      console.error('Error fetching claims:', error)
      toast.error('Failed to load claims')
    } finally {
      setLoading(false)
    }
  }

  const updateClaimStatus = async (claimId, newStatus) => {
    try {
      const claim = claims.find((item) => item.id === claimId)
      const updateData = { status: newStatus }

      if (newStatus === 'submitted') {
        updateData.submitted_at = new Date().toISOString()
      } else if (newStatus === 'approved') {
        updateData.approved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('claims')
        .update(updateData)
        .eq('id', claimId)

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'update_claim_status',
        tableName: 'claims',
        recordId: claimId,
        oldValues: {
          status: claim?.status || null,
          submitted_at: claim?.submitted_at || null,
          approved_at: claim?.approved_at || null,
        },
        newValues: updateData,
      })

      toast.success(`Claim ${newStatus} successfully!`)
      fetchClaims()
    } catch (error) {
      console.error('Error updating claim:', error)
      toast.error('Failed to update claim')
    }
  }

  const filteredClaims = claims.filter((claim) => {
    if (filter === 'all') return true
    return claim.status === filter
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'submitted':
        return 'bg-blue-100 text-blue-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCoverageLabel = (claim) => {
    if (claim.insurance_type === 'nhis') {
      return claim.claim_number || 'NHIS'
    }

    return claim.insurance_name || claim.claim_number || 'Private Insurance'
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

  const stats = {
    total: claims.length,
    pending: claims.filter((claim) => claim.status === 'pending').length,
    submitted: claims.filter((claim) => claim.status === 'submitted').length,
    approved: claims.filter((claim) => claim.status === 'approved').length,
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Total Claims</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Submitted</p>
            <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            >
              All Claims
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg ${filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-100'}`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('submitted')}
              className={`px-4 py-2 rounded-lg ${filter === 'submitted' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              Submitted
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg ${filter === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
            >
              Approved
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Insurance Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Insurance Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No claims found
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{claim.patients?.name}</div>
                      <div className="text-sm text-gray-600">{claim.patients?.phone}</div>
                    </td>
                    <td className="px-6 py-4 uppercase">
                      {claim.insurance_type}
                    </td>
                    <td className="px-6 py-4">
                      {getCoverageLabel(claim)}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      GHS {parseFloat(claim.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(claim.status)}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        {claim.status === 'pending' && (
                          <button
                            onClick={() => updateClaimStatus(claim.id, 'submitted')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Submit
                          </button>
                        )}
                        {claim.status === 'submitted' && (
                          <button
                            onClick={() => updateClaimStatus(claim.id, 'approved')}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            Approve
                          </button>
                        )}
                      </div>
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

export default Claims
