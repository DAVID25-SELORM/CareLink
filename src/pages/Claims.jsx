import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'
import { generateClaimPDF, downloadPDF, printPDF } from '../services/pdfService'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import PDFButton from '../components/PDFButton'
import FileUpload from '../components/FileUpload'

/**
 * Claims Management Page
 * Track and manage insurance claims (NHIS & Private)
 */

const Claims = () => {
  const { user } = useAuth()
  const { branding } = useHospitalBranding()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 20

  useEffect(() => {
    fetchClaims()
  }, [currentPage, filter])

  const fetchClaims = async () => {
    try {
      setLoading(true)
      const start = (currentPage - 1) * itemsPerPage
      const end = start + itemsPerPage - 1

      let query = supabase
        .from('claims')
        .select(`
          *,
          patients (name, phone)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end)

      // Apply filter if not 'all'
      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error, count } = await query

      if (error) throw error
      setClaims(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching claims:', error)
      toast.error('Failed to load claims')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter)
    setCurrentPage(1) // Reset to page 1 on filter change
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

  // Remove client-side filtering since we're doing it server-side now
  const filteredClaims = claims

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

  const handlePrintClaim = (claim) => {
    const pdf = generateClaimPDF(claim, branding)
    printPDF(pdf)
    toast.success('Claim form sent to printer')
  }

  const handleDownloadClaim = (claim) => {
    const pdf = generateClaimPDF(claim, branding)
    downloadPDF(pdf, `Claim_${claim.id}_${claim.patients?.name || 'Patient'}.pdf`)
    toast.success('Claim form downloaded successfully')
  }

  const handleFileUpload = (file) => {
    toast.success(`File "${file.name}" uploaded. (Note: File storage integration pending)`)
    setShowUploadModal(false)
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
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            >
              All Claims
            </button>
            <button
              onClick={() => handleFilterChange('pending')}
              className={`px-4 py-2 rounded-lg ${filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-100'}`}
            >
              Pending
            </button>
            <button
              onClick={() => handleFilterChange('submitted')}
              className={`px-4 py-2 rounded-lg ${filter === 'submitted' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              Submitted
            </button>
            <button
              onClick={() => handleFilterChange('approved')}
              className={`px-4 py-2 rounded-lg ${filter === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
            >
              Approved
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="table-scroll">
            <table className="min-w-[960px] divide-y divide-gray-200">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Export/Upload
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
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
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <PDFButton
                          onDownload={() => handleDownloadClaim(claim)}
                          onPrint={() => handlePrintClaim(claim)}
                          label="Form"
                          variant="outline"
                        />
                        <button
                          onClick={() => {
                            setSelectedClaim(claim)
                            setShowUploadModal(true)
                          }}
                          className="text-xs text-gray-600 hover:text-gray-800 underline"
                        >
                          Upload Docs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold">{claims.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-semibold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="font-semibold">{totalCount}</span> claims
                </p>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1.5 border rounded-lg ${
                            currentPage === pageNum
                              ? 'bg-primary text-white border-primary'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && selectedClaim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">
                Upload Supporting Documents
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Claim for {selectedClaim.patients?.name}
              </p>
              <FileUpload onFileSelect={handleFileUpload} multiple={true} />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setSelectedClaim(null)
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Claims
