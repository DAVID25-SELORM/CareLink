import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'

/**
 * Pharmacy Dashboard
 * View prescriptions and dispense medications
 */

const Pharmacy = () => {
  const { user } = useAuth()
  const [prescriptions, setPrescriptions] = useState([])
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [prescriptionItems, setPrescriptionItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPrescriptions()
  }, [])

  const getDoctorLabel = (prescription) =>
    prescription?.users?.full_name ||
    prescription?.users?.email ||
    prescription?.doctor_name ||
    'Unassigned'

  const fetchPrescriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patients (name, phone),
          users (email, full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPrescriptions(data || [])
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
          drugs (name, price, stock)
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
    await fetchPrescriptionItems(prescription.id)
  }

  const handleDispense = async () => {
    if (!selectedPrescription || prescriptionItems.length === 0) return

    const missingDrugItem = prescriptionItems.find((item) => !item.drugs)
    if (missingDrugItem) {
      toast.error('One or more prescription items are missing linked drug records')
      return
    }

    const insufficientStockItem = prescriptionItems.find(
      (item) => Number(item.drugs?.stock || 0) < Number(item.quantity || 0),
    )

    if (insufficientStockItem) {
      toast.error(`Insufficient stock for ${insufficientStockItem.drugs.name}`)
      return
    }

    try {
      for (const item of prescriptionItems) {
        const newStock = Number(item.drugs.stock) - Number(item.quantity)
        const { error: stockError } = await supabase
          .from('drugs')
          .update({ stock: newStock })
          .eq('id', item.drug_id)

        if (stockError) throw stockError
      }

      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({ status: 'dispensed' })
        .eq('id', selectedPrescription.id)

      if (updateError) throw updateError

      await logAuditEvent({
        user,
        action: 'dispense_prescription',
        tableName: 'prescriptions',
        recordId: selectedPrescription.id,
        oldValues: { status: selectedPrescription.status },
        newValues: {
          status: 'dispensed',
          items: prescriptionItems.map((item) => ({
            drug_id: item.drug_id,
            drug_name: item.drugs?.name || item.drug_name,
            quantity: item.quantity,
          })),
        },
      })

      toast.success('Prescription dispensed successfully!')
      setSelectedPrescription(null)
      setPrescriptionItems([])
      fetchPrescriptions()
    } catch (error) {
      console.error('Error dispensing prescription:', error)
      toast.error('Failed to dispense prescription')
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

  // Show prescriptions that are 'paid' (ready for dispensing) or 'pending' (for review)
  const paidPrescriptions = prescriptions.filter((prescription) => prescription.status === 'paid')
  const pendingPrescriptions = prescriptions.filter((prescription) => prescription.status === 'pending')
  const totalAmount = prescriptionItems.reduce(
    (sum, item) => sum + (Number(item.drugs?.price || 0) * Number(item.quantity || 0)),
    0,
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Ready to Dispense</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{paidPrescriptions.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Awaiting Payment</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">{pendingPrescriptions.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Total Prescriptions</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{prescriptions.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Paid Prescriptions (Ready to Dispense) */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b bg-green-50">
              <h3 className="text-lg font-semibold text-green-800">✓ Paid - Ready to Dispense ({paidPrescriptions.length})</h3>
              <p className="text-sm text-green-600 mt-1">Payment confirmed. Ready for collection.</p>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {paidPrescriptions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">💊</div>
                  No prescriptions ready for dispensing
                </div>
              ) : (
                paidPrescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  onClick={() => handleSelectPrescription(prescription)}
                  className={`p-4 cursor-pointer hover:bg-green-50 transition ${
                    selectedPrescription?.id === prescription.id ? 'bg-green-100 border-l-4 border-green-600' : ''
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{prescription.patients?.name}</h4>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-300">
                          PAID
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{prescription.patients?.phone}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Doctor: {getDoctorLabel(prescription)}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(prescription.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {prescription.notes && (
                    <p className="text-sm text-gray-700 mt-2 italic">
                      Note: {prescription.notes}
                    </p>
                  )}
                </div>
              ))
            )}
            </div>
          </div>

          {/* Pending Prescriptions (Awaiting Payment) */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b bg-orange-50">
              <h3 className="text-lg font-semibold text-orange-800">⏳ Pending Payment ({pendingPrescriptions.length})</h3>
              <p className="text-sm text-orange-600 mt-1">Waiting for cashier confirmation.</p>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {pendingPrescriptions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">💰</div>
                  No pending prescriptions
                </div>
              ) : (
                pendingPrescriptions.map((prescription) => (
                  <div
                    key={prescription.id}
                    className="p-4 bg-orange-50/30"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-700">{prescription.patients?.name}</h4>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 border border-orange-300">
                            AWAITING PAYMENT
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{prescription.patients?.phone}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Doctor: {getDoctorLabel(prescription)}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(prescription.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {prescription.diagnosis && (
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-medium">Diagnosis:</span> {prescription.diagnosis}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Prescription Details Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Prescription Details</h3>
          </div>
          <div className="p-6">
            {!selectedPrescription ? (
              <div className="text-center text-gray-500 py-12">
                <div className="text-4xl mb-2">📋</div>
                Select a prescription to view details
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-lg">{selectedPrescription.patients?.name}</h4>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      selectedPrescription.status === 'paid'
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-orange-100 text-orange-700 border border-orange-300'
                    }`}>
                      {selectedPrescription.status === 'paid' ? 'PAYMENT CONFIRMED' : 'AWAITING PAYMENT'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{selectedPrescription.patients?.phone}</p>
                  <p className="text-sm text-gray-600">
                    Doctor: {getDoctorLabel(selectedPrescription)}
                  </p>
                  {selectedPrescription.diagnosis && (
                    <p className="text-sm text-gray-700 mt-2">
                      <span className="font-medium">Diagnosis:</span> {selectedPrescription.diagnosis}
                    </p>
                  )}
                </div>

                {selectedPrescription.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-800">Doctor's Note:</p>
                    <p className="text-sm text-yellow-700">{selectedPrescription.notes}</p>
                  </div>
                )}

                <div>
                  <h5 className="font-medium mb-3">Medications:</h5>
                  {prescriptionItems.length === 0 ? (
                    <p className="text-gray-500">Loading medications...</p>
                  ) : (
                    <div className="space-y-2">
                      {prescriptionItems.map((item) => {
                        const hasEnoughStock = Number(item.drugs?.stock || 0) >= Number(item.quantity || 0)
                        return (
                          <div key={item.id} className={`flex flex-col gap-2 rounded p-3 sm:flex-row sm:items-center sm:justify-between ${
                            hasEnoughStock ? 'bg-gray-50' : 'bg-red-50 border border-red-200'
                          }`}>
                            <div>
                              <p className="font-medium">{item.drugs?.name || item.drug_name}</p>
                              <p className={`text-sm ${hasEnoughStock ? 'text-gray-600' : 'text-red-600 font-medium'}`}>
                                Stock: {item.drugs?.stock ?? 'Unknown'} units
                                {!hasEnoughStock && ' (Insufficient!)'}
                              </p>
                              {item.dosage && (
                                <p className="text-xs text-gray-500">
                                  {item.dosage} - {item.frequency} for {item.duration}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-medium">Qty: {item.quantity}</p>
                              <p className="text-sm text-gray-600">
                                GH₵ {(Number(item.drugs?.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {prescriptionItems.length > 0 && (
                  <div className="pt-4 border-t">
                    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold">Total:</span>
                      <span className="text-xl font-bold text-primary">
                        GH₵ {totalAmount.toFixed(2)}
                      </span>
                    </div>
                    
                    {selectedPrescription.status === 'paid' ? (
                      <button
                        onClick={handleDispense}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition font-semibold shadow-sm"
                      >
                        ✓ Dispense & Hand Over to Patient
                      </button>
                    ) : (
                      <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 text-center">
                        <p className="text-orange-800 font-medium">⏳ Waiting for Payment Confirmation</p>
                        <p className="text-sm text-orange-600 mt-1">Patient must pay at cashier first</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Pharmacy
