import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'
import { generateLabResultPDF, downloadPDF, printPDF } from '../services/pdfService'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import PDFButton from '../components/PDFButton'
import FileUpload from '../components/FileUpload'
import { getEncounterCcCode } from '../services/nhisCcCodeService'

/**
 * Laboratory Management Page
 * Manage lab tests and results
 */

const normalize = (value) => String(value || '').trim().toLowerCase()

const getAnalyteKey = (catalog, analyte) => `${catalog?.code || catalog?.name || 'LAB'}::${analyte.name}`

const formatAnalyteRange = (analyte) => {
  if (analyte.qualitativeRef) return analyte.qualitativeRef
  const low = analyte.refLow ?? ''
  const high = analyte.refHigh ?? ''
  if (low === '' && high === '') return ''
  if (low === '') return `<= ${high}${analyte.unit ? ` ${analyte.unit}` : ''}`
  if (high === '') return `>= ${low}${analyte.unit ? ` ${analyte.unit}` : ''}`
  return `${low} - ${high}${analyte.unit ? ` ${analyte.unit}` : ''}`
}

const flagAnalyteValue = (analyte, value) => {
  if (value === '' || value == null) return null
  if (analyte.qualitativeRef) {
    return normalize(value) === normalize(analyte.qualitativeRef) ? 'NORMAL' : 'ABNORMAL'
  }

  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return null
  if (analyte.refHigh != null && numericValue > Number(analyte.refHigh)) return 'HIGH'
  if (analyte.refLow != null && numericValue < Number(analyte.refLow)) return 'LOW'
  return 'NORMAL'
}

const FlagBadge = ({ flag }) => {
  if (!flag) return <span className="text-xs text-gray-300">-</span>
  const styles = {
    HIGH: 'bg-red-100 text-red-700 border-red-200',
    LOW: 'bg-orange-100 text-orange-700 border-orange-200',
    NORMAL: 'bg-green-100 text-green-700 border-green-200',
    ABNORMAL: 'bg-red-100 text-red-700 border-red-200',
  }
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${styles[flag] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      {flag}
    </span>
  )
}

