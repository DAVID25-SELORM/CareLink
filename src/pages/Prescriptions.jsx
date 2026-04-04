import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { getSupabaseData, isSupabaseFailure, withTimeout } from '../services/queryTimeout'
import { supabase } from '../supabaseClient'
import { generatePrescriptionPDF, downloadPDF, printPDF } from '../services/pdfService'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import PDFButton from '../components/PDFButton'

const createEmptyItem = () => ({
  drug_id: '',
  quantity: 1,
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
})

const getDoctorDisplayName = (doctorRecord, fallbackEmail = null) =>
  doctorRecord?.full_name ||
  doctorRecord?.email ||
  fallbackEmail ||
  'CareLink Doctor'

const getStatusClasses = (status) => {
  if (status === 'dispensed') {
    return 'bg-green-50 text-green-700 border border-green-200'
  }

  if (status === 'cancelled') {
    return 'bg-red-50 text-red-700 border border-red-200'
  }

  return 'bg-blue-50 text-blue-700 border border-blue-200'
}

const Prescriptions = () => {
  const { user, userRole } = useAuth()
  const { branding } = useHospitalBranding()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadWarning, setLoadWarning] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [patients, setPatients] = useState([])
  const [drugs, setDrugs] = useState([])
  const [doctors, setDoctors] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [currentDoctorRecord, setCurrentDoctorRecord] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 20
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    diagnosis: '',
    notes: '',
    items: [createEmptyItem()],
  })

  useEffect(() => {
    fetchPageData()
  }, [user?.email, userRole, currentPage])

  const fetchPageData = async () => {
    setLoading(true)

    try {
      const start = (currentPage - 1) * itemsPerPage
      const end = start + itemsPerPage - 1

      const results = await Promise.allSettled([
        withTimeout(
          supabase
            .from('patients')
            .select('id, name, phone, insurance_type, insurance_name')
            .order('name'),
          'Patients for prescriptions',
        ),
        withTimeout(
          supabase
            .from('drugs')
            .select('id, name, category, price, stock')
            .order('name'),
          'Drugs for prescriptions',
        ),
        withTimeout(
          supabase
            .from('users')
            .select('id, email, full_name, role')
            .eq('role', 'doctor')
            .order('email'),
          'Doctors for prescriptions',
        ),
        withTimeout(
          supabase
            .from('prescriptions')
            .select(`
              *,
              patients (name, phone),
              users (email, full_name),
              prescription_items (id, drug_name, quantity)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(start, end),
          'Prescriptions list',
        ),
      ])

      const [patientsResult, drugsResult, doctorsResult, prescriptionsResult] = results
      const patientData = getSupabaseData(patientsResult)
      const drugData = getSupabaseData(drugsResult)
      const doctorData = getSupabaseData(doctorsResult)
      const prescriptionData = getSupabaseData(prescriptionsResult)
      const prescriptionCount = prescriptionsResult.value?.count || 0

      setPatients(patientData)
      setDrugs(drugData)
      setDoctors(doctorData)
      setPrescriptions(prescriptionData)
      setTotalCount(prescriptionCount)

      const matchedDoctor =
        doctorData.find((doctor) => doctor.email?.toLowerCase() === user?.email?.toLowerCase()) || null

      setCurrentDoctorRecord(matchedDoctor)
      setFormData((prev) => ({
        ...prev,
        doctor_id: userRole === 'doctor' ? matchedDoctor?.id || prev.doctor_id || '' : prev.doctor_id,
      }))

      const warnings = []
      if (results.some(isSupabaseFailure)) {
        warnings.push('Some prescription data could not be loaded.')
      }

      if (userRole === 'doctor' && !matchedDoctor) {
        warnings.push('Your doctor profile is not linked in the users table yet, so new prescriptions will use your email as the doctor label.')
      }

      setLoadWarning(warnings.join(' '))
    } catch (error) {
      console.error('Error loading prescriptions page:', error)
      setLoadWarning('Prescription data could not be loaded. Check your Supabase connection and table permissions.')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setFormData({
      patient_id: '',
      doctor_id: userRole === 'doctor' ? currentDoctorRecord?.id || '' : '',
      diagnosis: '',
      notes: '',
      items: [createEmptyItem()],
    })
  }

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }))
  }

  const addMedicationRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyItem()],
    }))
  }

  const removeMedicationRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.patient_id) {
      toast.error('Please select a patient')
      return
    }

    const incompleteItem = formData.items.find(
      (item) => !item.drug_id || Number(item.quantity || 0) <= 0,
    )

    if (incompleteItem) {
      toast.error('Each medication row needs a drug and a valid quantity')
      return
    }

    const uniqueDrugIds = new Set(formData.items.map((item) => item.drug_id))
    if (uniqueDrugIds.size !== formData.items.length) {
      toast.error('Please avoid duplicate drugs in the same prescription')
      return
    }

    setSaving(true)

    try {
      const selectedDoctor =
        doctors.find((doctor) => doctor.id === formData.doctor_id) ||
        currentDoctorRecord ||
        null

      const prescriptionPayload = {
        patient_id: formData.patient_id,
        doctor_id: selectedDoctor?.id || null,
        doctor_name: getDoctorDisplayName(selectedDoctor, user?.email || null),
        diagnosis: formData.diagnosis.trim() || null,
        notes: formData.notes.trim() || null,
        status: 'pending',
      }

      const { data: createdPrescription, error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert([prescriptionPayload])
        .select()
        .single()

      if (prescriptionError) throw prescriptionError

      const itemPayload = formData.items.map((item) => {
        const selectedDrug = drugs.find((drug) => drug.id === item.drug_id)

        if (!selectedDrug) {
          throw new Error('One or more selected drugs are no longer available')
        }

        return {
          prescription_id: createdPrescription.id,
          drug_id: item.drug_id,
          drug_name: selectedDrug.name,
          quantity: Number(item.quantity),
          dosage: item.dosage.trim() || null,
          frequency: item.frequency.trim() || null,
          duration: item.duration.trim() || null,
          instructions: item.instructions.trim() || null,
        }
      })

      const { error: itemsError } = await supabase
        .from('prescription_items')
        .insert(itemPayload)

      if (itemsError) {
        await supabase.from('prescriptions').delete().eq('id', createdPrescription.id)
        throw itemsError
      }

      await logAuditEvent({
        user,
        action: 'create_prescription',
        tableName: 'prescriptions',
        recordId: createdPrescription.id,
        newValues: {
          ...prescriptionPayload,
          items: itemPayload.map(({ drug_id, drug_name, quantity, dosage, frequency, duration }) => ({
            drug_id,
            drug_name,
            quantity,
            dosage,
            frequency,
            duration,
          })),
        },
      })

      toast.success('Prescription created successfully')
      resetForm()
      setShowAddForm(false)
      await fetchPageData()
    } catch (error) {
      console.error('Error creating prescription:', error)
      toast.error(error.message || 'Failed to create prescription')
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = prescriptions.filter((prescription) => prescription.status === 'pending').length
  const dispensedCount = prescriptions.filter((prescription) => prescription.status === 'dispensed').length
  const todaysCount = prescriptions.filter((prescription) => {
    const createdDate = prescription.created_at?.split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    return createdDate === today
  }).length

  const handlePrintPrescription = async (prescription) => {
    try {
      const { data: items, error } = await supabase
        .from('prescription_items')
        .select('*')
        .eq('prescription_id', prescription.id)
      
      if (error) throw error
      
      const pdf = generatePrescriptionPDF(prescription, items || [], branding)
      printPDF(pdf)
      toast.success('Prescription sent to printer')
    } catch (error) {
      console.error('Error printing prescription:', error)
      toast.error('Failed to print prescription')
    }
  }

  const handleDownloadPrescription = async (prescription) => {
    try {
      const { data: items, error } = await supabase
        .from('prescription_items')
        .select('*')
        .eq('prescription_id', prescription.id)
      
      if (error) throw error
      
      const pdf = generatePrescriptionPDF(prescription, items || [], branding)
      downloadPDF(pdf, `Prescription_${prescription.id}_${prescription.patients?.name || 'Patient'}.pdf`)
      toast.success('Prescription downloaded successfully')
    } catch (error) {
      console.error('Error downloading prescription:', error)
      toast.error('Failed to download prescription')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[320px] flex flex-col items-center justify-center text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Loading prescriptions</h2>
          <p className="text-slate-600">Preparing the prescribing workflow and recent records.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loadWarning ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
            {loadWarning}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Prescriptions</h2>
            <p className="text-sm text-slate-500 mt-1">
              Create prescriptions for pharmacy and billing to process.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddForm((prev) => !prev)
              if (showAddForm) {
                resetForm()
              }
            }}
            className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-all-smooth shadow-sm hover:bg-blue-700 hover:shadow sm:w-auto"
          >
            {showAddForm ? 'Close Form' : 'New Prescription'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Pending</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Dispensed</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{dispensedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Created Today</p>
            <p className="text-3xl font-bold text-slate-700 mt-2">{todaysCount}</p>
          </div>
        </div>

        {showAddForm ? (
          <div className="bg-white rounded-xl shadow-soft p-6 border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-5">Create New Prescription</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Patient
                  </label>
                  <select
                    value={formData.patient_id}
                    onChange={(event) => setFormData((prev) => ({ ...prev, patient_id: event.target.value }))}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name}
                        {patient.insurance_type ? ` - ${patient.insurance_type.toUpperCase()}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Prescribing Doctor
                  </label>
                  {userRole === 'doctor' ? (
                    <div className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-700">
                      {getDoctorDisplayName(currentDoctorRecord, user?.email || null)}
                    </div>
                  ) : (
                    <select
                      value={formData.doctor_id}
                      onChange={(event) => setFormData((prev) => ({ ...prev, doctor_id: event.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Assign doctor (optional)</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {getDoctorDisplayName(doctor)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Diagnosis
                  </label>
                  <input
                    type="text"
                    value={formData.diagnosis}
                    onChange={(event) => setFormData((prev) => ({ ...prev, diagnosis: event.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Primary diagnosis"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Clinical Notes
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Additional notes for pharmacy"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-base font-semibold text-slate-800">Medications</h4>
                  <button
                    type="button"
                    onClick={addMedicationRow}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    + Add medication
                  </button>
                </div>

                {formData.items.map((item, index) => {
                  const selectedDrug = drugs.find((drug) => drug.id === item.drug_id)

                  return (
                    <div key={`${item.drug_id || 'new'}-${index}`} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Drug
                          </label>
                          <select
                            value={item.drug_id}
                            onChange={(event) => handleItemChange(index, 'drug_id', event.target.value)}
                            required
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          >
                            <option value="">Select drug</option>
                            {drugs.map((drug) => (
                              <option key={drug.id} value={drug.id} disabled={Number(drug.stock || 0) <= 0}>
                                {drug.name} | Stock: {drug.stock} | GHc {Number(drug.price || 0).toFixed(2)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                            required
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Dosage
                          </label>
                          <input
                            type="text"
                            value={item.dosage}
                            onChange={(event) => handleItemChange(index, 'dosage', event.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="e.g. 500mg"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Frequency
                          </label>
                          <input
                            type="text"
                            value={item.frequency}
                            onChange={(event) => handleItemChange(index, 'frequency', event.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="e.g. twice daily"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Duration
                          </label>
                          <input
                            type="text"
                            value={item.duration}
                            onChange={(event) => handleItemChange(index, 'duration', event.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="e.g. 5 days"
                          />
                        </div>

                        <div className="lg:col-span-3">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Instructions
                          </label>
                          <div className="flex flex-col gap-3 md:flex-row">
                            <input
                              type="text"
                              value={item.instructions}
                              onChange={(event) => handleItemChange(index, 'instructions', event.target.value)}
                              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder="Before meals, after meals, bedtime, etc."
                            />
                            {formData.items.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeMedicationRow(index)}
                                className="px-4 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {selectedDrug ? (
                        <div className="mt-3 text-xs text-slate-500">
                          {selectedDrug.category || 'Medication'} | Stock available: {selectedDrug.stock} | Unit price: GHc {Number(selectedDrug.price || 0).toFixed(2)}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition-all-smooth font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving Prescription...' : 'Save Prescription'}
              </button>
            </form>
          </div>
        ) : null}

        <div className="bg-white rounded-xl shadow-soft overflow-hidden border border-slate-100">
          <div className="table-scroll">
            <table className="min-w-[960px] divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Diagnosis
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Medications
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {prescriptions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-500 text-sm">
                    No prescriptions created yet
                  </td>
                </tr>
              ) : (
                prescriptions.map((prescription) => (
                  <tr key={prescription.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{prescription.patients?.name || '-'}</div>
                      <div className="text-xs text-slate-500">{prescription.patients?.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {getDoctorDisplayName(prescription.users, prescription.doctor_name)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {prescription.diagnosis || prescription.notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div>{prescription.prescription_items?.length || 0} item(s)</div>
                      <div className="text-xs text-slate-500">
                        {(prescription.prescription_items || [])
                          .slice(0, 2)
                          .map((item) => `${item.drug_name} x${item.quantity}`)
                          .join(', ') || 'No items'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusClasses(prescription.status)}`}>
                        {prescription.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(prescription.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4">

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold">{prescriptions.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-semibold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="font-semibold">{totalCount}</span> prescriptions
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
                      <PDFButton
                        onDownload={() => handleDownloadPrescription(prescription)}
                        onPrint={() => handlePrintPrescription(prescription)}
                        label="Export"
                        variant="outline"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Prescriptions
