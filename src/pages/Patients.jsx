import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { withTimeout } from '../services/queryTimeout'
import { generatePatientRecordPDF, downloadPDF, printPDF } from '../services/pdfService'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import PDFButton from '../components/PDFButton'
import FileUpload from '../components/FileUpload'
import { toast } from 'react-toastify'

/**
 * Patients List Page
 * View and search all registered patients
 */

const Patients = () => {
  const { branding } = useHospitalBranding()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadWarning, setLoadWarning] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 20

  useEffect(() => {
    fetchPatients()
  }, [currentPage, searchTerm])

  const fetchPatients = async () => {
    try {
      setLoading(true)
      const start = (currentPage - 1) * itemsPerPage
      const end = start + itemsPerPage - 1

      let query = supabase
        .from('patients')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end)

      // Apply search filter if present
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,nhis_number.ilike.%${searchTerm}%`)
      }

      const { data, error, count } = await withTimeout(query, 'Patients list')

      if (error) throw error
      setPatients(data || [])
      setTotalCount(count || 0)
      setLoadWarning('')
    } catch (error) {
      console.error('Error fetching patients:', error)
      setPatients([])
      setLoadWarning('Patients could not be loaded. Check your Supabase connection and table permissions.')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1) // Reset to page 1 on new search
  }

  const handlePrintPatientRecord = (patient) => {
    const pdf = generatePatientRecordPDF(patient, branding)
    printPDF(pdf)
    toast.success('Patient record sent to printer')
  }

  const handleDownloadPatientRecord = (patient) => {
    const pdf = generatePatientRecordPDF(patient, branding)
    downloadPDF(pdf, `Patient_Record_${patient.name.replace(/\s+/g, '_')}.pdf`)
    toast.success('Patient record downloaded successfully')
  }

  const handleFileUpload = (file) => {
    toast.success(`Medical document "${file.name}" uploaded for ${selectedPatient?.name}. (Note: File storage integration pending)`)
    setShowUploadModal(false)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[320px] flex flex-col items-center justify-center text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Loading patients</h2>
          <p className="text-slate-600">Fetching registered patient records.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loadWarning ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
            {loadWarning}
          </div>
        ) : null}

        {/* Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by name, phone, or NHIS number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base"
            />
          </div>
          <Link
            to="/patients/register"
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-center text-white transition hover:bg-blue-600 active:bg-blue-700"
          >
            <span className="mr-2">➕</span>
            Register New Patient
          </Link>
        </div>

        {/* Patients Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Age
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gender
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NHIS Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Insurance Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? 'No patients found matching your search' : 'No patients registered yet'}
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/patients/${patient.id}`} className="font-medium text-blue-600 hover:underline">
                        {patient.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {patient.age}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 capitalize">
                      {patient.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {patient.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {patient.nhis_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        patient.insurance_type === 'nhis' ? 'bg-green-100 text-green-800' :
                        patient.insurance_type === 'private' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {patient.insurance_type ? patient.insurance_type.toUpperCase() : 'None'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(patient.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <PDFButton
                          onDownload={() => handleDownloadPatientRecord(patient)}
                          onPrint={() => handlePrintPatientRecord(patient)}
                          label="Record"
                          variant="outline"
                        />
                        <button
                          onClick={() => {
                            setSelectedPatient(patient)
                            setShowUploadModal(true)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Upload Documents
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* Summary and Pagination */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-gray-600">
              Showing <span className="font-semibold">{patients.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-semibold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="font-semibold">{totalCount}</span> patients
            </p>
            
            {totalPages > 1 && (
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
            )}
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">
                Upload Medical Documents
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                For patient: {selectedPatient.name}
              </p>
              <FileUpload onFileSelect={handleFileUpload} multiple={true} />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setSelectedPatient(null)
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

export default Patients
