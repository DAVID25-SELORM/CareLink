import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'

/**
 * Billing Page
 * Process payments and generate bills
 */

const Billing = () => {
  const { user } = useAuth()
  const [prescriptions, setPrescriptions] = useState([])
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [prescriptionItems, setPrescriptionItems] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDispensedPrescriptions()
  }, [])

  const getInsuranceType = (prescription) => {
    const insuranceType = prescription?.patients?.insurance_type
    return insuranceType === 'nhis' || insuranceType === 'private' ? insuranceType : null
  }

  const fetchDispensedPrescriptions = async () => {
    try {
      const { data: prescriptionData, error: prescriptionError } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patients (name, phone, insurance_type, insurance_name)
        `)
        .eq('status', 'dispensed')
        .order('updated_at', { ascending: false })

      if (prescriptionError) throw prescriptionError

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('prescription_id, status')
        .eq('status', 'completed')
        .not('prescription_id', 'is', null)

      if (paymentError) throw paymentError

      const paidPrescriptionIds = new Set((paymentData || []).map((payment) => payment.prescription_id))
      setPrescriptions((prescriptionData || []).filter((prescription) => !paidPrescriptionIds.has(prescription.id)))
    } catch (error) {
      console.error('Error fetching prescriptions:', error)
      toast.error('Failed to load prescriptions')
    } finally {
      setLoading(false)
    }
  }

  const fetchPrescriptionItems = async (prescriptionId) => {
    try {
      const { data, error } = await supabase
        .from('prescription_items')
        .select(`
          *,
          drugs (name, price)
        `)
        .eq('prescription_id', prescriptionId)

      if (error) throw error
      setPrescriptionItems(data || [])
    } catch (error) {
      console.error('Error fetching prescription items:', error)
      toast.error('Failed to load prescription details')
    }
  }

  const handleSelectPrescription = async (prescription) => {
    setSelectedPrescription(prescription)
    setPaymentMethod(getInsuranceType(prescription) ? 'insurance' : '')
    await fetchPrescriptionItems(prescription.id)
  }

  const calculateTotal = () =>
    prescriptionItems.reduce(
      (sum, item) => sum + (Number(item.drugs?.price || 0) * Number(item.quantity || 0)),
      0,
    )

  const handleProcessPayment = async () => {
    if (!selectedPrescription || !paymentMethod) {
      toast.error('Please select payment method')
      return
    }

    try {
      const totalAmount = calculateTotal()
      const insuranceType = getInsuranceType(selectedPrescription)

      if (paymentMethod === 'insurance' && !insuranceType) {
        toast.error('This patient does not have an insurance profile configured')
        return
      }

      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payments')
        .insert([
          {
            patient_id: selectedPrescription.patient_id,
            prescription_id: selectedPrescription.id,
            amount: totalAmount,
            payment_method: paymentMethod,
            status: 'completed',
            paid_by: selectedPrescription.patients?.name || null,
            notes: paymentMethod === 'insurance' && insuranceType
              ? `Processed through ${insuranceType.toUpperCase()} insurance`
              : null,
          },
        ])
        .select()
        .single()

      if (paymentError) throw paymentError

      await logAuditEvent({
        user,
        action: 'create_payment',
        tableName: 'payments',
        recordId: paymentRecord.id,
        newValues: {
          patient_id: selectedPrescription.patient_id,
          prescription_id: selectedPrescription.id,
          amount: totalAmount,
          payment_method: paymentMethod,
          status: 'completed',
        },
      })

      if (paymentMethod === 'insurance' && insuranceType) {
        const claimPayload = {
          patient_id: selectedPrescription.patient_id,
          payment_id: paymentRecord.id,
          prescription_id: selectedPrescription.id,
          insurance_type: insuranceType,
          insurance_name: selectedPrescription.patients?.insurance_name || null,
          amount: totalAmount,
          status: 'pending',
        }

        const { data: claimRecord, error: claimError } = await supabase
          .from('claims')
          .insert([claimPayload])
          .select()
          .single()

        if (claimError) throw claimError

        await logAuditEvent({
          user,
          action: 'create_claim',
          tableName: 'claims',
          recordId: claimRecord.id,
          newValues: claimPayload,
        })
      }

      toast.success('Payment processed successfully!')
      setSelectedPrescription(null)
      setPrescriptionItems([])
      setPaymentMethod('')
      fetchDispensedPrescriptions()
    } catch (error) {
      console.error('Error processing payment:', error)
      toast.error('Failed to process payment')
    }
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

  const selectedInsuranceType = getInsuranceType(selectedPrescription)

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Pending Payments</h3>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {prescriptions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No pending payments
              </div>
            ) : (
              prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  onClick={() => handleSelectPrescription(prescription)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedPrescription?.id === prescription.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-medium">{prescription.patients?.name}</h4>
                      <p className="text-sm text-gray-600">{prescription.patients?.phone}</p>
                      {getInsuranceType(prescription) && (
                        <span className="inline-block mt-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          {getInsuranceType(prescription).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(prescription.updated_at || prescription.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Payment Details</h3>
          </div>
          <div className="p-6">
            {!selectedPrescription ? (
              <div className="text-center text-gray-500 py-12">
                Select a prescription to process payment
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-lg">{selectedPrescription.patients?.name}</h4>
                  <p className="text-sm text-gray-600">{selectedPrescription.patients?.phone}</p>
                </div>

                <div>
                  <h5 className="font-medium mb-3">Items:</h5>
                  {prescriptionItems.length === 0 ? (
                    <p className="text-gray-500">Loading...</p>
                  ) : (
                    <div className="space-y-2">
                      {prescriptionItems.map((item) => (
                        <div key={item.id} className="flex flex-col gap-2 rounded bg-gray-50 p-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-medium">{item.drugs?.name || item.drug_name}</p>
                            <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                          </div>
                          <p className="font-medium">
                            GHS {(Number(item.drugs?.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {prescriptionItems.length > 0 && (
                  <>
                    <div className="pt-4 border-t">
                      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-semibold">Total Amount:</span>
                        <span className="text-2xl font-bold text-primary">
                          GHS {calculateTotal().toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select payment method</option>
                        <option value="cash">Cash</option>
                        <option value="momo">Mobile Money (MoMo)</option>
                        <option value="card">Card</option>
                        {selectedInsuranceType && (
                          <option value="insurance">
                            {selectedInsuranceType.toUpperCase()} Insurance
                          </option>
                        )}
                      </select>
                    </div>

                    <button
                      onClick={handleProcessPayment}
                      disabled={!paymentMethod}
                      className="w-full bg-medical hover:bg-green-600 text-white py-3 rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Process Payment
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Billing
