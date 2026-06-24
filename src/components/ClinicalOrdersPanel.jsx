import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { createOrder, getEncounterOrders, updateOrderStatus } from '../services/encounterService'
import { supabase } from '../supabaseClient'

const ORDER_TYPES = [
  { value: 'lab', label: 'Laboratory', icon: '🔬' },
  { value: 'radiology', label: 'Radiology', icon: '📷' },
  { value: 'procedure', label: 'Procedure', icon: '🏥' },
  { value: 'referral', label: 'Referral', icon: '↗️' },
  { value: 'medication', label: 'Medication', icon: '💊' },
  { value: 'nursing', label: 'Nursing', icon: '👩‍⚕️' },
]

const PRIORITIES = [
  { value: 'routine', label: 'Routine', color: 'bg-slate-100 text-slate-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-amber-100 text-amber-700' },
  { value: 'stat', label: 'STAT', color: 'bg-red-100 text-red-700' },
  { value: 'asap', label: 'ASAP', color: 'bg-orange-100 text-orange-700' },
]

const STATUS_COLORS = {
  ordered: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const ClinicalOrdersPanel = ({ encounterId, patientId, orderedBy }) => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    order_type: 'lab',
    priority: 'routine',
    order_description: '',
    clinical_indication: '',
    special_instructions: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [encounterId])

  const fetchOrders = async () => {
    try {
      const { data, error } = await getEncounterOrders(encounterId)
      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.order_description.trim()) {
      toast.error('Please enter an order description')
      return
    }
    setSaving(true)
    try {
      const payload = {
        encounter_id: encounterId,
        patient_id: patientId,
        ordered_by: orderedBy,
        order_type: form.order_type,
        priority: form.priority,
        order_description: form.order_description,
        clinical_indication: form.clinical_indication || null,
        special_instructions: form.special_instructions || null,
        status: 'ordered',
      }
      const { data, error } = await createOrder(payload)
      if (error) throw error

      // Auto-create a lab_tests entry so lab staff see it immediately in their worklist
      if (form.order_type === 'lab') {
        await supabase.from('lab_tests').insert({
          patient_id: patientId,
          encounter_id: encounterId,
          test_name: form.order_description,
          test_type: 'blood',
          notes: [form.clinical_indication, form.special_instructions].filter(Boolean).join(' | ') || null,
          status: 'pending',
          ordered_by: orderedBy,
        })
      }

      setOrders(prev => [data, ...prev])
      setShowForm(false)
      setForm({ order_type: 'lab', priority: 'routine', order_description: '', clinical_indication: '', special_instructions: '' })
      toast.success('Order placed successfully')
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('Failed to place order')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (orderId) => {
    try {
      const { error } = await updateOrderStatus(orderId, 'cancelled')
      if (error) throw error
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
      toast.success('Order cancelled')
    } catch (error) {
      toast.error('Failed to cancel order')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Clinical Orders ({orders.length})</h3>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Order'}
        </button>
      </div>

      {/* New Order Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-100">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Order Type</label>
              <select
                value={form.order_type}
                onChange={(e) => setForm(prev => ({ ...prev, order_type: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {ORDER_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Order Description *</label>
            <input
              type="text"
              value={form.order_description}
              onChange={(e) => setForm(prev => ({ ...prev, order_description: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g., FBC, Chest X-ray PA, Urinalysis..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Clinical Indication</label>
            <input
              type="text"
              value={form.clinical_indication}
              onChange={(e) => setForm(prev => ({ ...prev, clinical_indication: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Reason for ordering..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Special Instructions</label>
            <textarea
              value={form.special_instructions}
              onChange={(e) => setForm(prev => ({ ...prev, special_instructions: e.target.value }))}
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g., Fasting required, Urgent callback if critical..."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Placing Order...' : 'Place Order'}
          </button>
        </form>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="text-sm text-slate-400 py-4 text-center">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-sm text-slate-400 py-4 text-center">No orders placed yet</div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <div key={order.id} className="flex items-start justify-between bg-white border border-slate-100 rounded-lg p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{ORDER_TYPES.find(t => t.value === order.order_type)?.icon}</span>
                  <span className="text-sm font-medium text-slate-800">{order.order_description}</span>
                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                    PRIORITIES.find(p => p.value === order.priority)?.color || ''
                  }`}>{order.priority}</span>
                </div>
                {order.clinical_indication && (
                  <p className="text-xs text-slate-500">Indication: {order.clinical_indication}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(order.created_at).toLocaleString()}
                  {order.ordered_by_user && ` · Dr. ${order.ordered_by_user.full_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[order.status] || ''}`}>
                  {order.status.replace('_', ' ')}
                </span>
                {order.status === 'ordered' && (
                  <button
                    type="button"
                    onClick={() => handleCancel(order.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ClinicalOrdersPanel
