import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'

const Radiology = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [reportText, setReportText] = useState('')
  const [findings, setFindings] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('clinical_orders')
        .select(`
          *,
          patients:patient_id(name, patient_id, phone),
          encounters:encounter_id(encounter_type, started_at)
        `)
        .eq('order_type', 'radiology')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching radiology orders:', error)
      toast.error('Failed to load radiology orders')
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const updates = { status: newStatus }
      if (newStatus === 'in_progress') {
        updates.started_at = new Date().toISOString()  // added by migration 007
        updates.completed_by = user.id
      }

      const { error } = await supabase
        .from('clinical_orders')
        .update(updates)
        .eq('id', orderId)

      if (error) throw error

      toast.success(`Order ${newStatus === 'in_progress' ? 'started' : 'updated'}`)
      fetchOrders()
    } catch (error) {
      console.error('Error updating order:', error)
      toast.error('Failed to update order')
    }
  }

  const submitReport = async (e) => {
    e.preventDefault()
    if (!selectedOrder) return

    try {
      const { error } = await supabase
        .from('clinical_orders')
        .update({
          status: 'completed',
          result_summary: reportText,
          result_notes: findings,          // added by migration 007
          completed_at: new Date().toISOString(),
          completed_by: user.id
        })
        .eq('id', selectedOrder.id)

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'complete_radiology_report',
        tableName: 'clinical_orders',
        recordId: selectedOrder.id,
        newValues: { result: reportText, findings, status: 'completed' }
      })

      toast.success('Radiology report submitted!')
      setSelectedOrder(null)
      setReportText('')
      setFindings('')
      fetchOrders()
    } catch (error) {
      console.error('Error submitting report:', error)
      toast.error('Failed to submit report')
    }
  }

  const pendingOrders = orders.filter(o => o.status === 'ordered' || o.status === 'pending')
  const inProgressOrders = orders.filter(o => o.status === 'in_progress')
  const completedOrders = orders.filter(o => o.status === 'completed')

  const filteredOrders = activeTab === 'pending' ? pendingOrders
    : activeTab === 'in_progress' ? inProgressOrders
    : completedOrders

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Radiology</h1>
          <p className="text-slate-500">Imaging orders, reports & worklist</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="text-3xl font-bold text-orange-600">{pendingOrders.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-sm text-slate-500">In Progress</p>
            <p className="text-3xl font-bold text-blue-600">{inProgressOrders.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-sm text-slate-500">Completed Today</p>
            <p className="text-3xl font-bold text-green-600">{completedOrders.length}</p>
          </div>
        </div>

        <div className="flex gap-2 border-b">
          {[
            { id: 'pending', label: `Pending (${pendingOrders.length})` },
            { id: 'in_progress', label: `In Progress (${inProgressOrders.length})` },
            { id: 'completed', label: `Completed (${completedOrders.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No orders in this category</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Study</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Ordered</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {order.patients?.name || 'Unknown'}
                        <span className="block text-xs text-slate-400">{order.patients?.patient_id}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {order.order_details?.test_name || order.order_details?.study || order.notes || 'Radiology Study'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.priority === 'stat' ? 'bg-red-100 text-red-700' :
                          order.priority === 'urgent' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {(order.priority || 'routine').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {(order.status === 'ordered' || order.status === 'pending') && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'in_progress')}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Start
                            </button>
                          )}
                          {order.status === 'in_progress' && (
                            <button
                              onClick={() => { setSelectedOrder(order); setReportText(''); setFindings('') }}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Report
                            </button>
                          )}
                          {order.status === 'completed' && order.result && (
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedOrder && selectedOrder.status === 'in_progress' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                Radiology Report — {selectedOrder.patients?.name}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Study: {selectedOrder.order_details?.test_name || selectedOrder.order_details?.study || 'Radiology Study'}
              </p>
              <form onSubmit={submitReport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Findings</label>
                  <textarea
                    required
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe imaging findings..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Impression / Report</label>
                  <textarea
                    required
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Radiologist impression and conclusion..."
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
                    Submit Report
                  </button>
                  <button type="button" onClick={() => setSelectedOrder(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedOrder && selectedOrder.status === 'completed' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                Report — {selectedOrder.patients?.name}
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">Study</p>
                  <p className="text-sm">{selectedOrder.order_details?.test_name || selectedOrder.order_details?.study || 'Radiology Study'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Findings</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedOrder.result_notes || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Impression</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedOrder.result || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Completed</p>
                  <p className="text-sm">{selectedOrder.completed_at ? new Date(selectedOrder.completed_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="mt-4 w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Radiology
