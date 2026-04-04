import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'
import { generateLabResultPDF, downloadPDF, printPDF } from '../services/pdfService'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import PDFButton from '../components/PDFButton'
import FileUpload from '../components/FileUpload'

/**
 * Laboratory Management Page
 * Manage lab tests and results
 */

const Laboratory = () => {
  const { user } = useAuth()
  const { branding } = useHospitalBranding()
  const [labTests, setLabTests] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    patient_id: '',
    test_name: '',
    test_type: '',
    notes: '',
  })
  const [selectedTest, setSelectedTest] = useState(null)
  const [testResult, setTestResult] = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)

  useEffect(() => {
    fetchLabTests()
    fetchPatients()
  }, [])

  const fetchLabTests = async () => {
    try {
      const { data, error } = await supabase
        .from('lab_tests')
        .select(`
          *,
          patients (name, phone)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLabTests(data || [])
    } catch (error) {
      console.error('Error fetching lab tests:', error)
      toast.error('Failed to load lab tests')
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

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const labTestPayload = {
        patient_id: formData.patient_id,
        test_name: formData.test_name,
        test_type: formData.test_type,
        notes: formData.notes,
        status: 'pending',
      }

      const { data, error } = await supabase
        .from('lab_tests')
        .insert([labTestPayload])
        .select()
        .single()

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'create_lab_test',
        tableName: 'lab_tests',
        recordId: data.id,
        newValues: labTestPayload,
      })

      toast.success('Lab test requested successfully!')
      setFormData({ patient_id: '', test_name: '', test_type: '', notes: '' })
      setShowAddForm(false)
      fetchLabTests()
    } catch (error) {
      console.error('Error adding lab test:', error)
      toast.error('Failed to add lab test')
    }
  }

  const handleAddResult = async () => {
    if (!selectedTest || !testResult) {
      toast.error('Please enter test result')
      return
    }

    try {
      const labResultPayload = {
        result: testResult,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('lab_tests')
        .update(labResultPayload)
        .eq('id', selectedTest.id)

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'complete_lab_test',
        tableName: 'lab_tests',
        recordId: selectedTest.id,
        oldValues: {
          status: selectedTest.status,
          result: selectedTest.result || null,
        },
        newValues: labResultPayload,
      })

      toast.success('Test result added successfully!')
      setSelectedTest(null)
      setTestResult('')
      setUploadedFile(null)
      fetchLabTests()
    } catch (error) {
      console.error('Error adding result:', error)
      toast.error('Failed to add result')
    }
  }

  const handleFileUpload = (file) => {
    setUploadedFile(file)
    toast.success(`File "${file.name}" uploaded. (Note: File storage integration pending)`)
  }

  const handlePrintLabResult = (test) => {
    const pdf = generateLabResultPDF(test, branding)
    printPDF(pdf)
    toast.success('Lab result sent to printer')
  }

  const handleDownloadLabResult = (test) => {
    const pdf = generateLabResultPDF(test, branding)
    downloadPDF(pdf, `LabResult_${test.id}_${test.patients?.name || 'Patient'}.pdf`)
    toast.success('Lab result downloaded successfully')
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Laboratory Tests</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full rounded-lg bg-primary px-6 py-2 text-white transition hover:bg-blue-600 sm:w-auto"
          >
            <span className="mr-2">{showAddForm ? 'Close' : 'Add'}</span>
            {showAddForm ? 'Cancel' : 'Request New Test'}
          </button>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Request Lab Test</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient
                  </label>
                  <select
                    value={formData.patient_id}
                    onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Type
                  </label>
                  <select
                    value={formData.test_type}
                    onChange={(e) => setFormData({ ...formData, test_type: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select test type</option>
                    <option value="blood">Blood Test</option>
                    <option value="urine">Urine Test</option>
                    <option value="xray">X-Ray</option>
                    <option value="ultrasound">Ultrasound</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Name
                  </label>
                  <input
                    type="text"
                    value={formData.test_name}
                    onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Full Blood Count (FBC)"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Additional notes or instructions"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-medical hover:bg-green-600 text-white py-2 rounded-lg transition font-semibold"
              >
                Request Test
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="table-scroll">
            <table className="min-w-[920px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Test Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
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
                  Export
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {labTests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No lab tests requested
                  </td>
                </tr>
              ) : (
                labTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{test.patients?.name}</div>
                      <div className="text-sm text-gray-600">{test.patients?.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{test.test_name}</div>
                      {test.notes && <div className="text-sm text-gray-600">{test.notes}</div>}
                    </td>
                    <td className="px-6 py-4 capitalize">{test.test_type}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          test.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : test.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {test.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(test.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {test.status === 'pending' && (
                        <button
                          onClick={() => {
                            setSelectedTest(test)
                            setTestResult('')
                          }}
                          className="text-primary hover:text-blue-800 text-sm font-medium"
                        >
                          Add Result
                        </button>
                      )}
                      {test.status === 'completed' && test.result && (
                        <button
                          onClick={() => {
                            setSelectedTest(test)
                            setTestResult(test.result)
                          }}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          View Result
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {test.status === 'completed' ? (
                        <PDFButton
                          onDownload={() => handleDownloadLabResult(test)}
                          onPrint={() => handlePrintLabResult(test)}
                          label="Print"
                          variant="outline"
                        />
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

        {selectedTest && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 p-4 sm:items-center">
            <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
              <h3 className="text-lg font-semibold mb-4">
                {selectedTest.status === 'pending' ? 'Add Test Result' : 'Test Result'}
              </h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600">Patient: {selectedTest.patients?.name}</p>
                <p className="text-sm text-gray-600">Test: {selectedTest.test_name}</p>
              </div>
              <textarea
                value={testResult}
                onChange={(e) => setTestResult(e.target.value)}
                disabled={selectedTest.status === 'completed'}
                rows="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                placeholder="Enter test result details..."
              />
              
              {selectedTest.status === 'pending' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Test Image/Document (Optional)
                  </label>
                  <FileUpload onFileSelect={handleFileUpload} />
                  {uploadedFile && (
                    <p className="mt-2 text-sm text-green-600">File ready: {uploadedFile.name}</p>
                  )}
                </div>
              )}
              
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    setSelectedTest(null)
                    setTestResult('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                {selectedTest.status === 'pending' && (
                  <button
                    onClick={handleAddResult}
                    className="px-4 py-2 bg-medical hover:bg-green-600 text-white rounded-lg"
                  >
                    Save Result
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Laboratory
