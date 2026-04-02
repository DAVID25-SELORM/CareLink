import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'

/**
 * Drug Management Page
 * Add and manage drug inventory
 */

const DrugManagement = () => {
  const { user } = useAuth()
  const [drugs, setDrugs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    stock: ''
  })

  useEffect(() => {
    fetchDrugs()
  }, [])

  const fetchDrugs = async () => {
    try {
      const { data, error } = await supabase
        .from('drugs')
        .select('*')
        .order('name')

      if (error) throw error
      setDrugs(data || [])
    } catch (error) {
      console.error('Error fetching drugs:', error)
      toast.error('Failed to load drugs')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const drugPayload = {
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
      }

      const { data, error } = await supabase
        .from('drugs')
        .insert([drugPayload])
        .select()
        .single()

      if (error) throw error

      await logAuditEvent({
        user,
        action: 'create_drug',
        tableName: 'drugs',
        recordId: data.id,
        newValues: drugPayload,
      })

      toast.success('Drug added successfully!')
      setFormData({ name: '', category: '', price: '', stock: '' })
      setShowAddForm(false)
      fetchDrugs()
    } catch (error) {
      console.error('Error adding drug:', error)
      toast.error('Failed to add drug')
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Drug Inventory</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full rounded-lg bg-primary px-6 py-2 text-white transition hover:bg-blue-600 sm:w-auto"
          >
            <span className="mr-2">{showAddForm ? '✕' : '➕'}</span>
            {showAddForm ? 'Cancel' : 'Add New Drug'}
          </button>
        </div>

        {/* Add Drug Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Drug</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Drug Name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Category</option>
                <option value="antibiotic">Antibiotic</option>
                <option value="painkiller">Painkiller</option>
                <option value="antimalaria">Anti-malaria</option>
                <option value="vitamin">Vitamin/Supplement</option>
                <option value="other">Other</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Price (GH₵)"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                required
                min="0"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                placeholder="Stock Quantity"
                value={formData.stock}
                onChange={(e) => setFormData({...formData, stock: e.target.value})}
                required
                min="0"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="md:col-span-4 bg-medical hover:bg-green-600 text-white py-2 rounded-lg transition font-semibold"
              >
                Add Drug
              </button>
            </form>
          </div>
        )}

        {/* Drugs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="table-scroll">
            <table className="min-w-[720px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Drug Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Price (GH₵)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {drugs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    No drugs in inventory
                  </td>
                </tr>
              ) : (
                drugs.map((drug) => (
                  <tr key={drug.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {drug.name}
                    </td>
                    <td className="px-6 py-4 text-gray-700 capitalize">
                      {drug.category}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {drug.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${
                        drug.stock < 10 ? 'text-red-600' : 
                        drug.stock < 30 ? 'text-yellow-600' : 
                        'text-green-600'
                      }`}>
                        {drug.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {drug.stock === 0 ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          Out of Stock
                        </span>
                      ) : drug.stock < 10 ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          In Stock
                        </span>
                      )}
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

export default DrugManagement
