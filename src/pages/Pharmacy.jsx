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

  const pendingPrescriptions = prescriptions.filter((prescription) => prescription.status === 'pending')
  const totalAmount = prescriptionItems.reduce(
    (sum, item) => sum + (Number(item.drugs?.price || 0) * Number(item.quantity || 0)),
    0,
  )

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Pending Prescriptions</h3>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {pendingPrescriptions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No pending prescriptions
              </div>
            ) : (
              pendingPrescriptions.map((prescription) => (
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

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Prescription Details</h3>
          </div>
          <div className="p-6">
            {!selectedPrescription ? (
              <div className="text-center text-gray-500 py-12">
                Select a prescription to view details
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-lg">{selectedPrescription.patients?.name}</h4>
                  <p className="text-sm text-gray-600">{selectedPrescription.patients?.phone}</p>
                  <p className="text-sm text-gray-600">
                    Doctor: {getDoctorLabel(selectedPrescription)}
                  </p>
                </div>

                {selectedPrescription.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm font-medium">Doctor's Note:</p>
                    <p className="text-sm">{selectedPrescription.notes}</p>
                  </div>
                )}

                <div>
                  <h5 className="font-medium mb-3">Medications:</h5>
                  {prescriptionItems.length === 0 ? (
                    <p className="text-gray-500">Loading medications...</p>
                  ) : (
                    <div className="space-y-2">
                      {prescriptionItems.map((item) => (
                        <div key={item.id} className="flex flex-col gap-2 rounded bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">{item.drugs?.name || item.drug_name}</p>
                            <p className="text-sm text-gray-600">
                              Stock: {item.drugs?.stock ?? 'Unknown'} units
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">Qty: {item.quantity}</p>
                            <p className="text-sm text-gray-600">
                              GHS {(Number(item.drugs?.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {prescriptionItems.length > 0 && (
                  <div className="pt-4 border-t">
                    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold">Total:</span>
                      <span className="text-xl font-bold text-primary">
                        GHS {totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={handleDispense}
                      className="w-full bg-medical hover:bg-green-600 text-white py-3 rounded-lg transition font-semibold"
                    >
                      Mark as Dispensed
                    </button>
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
