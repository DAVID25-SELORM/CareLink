import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'

/**
 * Inventory Management (Non-Drug Supplies)
 * Track medical supplies,equipment, linen, laboratory consumables
 * Author: David Gabion Selorm
 */

const InventoryManagement = () => {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('items')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showItemForm, setShowItemForm] = useState(false)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [itemFormData, setItemFormData] = useState({
    category_id: '',
    name: '',
    unit: 'pieces',
    quantity: '0',
    reorder_level: '10',
    unit_cost: '0',
    supplier: ''
  })
  const [transactionFormData, setTransactionFormData] = useState({
    item_id: '',
    transaction_type: 'issue',
    quantity: '',
    issued_to_department: '',
    notes: ''
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([
      fetchCategories(),
      fetchItems(),
      fetchTransactions()
    ])
    setLoading(false)
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('inventory_categories').select('*').order('name')
    setCategories(data || [])
  }

  const fetchItems = async () => {
    const { data } = await supabase.from('inventory_items').select('*, inventory_categories(name)').order('name')
    setItems(data || [])
  }

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*, inventory_items(name), users(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(50)
    setTransactions(data || [])
  }

  const saveItem = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...itemFormData,
        quantity: parseInt(itemFormData.quantity),
        reorder_level: parseInt(itemFormData.reorder_level),
        unit_cost: parseFloat(itemFormData.unit_cost)
      }

      if (editingItem) {
        const { error } = await supabase.from('inventory_items').update(payload).eq('id', editingItem.id)
        if (error) throw error
        toast.success('Item updated!')
      } else {
        const { error } = await supabase.from('inventory_items').insert([payload])
        if (error) throw error
        toast.success('Item added!')
      }

      setShowItemForm(false)
      setEditingItem(null)
      setItemFormData({ category_id: '', name: '', unit: 'pieces', quantity: '0', reorder_level: '10', unit_cost: '0', supplier: '' })
      fetchItems()
    } catch (error) {
      toast.error('Failed to save item')
    }
  }

  const recordTransaction = async (e) => {
    e.preventDefault()
    try {
      const item = items.find(i => i.id === transactionFormData.item_id)
      const quantity = parseInt(transactionFormData.quantity)
      
      let newBalance = item.quantity
      if (transactionFormData.transaction_type === 'restock') {
        newBalance += quantity
      } else if (['issue', 'wastage'].includes(transactionFormData.transaction_type)) {
        newBalance -= quantity
      }

      if (newBalance < 0) {
        toast.error('Insufficient stock!')
        return
      }

      const { error: transError } = await supabase.from('inventory_transactions').insert([{
        ...transactionFormData,
        quantity,
        balance_after: newBalance,
        issued_by: user.id,
        cost_per_unit: item.unit_cost,
        total_cost: item.unit_cost * quantity
      }])

      if (transError) throw transError

      const { error: itemError } = await supabase
        .from('inventory_items')
        .update({ quantity: newBalance })
        .eq('id', transactionFormData.item_id)

      if (itemError) throw itemError

      toast.success('Transaction recorded!')
      setShowTransactionForm(false)
      setTransactionFormData({ item_id: '', transaction_type: 'issue', quantity: '', issued_to_department: '', notes: '' })
      fetchAll()
    } catch (error) {
      toast.error('Failed to record transaction')
    }
  }

  const lowStockItems = items.filter(i => i.quantity <= i.reorder_level)
  const outOfStockItems = items.filter(i => i.quantity === 0)
  const filteredItems = selectedCategory === 'all' ? items : items.filter(i => i.category_id === selectedCategory)
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-gray-600">Medical supplies & equipment</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowItemForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              + Add Item
            </button>
            <button onClick={() => setShowTransactionForm(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              📝 Record Transaction
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <h4 className="text-blue-100 text-sm">Total Items</h4>
            <h2 className="text-4xl font-bold mt-2">{items.length}</h2>
          </div>
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <h4 className="text-green-100 text-sm">Total Value</h4>
            <h2 className="text-4xl font-bold mt-2">₵{totalValue.toFixed(0)}</h2>
          </div>
          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <h4 className="text-orange-100 text-sm">Low Stock</h4>
            <h2 className="text-4xl font-bold mt-2">{lowStockItems.length}</h2>
          </div>
          <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
            <h4 className="text-red-100 text-sm">Out of Stock</h4>
            <h2 className="text-4xl font-bold mt-2">{outOfStockItems.length}</h2>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border">
          <div className="flex overflow-x-auto">
            {['items', 'transactions', 'low-stock'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
              >
                {tab.replace('-', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'items' && (
          <div className="card">
            <div className="mb-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>  
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">{item.inventory_categories?.name}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${item.quantity <= item.reorder_level ? 'text-red-600' : 'text-green-600'}`}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">₵{item.unit_cost}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditingItem(item); setItemFormData({...item, category_id: item.category_id, quantity: item.quantity.toString(), reorder_level: item.reorder_level.toString(), unit_cost: item.unit_cost.toString()}); setShowItemForm(true) }} className="text-blue-600 text-sm mr-2">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="card">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued By</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(trans => (
                  <tr key={trans.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{new Date(trans.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{trans.inventory_items?.name}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{trans.transaction_type}</span></td>
                    <td className="px-4 py-3">{trans.quantity}</td>
                    <td className="px-4 py-3 text-sm">{trans.users?.full_name || trans.users?.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'low-stock' && (
          <div className="card">
            <h3 className="font-semibold mb-4">Low Stock Alerts</h3>
            {lowStockItems.map(item => (
              <div key={item.id} className="p-4 bg-orange-50 border-l-4 border-orange-500 mb-2">
                <h4 className="font-semibold">{item.name}</h4>
                <p className="text-sm">Stock: {item.quantity} {item.unit} (Reorder at: {item.reorder_level})</p>
              </div>
            ))}
          </div>
        )}

        {showItemForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">{editingItem ? 'Edit' : 'Add'} Item</h3>
              <form onSubmit={saveItem} className="space-y-4">
                <select required value={itemFormData.category_id} onChange={(e) => setItemFormData({...itemFormData, category_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                  <option value="">Select Category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <input required type="text" placeholder="Item Name" value={itemFormData.name} onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <input required type="number" placeholder="Quantity" value={itemFormData.quantity} onChange={(e) => setItemFormData({...itemFormData, quantity: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <input required type="number" placeholder="Reorder Level" value={itemFormData.reorder_level} onChange={(e) => setItemFormData({...itemFormData, reorder_level: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <input required type="number" step="0.01" placeholder="Unit Cost" value={itemFormData.unit_cost} onChange={(e) => setItemFormData({...itemFormData, unit_cost: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg">Save</button>
                  <button type="button" onClick={() => setShowItemForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showTransactionForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Record Transaction</h3>
              <form onSubmit={recordTransaction} className="space-y-4">
                <select required value={transactionFormData.item_id} onChange={(e) => setTransactionFormData({...transactionFormData, item_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                  <option value="">Select Item</option>
                  {items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.quantity} available)</option>)}
                </select>
                <select required value={transactionFormData.transaction_type} onChange={(e) => setTransactionFormData({...transactionFormData, transaction_type: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                  <option value="restock">Restock</option>
                  <option value="issue">Issue</option>
                  <option value="return">Return</option>
                  <option value="wastage">Wastage</option>
                </select>
                <input required type="number" placeholder="Quantity" value={transactionFormData.quantity} onChange={(e) => setTransactionFormData({...transactionFormData, quantity: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <input type="text" placeholder="Department" value={transactionFormData.issued_to_department} onChange={(e) => setTransactionFormData({...transactionFormData, issued_to_department: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg">Record</button>
                  <button type="button" onClick={() => setShowTransactionForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default InventoryManagement
