import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'

const CATEGORIES = [
  'All',
  'Registration',
  'Consultation',
  'Admission',
  'Diagnostic',
  'Procedure',
  'Physiotherapy',
  'Eye Care',
  'Surgery',
  'Records',
  'Other',
]

const ServicesCatalog = () => {
  const { userRole } = useAuth()
  const isAdmin = userRole === 'admin'

  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newService, setNewService] = useState({ service_name: '', category: 'Consultation', price: '', description: '' })

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('service_fees')
      .select('*')
      .order('category')
      .order('service_name')
    if (error) {
      toast.error('Failed to load services')
    } else {
      setServices(data || [])
    }
    setLoading(false)
  }

  const handlePriceSave = async (id) => {
    const price = parseFloat(editPrice)
    if (isNaN(price) || price < 0) { toast.error('Invalid price'); return }
    const { error } = await supabase
      .from('service_fees')
      .update({ price, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error('Failed to update price'); return }
    toast.success('Price updated!')
    setEditingId(null)
    fetchServices()
  }

  const handleAddService = async (e) => {
    e.preventDefault()
    const price = parseFloat(newService.price)
    if (!newService.service_name.trim() || isNaN(price) || price < 0) {
      toast.error('Please fill all required fields with valid values')
      return
    }
    const { error } = await supabase.from('service_fees').insert([{
      service_name: newService.service_name.trim(),
      category: newService.category,
      price,
      description: newService.description.trim() || null,
    }])
    if (error) {
      toast.error(error.message || 'Failed to add service')
      return
    }
    toast.success('Service added!')
    setNewService({ service_name: '', category: 'Consultation', price: '', description: '' })
    setShowAddForm(false)
    fetchServices()
  }

  const filteredServices = services.filter((s) => {
    const matchCat = activeCategory === 'All' || s.category === activeCategory
    const matchSearch = !searchTerm || s.service_name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchCat && matchSearch
  })

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Services &amp; Fees</h2>
            <p className="text-sm text-gray-500 mt-1">Hospital service fee schedule — 2026</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {isAdmin && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="rounded-lg bg-primary px-4 py-2 text-white text-sm font-medium transition hover:bg-blue-600"
              >
                {showAddForm ? 'Cancel' : '+ Add Service'}
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
              {cat !== 'All' && (
                <span className="ml-1 text-xs opacity-75">
                  ({services.filter((s) => s.category === cat).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Add service form (admin only) */}
        {isAdmin && showAddForm && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Service</h3>
            <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  value={newService.service_name}
                  onChange={(e) => setNewService({ ...newService, service_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Specialist Consultation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={newService.category}
                  onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (GH₵) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newService.price}
                  onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Optional description"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                >
                  Add Service
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Services table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredServices.length}</span> of {services.length} services
            </span>
            {!isAdmin && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                🔒 Prices can only be edited by Admin
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price (GH₵)</th>
                  {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-12 text-center text-gray-400">
                      {searchTerm ? `No services matching "${searchTerm}"` : 'No services in this category'}
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{s.service_name}</div>
                        {s.description && <div className="text-xs text-gray-500 mt-0.5">{s.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                          {s.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === s.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <button
                              onClick={() => handlePriceSave(s.id)}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                            >Save</button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                            >Cancel</button>
                          </div>
                        ) : (
                          <span className="font-semibold text-sm">GH₵{Number(s.price).toFixed(2)}</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {editingId !== s.id && (
                            <button
                              onClick={() => { setEditingId(s.id); setEditPrice(s.price) }}
                              className="text-primary hover:text-blue-800 text-sm font-medium"
                            >
                              Edit Price
                            </button>
                          )}
                        </td>
                      )}
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

export default ServicesCatalog
