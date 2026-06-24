import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'

const TABS = [
  { id: 'orders', label: 'Purchase Orders', icon: '📋' },
  { id: 'receive', label: 'Receive Stock (GRN)', icon: '📦' },
  { id: 'suppliers', label: 'Suppliers', icon: '🏭' },
  { id: 'history', label: 'History', icon: '📊' },
]

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  ordered: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const Procurement = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('orders')
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [drugs, setDrugs] = useState([])
  const [loading, setLoading] = useState(true)

  // PO form
  const [showPOForm, setShowPOForm] = useState(false)
  const [poForm, setPoForm] = useState({ supplier_id: '', expected_date: '', notes: '' })
  const [poItems, setPoItems] = useState([{ drug_id: '', quantity: '', unit_cost: '' }])

  // Supplier form
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' })

  // GRN modal
  const [grnOrder, setGrnOrder] = useState(null)
  const [grnItems, setGrnItems] = useState([])

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchPurchaseOrders(), fetchSuppliers(), fetchDrugs()])
    setLoading(false)
  }

  const fetchPurchaseOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers:supplier_id(name, contact_person),
        purchase_order_items(id, drug_id, quantity_ordered, quantity_received, unit_cost, drugs:drug_id(name, unit))
      `)
      .order('created_at', { ascending: false })
    setPurchaseOrders(data || [])
  }

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .order('name')
    setSuppliers(data || [])
  }

  const fetchDrugs = async () => {
    const { data } = await supabase
      .from('drugs')
      .select('id, name, unit, price')
      .order('name')
    setDrugs(data || [])
  }

  // ── Purchase Order ──────────────────────────────────────────────────────────

  const addPoItem = () => setPoItems(prev => [...prev, { drug_id: '', quantity: '', unit_cost: '' }])
  const removePoItem = (i) => setPoItems(prev => prev.filter((_, idx) => idx !== i))
  const updatePoItem = (i, field, value) =>
    setPoItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const handleCreatePO = async (e) => {
    e.preventDefault()
    const validItems = poItems.filter(i => i.drug_id && i.quantity > 0 && i.unit_cost >= 0)
    if (!validItems.length) { toast.error('Add at least one valid item'); return }

    try {
      const totalCost = validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0)

      const { data: po, error } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: poForm.supplier_id || null,
          expected_date: poForm.expected_date || null,
          notes: poForm.notes || null,
          status: 'ordered',
          total_cost: totalCost,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('purchase_order_items').insert(
        validItems.map(item => ({
          purchase_order_id: po.id,
          drug_id: item.drug_id,
          quantity_ordered: Number(item.quantity),
          quantity_received: 0,
          unit_cost: Number(item.unit_cost),
        }))
      )

      await logAuditEvent({ user, action: 'create_purchase_order', tableName: 'purchase_orders', recordId: po.id })
      toast.success('Purchase order created!')
      setShowPOForm(false)
      setPoForm({ supplier_id: '', expected_date: '', notes: '' })
      setPoItems([{ drug_id: '', quantity: '', unit_cost: '' }])
      fetchPurchaseOrders()
    } catch (err) {
      console.error(err)
      toast.error('Failed to create purchase order')
    }
  }

  const cancelPO = async (id) => {
    if (!confirm('Cancel this purchase order?')) return
    await supabase.from('purchase_orders').update({ status: 'cancelled' }).eq('id', id)
    await logAuditEvent({ user, action: 'cancel_purchase_order', tableName: 'purchase_orders', recordId: id })
    toast.success('Purchase order cancelled')
    fetchPurchaseOrders()
  }

  // ── GRN — Receive Stock ─────────────────────────────────────────────────────

  const openGRN = (order) => {
    setGrnOrder(order)
    setGrnItems(
      (order.purchase_order_items || []).map(item => ({
        ...item,
        qty_receiving: item.quantity_ordered - (item.quantity_received || 0),
      }))
    )
    setActiveTab('receive')
  }

  const handleReceiveStock = async (e) => {
    e.preventDefault()
    if (!grnOrder) return

    try {
      let allReceived = true

      for (const item of grnItems) {
        const qty = Number(item.qty_receiving)
        if (qty <= 0) continue

        const newReceived = (item.quantity_received || 0) + qty
        if (newReceived < item.quantity_ordered) allReceived = false

        // Update PO item received quantity
        await supabase
          .from('purchase_order_items')
          .update({ quantity_received: newReceived })
          .eq('id', item.id)

        // Increment drug stock
        const { data: drug } = await supabase.from('drugs').select('stock').eq('id', item.drug_id).single()
        if (drug) {
          await supabase.from('drugs').update({ stock: (drug.stock || 0) + qty }).eq('id', item.drug_id)
        }
      }

      const newStatus = allReceived ? 'received' : 'partially_received'
      await supabase.from('purchase_orders').update({ status: newStatus, received_at: new Date().toISOString(), received_by: user.id }).eq('id', grnOrder.id)

      await logAuditEvent({ user, action: 'receive_stock_grn', tableName: 'purchase_orders', recordId: grnOrder.id })
      toast.success('Stock received and inventory updated!')
      setGrnOrder(null)
      setGrnItems([])
      fetchAll()
    } catch (err) {
      console.error(err)
      toast.error('Failed to receive stock')
    }
  }

  // ── Suppliers ───────────────────────────────────────────────────────────────

  const handleSaveSupplier = async (e) => {
    e.preventDefault()
    try {
      if (editingSupplier) {
        await supabase.from('suppliers').update(supplierForm).eq('id', editingSupplier.id)
        toast.success('Supplier updated!')
      } else {
        const { data } = await supabase.from('suppliers').insert(supplierForm).select().single()
        await logAuditEvent({ user, action: 'add_supplier', tableName: 'suppliers', recordId: data?.id })
        toast.success('Supplier added!')
      }
      setShowSupplierForm(false)
      setEditingSupplier(null)
      setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '' })
      fetchSuppliers()
    } catch (err) {
      toast.error('Failed to save supplier')
    }
  }

  const editSupplier = (s) => {
    setEditingSupplier(s)
    setSupplierForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '' })
    setShowSupplierForm(true)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="spinner"></div>
        </div>
      </DashboardLayout>
    )
  }

  const pendingOrders = purchaseOrders.filter(o => o.status === 'ordered' || o.status === 'partially_received')
  const totalSpend = purchaseOrders
    .filter(o => o.status === 'received')
    .reduce((s, o) => s + Number(o.total_cost || 0), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Procurement</h1>
            <p className="text-gray-500 mt-1">Manage drug purchasing, suppliers, and stock receiving</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'orders' && (
              <button onClick={() => setShowPOForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                + New Purchase Order
              </button>
            )}
            {activeTab === 'suppliers' && (
              <button onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '' }); setShowSupplierForm(true) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                + Add Supplier
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Pending Orders</p>
            <p className="text-3xl font-bold text-blue-600">{pendingOrders.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Orders</p>
            <p className="text-3xl font-bold text-gray-700">{purchaseOrders.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Suppliers</p>
            <p className="text-3xl font-bold text-purple-600">{suppliers.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Spend (Received)</p>
            <p className="text-2xl font-bold text-green-600">₵{totalSpend.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="flex overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition ${
                  activeTab === tab.id ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── PURCHASE ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {showPOForm && (
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <h3 className="font-semibold text-lg">New Purchase Order</h3>
                <form onSubmit={handleCreatePO} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                      <select
                        value={poForm.supplier_id}
                        onChange={e => setPoForm({ ...poForm, supplier_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">No supplier / Cash purchase</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
                      <input type="date" value={poForm.expected_date} onChange={e => setPoForm({ ...poForm, expected_date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <input type="text" value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })}
                        placeholder="Optional notes..."
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Order Items</h4>
                      <button type="button" onClick={addPoItem} className="text-sm text-blue-600 hover:underline">+ Add Item</button>
                    </div>
                    <div className="space-y-2">
                      {poItems.map((item, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <select
                              value={item.drug_id}
                              onChange={e => updatePoItem(i, 'drug_id', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Select drug</option>
                              {drugs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <input type="number" min="1" placeholder="Qty" value={item.quantity}
                              onChange={e => updatePoItem(i, 'quantity', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                          </div>
                          <div className="col-span-3">
                            <input type="number" min="0" step="0.01" placeholder="Unit cost ₵" value={item.unit_cost}
                              onChange={e => updatePoItem(i, 'unit_cost', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            {poItems.length > 1 && (
                              <button type="button" onClick={() => removePoItem(i)} className="text-red-500 hover:text-red-700 text-lg font-bold">×</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">Create Order</button>
                    <button type="button" onClick={() => setShowPOForm(false)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchaseOrders.filter(o => o.status !== 'received' && o.status !== 'cancelled').length === 0 ? (
                    <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-400">No active purchase orders</td></tr>
                  ) : purchaseOrders.filter(o => o.status !== 'received' && o.status !== 'cancelled').map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">PO-{order.id.slice(-6).toUpperCase()}</td>
                      <td className="px-4 py-3 text-sm">{order.suppliers?.name || 'Direct purchase'}</td>
                      <td className="px-4 py-3 text-sm">{order.purchase_order_items?.length || 0} drug(s)</td>
                      <td className="px-4 py-3 text-sm font-semibold">₵{Number(order.total_cost || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                          {order.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          {(order.status === 'ordered' || order.status === 'partially_received') && (
                            <button onClick={() => openGRN(order)} className="text-green-600 hover:text-green-800 text-sm font-medium">Receive</button>
                          )}
                          {order.status === 'ordered' && (
                            <button onClick={() => cancelPO(order.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── RECEIVE STOCK (GRN) TAB ── */}
        {activeTab === 'receive' && (
          <div className="space-y-4">
            {!grnOrder ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">Select an Order to Receive</h3>
                {pendingOrders.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No pending orders to receive</p>
                ) : (
                  <div className="space-y-2">
                    {pendingOrders.map(order => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div>
                          <p className="font-medium">PO-{order.id.slice(-6).toUpperCase()} — {order.suppliers?.name || 'Direct'}</p>
                          <p className="text-sm text-gray-500">{order.purchase_order_items?.length} item(s) · ₵{Number(order.total_cost).toFixed(2)}</p>
                        </div>
                        <button onClick={() => openGRN(order)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
                          Receive
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">Goods Received Note</h3>
                    <p className="text-sm text-gray-500">PO-{grnOrder.id.slice(-6).toUpperCase()} · {grnOrder.suppliers?.name || 'Direct purchase'}</p>
                  </div>
                  <button onClick={() => setGrnOrder(null)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
                </div>
                <form onSubmit={handleReceiveStock} className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Drug</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ordered</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Previously Received</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Receiving Now</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {grnItems.map((item, i) => {
                          const remaining = item.quantity_ordered - (item.quantity_received || 0)
                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-3 font-medium text-sm">{item.drugs?.name}</td>
                              <td className="px-4 py-3 text-sm">{item.quantity_ordered} {item.drugs?.unit}</td>
                              <td className="px-4 py-3 text-sm">{item.quantity_received || 0}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  value={item.qty_receiving}
                                  onChange={e => setGrnItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty_receiving: e.target.value } : it))}
                                  className="w-24 px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                />
                                <span className="text-xs text-gray-400 ml-2">max {remaining}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                      Confirm Receipt & Update Stock
                    </button>
                    <button type="button" onClick={() => setGrnOrder(null)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ── SUPPLIERS TAB ── */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4">
            {showSupplierForm && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
                <form onSubmit={handleSaveSupplier} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                      <input required type="text" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                      <input type="text" value={supplierForm.contact_person} onChange={e => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input type="text" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input type="text" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                      {editingSupplier ? 'Update' : 'Add Supplier'}
                    </button>
                    <button type="button" onClick={() => setShowSupplierForm(false)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Person</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {suppliers.length === 0 ? (
                    <tr><td colSpan="5" className="px-4 py-10 text-center text-gray-400">No suppliers added yet</td></tr>
                  ) : suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-sm">{s.name}</td>
                      <td className="px-4 py-3 text-sm">{s.contact_person || '—'}</td>
                      <td className="px-4 py-3 text-sm">{s.phone || '—'}</td>
                      <td className="px-4 py-3 text-sm">{s.email || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => editSupplier(s)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchaseOrders.filter(o => o.status === 'received' || o.status === 'cancelled').length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-400">No completed orders yet</td></tr>
                ) : purchaseOrders.filter(o => o.status === 'received' || o.status === 'cancelled').map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">PO-{order.id.slice(-6).toUpperCase()}</td>
                    <td className="px-4 py-3 text-sm">{order.suppliers?.name || 'Direct'}</td>
                    <td className="px-4 py-3 text-sm">{order.purchase_order_items?.length || 0}</td>
                    <td className="px-4 py-3 text-sm font-semibold">₵{Number(order.total_cost || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || ''}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {order.received_at ? new Date(order.received_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Procurement
