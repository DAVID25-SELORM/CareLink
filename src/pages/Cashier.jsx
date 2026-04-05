import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'

/**
 * Cashier Page
 * Manage payments for prescriptions before pharmacy dispensing
 * Author: David Gabion Selorm
 */

const Cashier = () => {
  const { user } = useAuth()
  const [pendingBills, setPendingBills] = useState([])
  const [completedPayments, setCompletedPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending') // 'pending' or 'completed'
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [paymentData, setPaymentData] = useState({
    payment_method: 'cash',
    momo_provider: '',
    transaction_reference: '',
    paid_by: '',
    notes: ''
  })

  useEffect(() => {
    fetchPendingBills()
    fetchCompletedPayments()
  }, [])

  const fetchPendingBills = async () => {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patients (name, phone, nhis_number, insurance_type),
          prescription_items (
            id,
            drug_name,
            quantity,
            dosage,
            frequency,
            drugs (price)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Calculate total from the joined drug prices — no extra queries needed
      const billsWithTotals = (data || []).map((prescription) => {
        const total = (prescription.prescription_items || []).reduce((sum, item) => {
          const price = item.drugs?.price || 0
          return sum + (parseFloat(price) * parseInt(item.quantity || 0))
        }, 0)
        return { ...prescription, total_amount: total }
      })

      setPendingBills(billsWithTotals)
    } catch (error) {
      console.error('Error fetching pending bills:', error)
      toast.error('Failed to load pending bills')
    } finally {
      setLoading(false)
    }
  }

  const fetchCompletedPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          patients (name, phone),
          prescriptions (
            diagnosis,
            doctor_name
          )
        `)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setCompletedPayments(data || [])
    } catch (error) {
      console.error('Error fetching completed payments:', error)
    }
  }

  const openPaymentModal = (bill) => {
    setSelectedBill(bill)
    setPaymentData({
      payment_method: bill.patients?.insurance_type === 'nhis' ? 'insurance' : 'cash',
      momo_provider: '',
      transaction_reference: '',
      paid_by: bill.patients?.name || '',
      notes: ''
    })
    setShowPaymentModal(true)
  }

  const handlePayment = async (e) => {
    e.preventDefault()

    try {
      // 1. Create payment record
      const paymentPayload = {
        patient_id: selectedBill.patient_id,
        prescription_id: selectedBill.id,
        amount: selectedBill.total_amount,
        payment_method: paymentData.payment_method,
        momo_provider: paymentData.payment_method === 'momo' ? paymentData.momo_provider : null,
        transaction_reference: paymentData.transaction_reference || null,
        status: 'completed',
        paid_by: paymentData.paid_by,
        notes: paymentData.notes
      }

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert([paymentPayload])
        .select()
        .single()

      if (paymentError) throw paymentError

      // 2. Update prescription status to 'paid' (ready for dispensing)
      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({ status: 'paid' })
        .eq('id', selectedBill.id)

      if (updateError) throw updateError

      // 3. Log audit event
      await logAuditEvent({
        user,
        action: 'process_payment',
        tableName: 'payments',
        recordId: payment.id,
        newValues: paymentPayload
      })

      toast.success('Payment processed successfully! Prescription ready for dispensing.')
      setShowPaymentModal(false)
      setSelectedBill(null)
      fetchPendingBills()
      fetchCompletedPayments()
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-slate-800">Cashier Dashboard</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending Bills ({pendingBills.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Pending Bills</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">{pendingBills.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Today's Collection</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              GH₵ {completedPayments
                .filter(p => new Date(p.created_at).toDateString() === new Date().toDateString())
                .reduce((sum, p) => sum + parseFloat(p.amount), 0)
                .toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-5 border border-slate-100">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Total Collected</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              GH₵ {completedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Pending Bills Table */}
        {activeTab === 'pending' && (
          <div className="bg-white rounded-xl shadow-soft overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Bills Awaiting Payment</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Diagnosis
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Insurance
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {pendingBills.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-16 text-center text-slate-500 text-sm">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl mb-2">💰</span>
                          <p>No pending bills</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pendingBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">{bill.patients?.name}</div>
                          <div className="text-xs text-slate-500">{bill.patients?.phone}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {bill.diagnosis}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {bill.prescription_items?.length || 0} items
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            bill.patients?.insurance_type === 'nhis'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : bill.patients?.insurance_type === 'private'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}>
                            {bill.patients?.insurance_type?.toUpperCase() || 'NONE'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-green-600">
                            GH₵ {bill.total_amount?.toFixed(2) || '0.00'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => openPaymentModal(bill)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                          >
                            Process Payment
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Completed Payments Table */}
        {activeTab === 'completed' && (
          <div className="bg-white rounded-xl shadow-soft overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Payment History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Paid By
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {completedPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-800">
                          {new Date(payment.created_at).toLocaleDateString('en-GB')}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(payment.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {payment.patients?.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-green-600">
                          GH₵ {parseFloat(payment.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {payment.payment_method?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {payment.paid_by || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {payment.transaction_reference || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedBill && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
                <h3 className="text-xl font-semibold text-slate-800">Process Payment</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Patient Info */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-700 mb-2">Patient Details</h4>
                  <p className="text-sm"><span className="font-medium">Name:</span> {selectedBill.patients?.name}</p>
                  <p className="text-sm"><span className="font-medium">Phone:</span> {selectedBill.patients?.phone}</p>
                  <p className="text-sm"><span className="font-medium">Insurance:</span> {selectedBill.patients?.insurance_type?.toUpperCase() || 'NONE'}</p>
                  {selectedBill.patients?.nhis_number && (
                    <p className="text-sm"><span className="font-medium">NHIS:</span> {selectedBill.patients.nhis_number}</p>
                  )}
                </div>

                {/* Prescription Items */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-700 mb-2">Prescription Items</h4>
                  <div className="space-y-1">
                    {selectedBill.prescription_items?.map((item, idx) => (
                      <div key={idx} className="text-sm flex justify-between">
                        <span>{item.drug_name} × {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Amount */}
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-slate-700">Total Amount:</span>
                    <span className="text-2xl font-bold text-green-600">
                      GH₵ {selectedBill.total_amount?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>

                {/* Payment Form */}
                <form onSubmit={handlePayment} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Payment Method *
                      </label>
                      <select
                        value={paymentData.payment_method}
                        onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="momo">Mobile Money</option>
                        <option value="card">Card</option>
                        <option value="insurance">Insurance</option>
                      </select>
                    </div>

                    {paymentData.payment_method === 'momo' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          MoMo Provider *
                        </label>
                        <select
                          value={paymentData.momo_provider}
                          onChange={(e) => setPaymentData({ ...paymentData, momo_provider: e.target.value })}
                          required
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Select Provider</option>
                          <option value="mtn">MTN Mobile Money</option>
                          <option value="telecel">Telecel Cash</option>
                          <option value="airteltigo">AirtelTigo Money</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Paid By *
                      </label>
                      <input
                        type="text"
                        value={paymentData.paid_by}
                        onChange={(e) => setPaymentData({ ...paymentData, paid_by: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Name of payer"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Transaction Reference
                      </label>
                      <input
                        type="text"
                        value={paymentData.transaction_reference}
                        onChange={(e) => setPaymentData({ ...paymentData, transaction_reference: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Receipt/Ref number"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={paymentData.notes}
                      onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                      rows="2"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Additional notes..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg transition-all font-medium text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition-all font-medium text-sm shadow-sm"
                    >
                      Confirm Payment - GH₵ {selectedBill.total_amount?.toFixed(2)}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Cashier