const Laboratory = () => {
  const { user, userRole } = useAuth()
  const isAdmin = userRole === 'admin'
  const { branding } = useHospitalBranding()
  const [labTests, setLabTests] = useState([])
  const [catalogTests, setCatalogTests] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('orders')
  const [showAddForm, setShowAddForm] = useState(false)
  const [encounters, setEncounters] = useState([])
  const [formData, setFormData] = useState({
    patient_id: '',
    encounter_id: '',
    test_name: '',
    test_type: '',
    notes: '',
  })
  const [selectedTest, setSelectedTest] = useState(null)
  const [testResult, setTestResult] = useState('')
  const [resultValues, setResultValues] = useState({})
  const [resultNotes, setResultNotes] = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('')
  const [editingCatalogId, setEditingCatalogId] = useState(null)
  const [editCatalogPrice, setEditCatalogPrice] = useState('')

  const selectedCatalogTest = useMemo(() => {
    if (!selectedTest) return null
    const testName = normalize(selectedTest.test_name)
    const testType = normalize(selectedTest.test_type)

    return catalogTests.find((catalog) => {
      const code = normalize(catalog.code)
      const name = normalize(catalog.name)
      return (
        (selectedTest.catalog_id && catalog.id === selectedTest.catalog_id) ||
        (code && code === testType) ||
        (code && testName.includes(code)) ||
        (name && name === testName)
      )
    }) || null
  }, [catalogTests, selectedTest])

  const selectedAnalytes = Array.isArray(selectedCatalogTest?.analytes)
    ? selectedCatalogTest.analytes
    : []

  const resultFlags = useMemo(() => {
    if (!selectedCatalogTest || selectedAnalytes.length === 0) return {}
    return selectedAnalytes.reduce((acc, analyte) => {
      const key = getAnalyteKey(selectedCatalogTest, analyte)
      acc[key] = flagAnalyteValue(analyte, resultValues[key])
      return acc
    }, {})
  }, [resultValues, selectedAnalytes, selectedCatalogTest])

  const abnormalCount = Object.values(resultFlags).filter((flag) => flag && flag !== 'NORMAL').length

  useEffect(() => {
    fetchLabTests()
    fetchPatients()
    fetchEncounters()
    fetchCatalog()
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

  const fetchEncounters = async () => {
    try {
      const { data, error } = await supabase
        .from('encounters')
        .select('id, patient_id, encounter_type, chief_complaint, started_at, nhis_cc_code, patients:patient_id(name)')
        .in('status', ['registered', 'in_progress'])
        .order('started_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setEncounters(data || [])
    } catch (error) {
      console.error('Error fetching encounters:', error)
    }
  }

  const fetchCatalog = async () => {
    const { data } = await supabase
      .from('lab_test_catalog')
      .select('*')
      .order('category')
      .order('name')
    setCatalogTests(data || [])
  }

  const handleCatalogPriceSave = async (id) => {
    const price = parseFloat(editCatalogPrice)
    if (isNaN(price) || price < 0) { toast.error('Invalid price'); return }
    const { error } = await supabase
      .from('lab_test_catalog')
      .update({ price, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error('Failed to update price'); return }
    toast.success('Price updated!')
    setEditingCatalogId(null)
    fetchCatalog()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const selectedEncounter = encounters.find((enc) => enc.id === formData.encounter_id)
      const labTestPayload = {
        patient_id: formData.patient_id,
        encounter_id: formData.encounter_id || null,
        nhis_cc_code: getEncounterCcCode(selectedEncounter),
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
      setFormData({ patient_id: '', encounter_id: '', test_name: '', test_type: '', notes: '' })
      setShowAddForm(false)
      fetchLabTests()
    } catch (error) {
      console.error('Error adding lab test:', error)
      toast.error('Failed to add lab test')
    }
  }

  const openResultModal = (test) => {
    setSelectedTest(test)
    setTestResult(test.result || '')
    setResultNotes(test.result_details?.notes || '')

    const values = {}
    if (Array.isArray(test.result_details?.analytes)) {
      test.result_details.analytes.forEach((result) => {
        const key = `${result.testCode || test.test_type || test.test_name}::${result.analyte}`
        values[key] = result.value ?? ''
      })
    }
    setResultValues(values)
  }

  const handleAddResult = async () => {
    if (!selectedTest) return

    const hasStructuredCatalog = selectedAnalytes.length > 0
    const hasStructuredValue = Object.values(resultValues).some((value) => value !== '' && value != null)
    const hasFreeTextValue = testResult.trim().length > 0

    if (hasStructuredCatalog && !hasStructuredValue) {
      toast.error('Please enter at least one result value')
      return
    }

    if (!hasStructuredCatalog && !hasFreeTextValue) {
      toast.error('Please enter test result')
      return
    }

    try {
      const analyteResults = hasStructuredCatalog
        ? selectedAnalytes.map((analyte) => {
          const key = getAnalyteKey(selectedCatalogTest, analyte)
          const value = resultValues[key] ?? ''
          const flag = resultFlags[key] ?? null
          return {
            testCode: selectedCatalogTest.code || selectedTest.test_type || '',
            testName: selectedCatalogTest.name || selectedTest.test_name,
            analyte: analyte.name,
            value,
            unit: analyte.unit || '',
            refRange: formatAnalyteRange(analyte),
            flag,
          }
        }).filter((row) => row.value !== '' && row.value != null)
        : []

      const resultSummary = hasStructuredCatalog
        ? analyteResults
          .map((row) => `${row.analyte}: ${row.value}${row.unit ? ` ${row.unit}` : ''}${row.flag && row.flag !== 'NORMAL' ? ` [${row.flag}]` : ''}`)
          .join(' | ')
        : testResult

      const resultDetails = hasStructuredCatalog
        ? {
          testCode: selectedCatalogTest.code || selectedTest.test_type || '',
          testName: selectedCatalogTest.name || selectedTest.test_name,
          analytes: analyteResults,
          notes: resultNotes,
          enteredBy: user?.email || user?.id,
          enteredAt: new Date().toISOString(),
        }
        : {
          notes: resultNotes,
          enteredBy: user?.email || user?.id,
          enteredAt: new Date().toISOString(),
        }

      const labResultPayload = {
        result: resultSummary,
        result_details: resultDetails,
        is_abnormal: abnormalCount > 0,
        completed_by: user?.id || null,
        result_flag: hasStructuredCatalog ? (abnormalCount > 0 ? 'abnormal' : 'normal') : null,
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

      // Notify the ordering doctor that results are ready
      if (selectedTest.encounter_id) {
        const { data: enc } = await supabase
          .from('encounters')
          .select('doctor_id')
          .eq('id', selectedTest.encounter_id)
          .single()

        if (enc?.doctor_id) {
          const { error: notificationError } = await supabase.from('notifications').insert({
            user_id: enc.doctor_id,
            patient_id: selectedTest.patient_id,
            type: 'lab_result',
            channel: 'in_app',
            title: abnormalCount > 0 ? 'Abnormal Lab Result' : 'Lab Result Ready',
            message: `${selectedTest.test_name} results for ${selectedTest.patients?.name} are ready for review`,
            priority: 'normal',
            status: 'unread',
            link: `/laboratory?test=${selectedTest.id}`,
          })
          if (notificationError) console.warn('Lab result saved, but notification failed:', notificationError)
        }
      }

      toast.success(abnormalCount > 0 ? 'Result saved with abnormal flags' : 'Test result added successfully!')
      setSelectedTest(null)
      setTestResult('')
      setResultValues({})
      setResultNotes('')
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
          <h2 className="text-2xl font-bold">Laboratory</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('orders'); setShowAddForm(false) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'orders' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Test Orders
            </button>
            <button
              onClick={() => { setActiveTab('catalog'); setShowAddForm(false) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'catalog' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Test Catalog {isAdmin && <span className="ml-1 text-xs opacity-75">(Admin)</span>}
            </button>
            {activeTab === 'orders' && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="rounded-lg bg-medical px-4 py-2 text-white transition hover:bg-green-600 text-sm font-medium"
              >
                {showAddForm ? 'Cancel' : '+ Request Test'}
              </button>
            )}
          </div>
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
                    Encounter (Visit)
                  </label>
                  <select
                    value={formData.encounter_id}
                    onChange={(e) => {
                      const enc = encounters.find(en => en.id === e.target.value)
                      setFormData({
                        ...formData,
                        encounter_id: e.target.value,
                        patient_id: enc?.patient_id || formData.patient_id
                      })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">No encounter (standalone)</option>
                    {encounters.map((enc) => (
                      <option key={enc.id} value={enc.id}>
                        {enc.patients?.name} — {enc.encounter_type} — {new Date(enc.started_at).toLocaleDateString()}
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
                    {formData.test_type && !['blood', 'urine', 'xray', 'ultrasound', 'other'].includes(formData.test_type) && (
                      <option value={formData.test_type}>{formData.test_type}</option>
                    )}
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
                  {catalogTests.length > 0 ? (
                    <select
                      value={formData.test_name}
                      onChange={(e) => {
                        const catalog = catalogTests.find((test) => test.name === e.target.value)
                        setFormData({
                          ...formData,
                          test_name: e.target.value,
                          test_type: catalog?.code || catalog?.category || formData.test_type,
                        })
                      }}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select test from catalog</option>
                      {catalogTests.map((t) => (
                        <option key={t.id} value={t.name}>{t.code ? `${t.code} - ` : ''}{t.name} - GHS {Number(t.price).toFixed(2)}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.test_name}
                      onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Full Blood Count (FBC)"
                    />
                  )}
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

        {activeTab === 'orders' && <div className="bg-white rounded-lg shadow overflow-hidden">
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
                      {!['completed', 'cancelled'].includes(test.status) && (
                        <button
                          onClick={() => openResultModal(test)}
                          className="text-primary hover:text-blue-800 text-sm font-medium"
                        >
                          Add Result
                        </button>
                      )}
                      {test.status === 'completed' && test.result && (
                        <button
                          onClick={() => openResultModal(test)}
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
        </div>}

        {activeTab === 'catalog' && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold">Lab Test Price Catalog</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={catalogCategory}
                  onChange={(e) => setCatalogCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {[...new Set(catalogTests.map((t) => t.category).filter(Boolean))].sort().map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price (GH₵)</th>
                    {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {catalogTests
                    .filter((t) =>
                      (!catalogSearch || t.name.toLowerCase().includes(catalogSearch.toLowerCase())) &&
                      (!catalogCategory || t.category === catalogCategory)
                    )
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{t.category}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingCatalogId === t.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editCatalogPrice}
                                onChange={(e) => setEditCatalogPrice(e.target.value)}
                                className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <button
                                onClick={() => handleCatalogPriceSave(t.id)}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                              >Save</button>
                              <button
                                onClick={() => setEditingCatalogId(null)}
                                className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                              >Cancel</button>
                            </div>
                          ) : (
                            <span className="font-medium">GH₵{Number(t.price).toFixed(2)}</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            {editingCatalogId !== t.id && (
                              <button
                                onClick={() => { setEditingCatalogId(t.id); setEditCatalogPrice(t.price) }}
                                className="text-primary hover:text-blue-800 text-sm font-medium"
                              >Edit Price</button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  }
                  {catalogTests.filter((t) =>
                    (!catalogSearch || t.name.toLowerCase().includes(catalogSearch.toLowerCase())) &&
                    (!catalogCategory || t.category === catalogCategory)
                  ).length === 0 && (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">No tests found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedTest && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 p-4 sm:items-center">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6">
              <h3 className="text-lg font-semibold mb-4">
                {selectedTest.status === 'completed' ? 'Test Result' : 'Add Test Result'}
              </h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600">Patient: {selectedTest.patients?.name}</p>
                <p className="text-sm text-gray-600">Test: {selectedTest.test_name}</p>
                {selectedCatalogTest?.code && (
                  <p className="text-xs text-gray-500">Catalog: {selectedCatalogTest.code} - {selectedCatalogTest.category}</p>
                )}
              </div>

              {selectedAnalytes.length > 0 ? (
                <div className="mb-4 overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Parameter</th>
                        <th className="px-3 py-2 text-left">Value</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Reference</th>
                        <th className="px-3 py-2 text-center">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedAnalytes.map((analyte) => {
                        const key = getAnalyteKey(selectedCatalogTest, analyte)
                        const flag = resultFlags[key]
                        const isCompleted = selectedTest.status === 'completed'
                        return (
                          <tr key={key} className={flag && flag !== 'NORMAL' ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 font-medium text-gray-800">{analyte.name}</td>
                            <td className="px-3 py-2">
                              {analyte.qualitativeRef ? (
                                <input
                                  type="text"
                                  value={resultValues[key] ?? ''}
                                  onChange={(e) => setResultValues((prev) => ({ ...prev, [key]: e.target.value }))}
                                  disabled={isCompleted}
                                  placeholder={analyte.qualitativeRef}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-50"
                                />
                              ) : (
                                <input
                                  type="number"
                                  step="any"
                                  value={resultValues[key] ?? ''}
                                  onChange={(e) => setResultValues((prev) => ({ ...prev, [key]: e.target.value }))}
                                  disabled={isCompleted}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-50"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{analyte.unit || '-'}</td>
                            <td className="px-3 py-2 text-gray-500">{formatAnalyteRange(analyte) || '-'}</td>
                            <td className="px-3 py-2 text-center"><FlagBadge flag={flag} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <textarea
                  value={testResult}
                  onChange={(e) => setTestResult(e.target.value)}
                  disabled={selectedTest.status === 'completed'}
                  rows="6"
                  className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50"
                  placeholder="Enter test result details..."
                />
              )}

              {abnormalCount > 0 && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {abnormalCount} abnormal value{abnormalCount > 1 ? 's' : ''} flagged.
                </div>
              )}

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">Lab Notes / Comments</label>
                <textarea
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  disabled={selectedTest.status === 'completed'}
                  rows="2"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50"
                  placeholder="Optional comments, specimen quality, or repeat recommendation"
                />
              </div>
              
              {!['completed', 'cancelled'].includes(selectedTest.status) && (
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
                    setResultValues({})
                    setResultNotes('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                {!['completed', 'cancelled'].includes(selectedTest.status) && (
                  <button
                    onClick={handleAddResult}
                    className={`px-4 py-2 text-white rounded-lg ${abnormalCount > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-medical hover:bg-green-600'}`}
                  >
                    {abnormalCount > 0 ? 'Save & Flag Result' : 'Save Result'}
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
