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

const EMPTY_FORM = {
  name: '',
  category: '',
  description: '',
  strength: '',
  formulation: '',
  brand_type: 'Generic',
  price: '',
  nhis_price: '0',
  stock: '',
  unit: 'tablets',
  reorder_level: '10',
  manufacturer: '',
  expiry_date: ''
}

const DrugManagement = () => {
  const { user, userRole } = useAuth()
  const isAdmin = userRole === 'admin'
  const canEdit = userRole === 'admin' || userRole === 'pharmacist'
  const [drugs, setDrugs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDrug, setEditingDrug] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [formData, setFormData] = useState(EMPTY_FORM)

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
        description: formData.description || null,
        strength: formData.strength || null,
        formulation: formData.formulation || null,
        brand_type: formData.brand_type || 'Generic',
        price: parseFloat(formData.price) || 0,
        nhis_price: isAdmin ? (parseFloat(formData.nhis_price) || 0) : 0,
        stock: parseInt(formData.stock),
        unit: formData.unit || 'tablets',
        reorder_level: parseInt(formData.reorder_level) || 10,
        manufacturer: formData.manufacturer || null,
        expiry_date: formData.expiry_date || null,
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
      setFormData(EMPTY_FORM)
      setShowAddForm(false)
      fetchDrugs()
    } catch (error) {
      console.error('Error adding drug:', error)
      toast.error('Failed to add drug')
    }
  }

  const handleEdit = (drug) => {
    setEditingDrug({
      ...drug,
      price: drug.price?.toString() || '0',
      nhis_price: drug.nhis_price?.toString() || '0',
      stock: drug.stock?.toString() || '0',
      reorder_level: drug.reorder_level?.toString() || '10',
      strength: drug.strength || '',
      formulation: drug.formulation || '',
      brand_type: drug.brand_type || 'Generic',
      manufacturer: drug.manufacturer || '',
      expiry_date: drug.expiry_date || '',
      description: drug.description || '',
    })
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        name: editingDrug.name,
        category: editingDrug.category,
        description: editingDrug.description || null,
        strength: editingDrug.strength || null,
        formulation: editingDrug.formulation || null,
        brand_type: editingDrug.brand_type || 'Generic',
        stock: parseInt(editingDrug.stock),
        unit: editingDrug.unit || 'tablets',
        manufacturer: editingDrug.manufacturer || null,
        expiry_date: editingDrug.expiry_date || null,
        ...(isAdmin && {
          price: parseFloat(editingDrug.price) || 0,
          nhis_price: parseFloat(editingDrug.nhis_price) || 0,
          reorder_level: parseInt(editingDrug.reorder_level) || 10,
        }),
      }
      const { error } = await supabase.from('drugs').update(payload).eq('id', editingDrug.id)
      if (error) throw error
      await logAuditEvent({ user, action: 'update_drug', tableName: 'drugs', recordId: editingDrug.id, newValues: payload })
      toast.success('Drug updated!')
      setEditingDrug(null)
      fetchDrugs()
    } catch (error) {
      console.error('Error updating drug:', error)
      toast.error('Failed to update drug')
    }
  }

  const filteredDrugs = drugs.filter(d => {
    const matchSearch = !searchTerm || d.name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchCat = !categoryFilter || d.category === categoryFilter
    return matchSearch && matchCat
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

  const CATEGORIES = ['antibiotic','antimalaria','antifungal','antiviral','cardiovascular','diabetes','painkiller','gastrointestinal','respiratory','antihistamine','neurological','vitamin','injectable','topical','cough_cold','ophthalmic','other']
  const FORMULATIONS = ['Tablet','Capsule','Syrup','Suspension','Injection','Infusion','Cream','Gel','Ointment','Eye Drop','Eye/Ear Drop','Suppository','Pessary','Powder','Inhaler','Nebuliser','Lotion','Linctus','N/A']

  const adminFieldClass = (extra = '') =>
    `px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
      isAdmin ? 'border-gray-300' : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
    } ${extra}`

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Drug Inventory</h2>
            <p className="text-sm text-gray-500 mt-1">{drugs.length} items · 🔒 Price fields require Admin role</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full rounded-lg bg-primary px-6 py-2 text-white transition hover:bg-blue-600 sm:w-auto"
            >
              {showAddForm ? '✕ Cancel' : '➕ Add New Drug'}
            </button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search drugs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_',' ')}</option>)}
          </select>
        </div>

        {/* Add Drug Form */}
        {showAddForm && canEdit && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-1">Add New Drug</h3>
            {!isAdmin && <p className="text-xs text-amber-600 mb-4">🔒 Price fields are admin-only. Set to 0 now; admin can update later.</p>}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <input type="text" placeholder="Drug Name *" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary lg:col-span-2" />
              <select value={formData.brand_type} onChange={(e) => setFormData({...formData, brand_type: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="Generic">Generic</option>
                <option value="Brand">Brand</option>
              </select>
              <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} required className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="">Select Category *</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_',' ')}</option>)}
              </select>
              <select value={formData.formulation} onChange={(e) => setFormData({...formData, formulation: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="">Formulation</option>
                {FORMULATIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <input type="text" placeholder="Strength (e.g. 500mg, 5mg/5ml)" value={formData.strength} onChange={(e) => setFormData({...formData, strength: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg" />

              {/* Admin-only: price fields */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cash Price (GH₵) {!isAdmin && <span className="text-amber-500">🔒 Admin only</span>}
                </label>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} disabled={!isAdmin} className={adminFieldClass('w-full')} />
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  NHIS Price (GH₵) {!isAdmin && <span className="text-amber-500">🔒 Admin only</span>}
                </label>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={formData.nhis_price} onChange={(e) => setFormData({...formData, nhis_price: e.target.value})} disabled={!isAdmin} className={adminFieldClass('w-full')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Reorder Level {!isAdmin && <span className="text-amber-500">🔒 Admin only</span>}
                </label>
                <input type="number" min="0" placeholder="10" value={formData.reorder_level} onChange={(e) => setFormData({...formData, reorder_level: e.target.value})} disabled={!isAdmin} className={adminFieldClass('w-full')} />
              </div>

              <input type="number" placeholder="Stock Quantity *" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} required min="0" className="px-4 py-2 border border-gray-300 rounded-lg" />
              <select value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="tablets">Tablets</option>
                <option value="capsules">Capsules</option>
                <option value="bottles">Bottles</option>
                <option value="vials">Vials</option>
                <option value="ampoules">Ampoules</option>
                <option value="sachets">Sachets</option>
                <option value="tubes">Tubes</option>
                <option value="pieces">Pieces</option>
              </select>
              <input type="text" placeholder="Manufacturer / Brand Name" value={formData.manufacturer} onChange={(e) => setFormData({...formData, manufacturer: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg" />
              <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({...formData, expiry_date: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg" />
              <textarea placeholder="Description / Notes (optional)" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="2" className="md:col-span-2 lg:col-span-3 px-4 py-2 border border-gray-300 rounded-lg" />
              <button type="submit" className="md:col-span-2 lg:col-span-3 bg-medical hover:bg-green-600 text-white py-2 rounded-lg font-semibold">Add Drug</button>
            </form>
          </div>
        )}

        {/* Drugs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b text-sm text-gray-600">
            Showing <strong>{filteredDrugs.length}</strong> of {drugs.length} drugs
          </div>
          <div className="table-scroll">
            <table className="min-w-[1000px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drug Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strength / Form</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cash Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NHIS Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  {canEdit && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDrugs.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-12 text-center text-gray-500">No drugs found</td></tr>
                ) : (
                  filteredDrugs.map((drug) => {
                    const isExpired = drug.expiry_date && new Date(drug.expiry_date) < new Date()
                    const expiringDays = drug.expiry_date ? Math.ceil((new Date(drug.expiry_date) - new Date()) / 86400000) : null
                    return (
                      <tr key={drug.id} className={`hover:bg-gray-50 ${isExpired ? 'bg-red-50' : expiringDays !== null && expiringDays <= 30 ? 'bg-yellow-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{drug.name}</div>
                          {drug.manufacturer && <div className="text-xs text-gray-400">{drug.manufacturer}</div>}
                          {drug.brand_type && <span className={`text-xs px-1.5 py-0.5 rounded ${drug.brand_type === 'Brand' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{drug.brand_type}</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>{drug.strength || '—'}</div>
                          <div className="text-gray-500">{drug.formulation || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">{drug.category?.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm font-medium">GH₵{(drug.price || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">{drug.nhis_price > 0 ? `GH₵${drug.nhis_price.toFixed(2)}` : <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${drug.stock < (drug.reorder_level || 10) ? 'text-red-600' : drug.stock < (drug.reorder_level || 10) * 3 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {drug.stock} {drug.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isExpired ? <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">⚠ Expired</span>
                            : expiringDays !== null && expiringDays <= 30 ? <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Exp {expiringDays}d</span>
                            : drug.stock === 0 ? <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Out of Stock</span>
                            : drug.stock < (drug.reorder_level || 10) ? <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Low Stock</span>
                            : <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">In Stock</span>}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3">
                            <button onClick={() => handleEdit(drug)} className="text-primary hover:text-blue-800 text-sm font-medium">Edit</button>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {editingDrug && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Drug</h3>
                <button onClick={() => setEditingDrug(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>
              {!isAdmin && <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 mb-4">🔒 Price fields are admin-only. You can update stock, expiry, and unit.</p>}
              <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Drug Name *" value={editingDrug.name} onChange={(e) => setEditingDrug({...editingDrug, name: e.target.value})} required className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg" />
                <select value={editingDrug.category} onChange={(e) => setEditingDrug({...editingDrug, category: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_',' ')}</option>)}
                </select>
                <select value={editingDrug.brand_type} onChange={(e) => setEditingDrug({...editingDrug, brand_type: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="Generic">Generic</option>
                  <option value="Brand">Brand</option>
                </select>
                <select value={editingDrug.formulation} onChange={(e) => setEditingDrug({...editingDrug, formulation: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="">Formulation</option>
                  {FORMULATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input type="text" placeholder="Strength (e.g. 500mg)" value={editingDrug.strength} onChange={(e) => setEditingDrug({...editingDrug, strength: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg" />

                {/* Admin-only price fields */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cash Price (GH₵) {!isAdmin && '🔒'}</label>
                  <input type="number" step="0.01" min="0" value={editingDrug.price} onChange={(e) => setEditingDrug({...editingDrug, price: e.target.value})} disabled={!isAdmin} className={adminFieldClass('w-full')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NHIS Price (GH₵) {!isAdmin && '🔒'}</label>
                  <input type="number" step="0.01" min="0" value={editingDrug.nhis_price} onChange={(e) => setEditingDrug({...editingDrug, nhis_price: e.target.value})} disabled={!isAdmin} className={adminFieldClass('w-full')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level {!isAdmin && '🔒'}</label>
                  <input type="number" min="0" value={editingDrug.reorder_level} onChange={(e) => setEditingDrug({...editingDrug, reorder_level: e.target.value})} disabled={!isAdmin} className={adminFieldClass('w-full')} />
                </div>

                <input type="number" min="0" placeholder="Stock Qty" value={editingDrug.stock} onChange={(e) => setEditingDrug({...editingDrug, stock: e.target.value})} required className="px-4 py-2 border border-gray-300 rounded-lg" />
                <select value={editingDrug.unit} onChange={(e) => setEditingDrug({...editingDrug, unit: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="tablets">Tablets</option>
                  <option value="capsules">Capsules</option>
                  <option value="bottles">Bottles</option>
                  <option value="vials">Vials</option>
                  <option value="ampoules">Ampoules</option>
                  <option value="sachets">Sachets</option>
                  <option value="tubes">Tubes</option>
                  <option value="pieces">Pieces</option>
                </select>
                <input type="text" placeholder="Manufacturer" value={editingDrug.manufacturer} onChange={(e) => setEditingDrug({...editingDrug, manufacturer: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg" />
                <input type="date" value={editingDrug.expiry_date} onChange={(e) => setEditingDrug({...editingDrug, expiry_date: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg" />
                <textarea placeholder="Description / Notes" value={editingDrug.description} onChange={(e) => setEditingDrug({...editingDrug, description: e.target.value})} rows="2" className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg" />

                <div className="md:col-span-2 flex gap-3 justify-end">
                  <button type="button" onClick={() => setEditingDrug(null)} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default DrugManagement
