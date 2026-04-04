import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { logAuditEvent } from '../services/auditLog'
import { supabase } from '../supabaseClient'

/**
 * Comprehensive Pharmacy Dashboard
 * Complete pharmacy management system with tabs for dispensing, inventory, stock alerts, and more
 * 
 * Author: David Gabion Selorm
 */

const Pharmacy = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [prescriptions, setPrescriptions] = useState([])
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [prescriptionItems, setPrescriptionItems] = useState([])
  const [drugs, setDrugs] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showAddDrugForm, setShowAddDrugForm] = useState(false)
  const [editingDrug, setEditingDrug] = useState(null)
  const [drugFormData, setDrugFormData] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    stock: '',
    unit: 'tablets',
    reorder_level: '10',
    manufacturer: '',
    expiry_date: ''
  })

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    await Promise.all([
      fetchPrescriptions(),
      fetchDrugs()
    ])
    setLoading(false)
  }

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
    }
  }

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
      toast.error('Failed to load drug inventory')
    }
  }

  const fetchPrescriptionItems = async (prescriptionId) => {
    try {
      const { data, error} = await supabase
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
      fetchAllData()
    } catch (error) {
      console.error('Error dispensing prescription:', error)
      toast.error('Failed to dispense prescription')
    }
  }

  const handleSaveDrug = async (e) => {
    e.preventDefault()
    
    try {
      const drugPayload = {
        name: drugFormData.name,
        category: drugFormData.category,
        description: drugFormData.description || null,
        price: parseFloat(drugFormData.price),
        stock: parseInt(drugFormData.stock),
        unit: drugFormData.unit,
        reorder_level: parseInt(drugFormData.reorder_level),
        manufacturer: drugFormData.manufacturer || null,
        expiry_date: drugFormData.expiry_date || null
      }

      if (editingDrug) {
        const { error } = await supabase
          .from('drugs')
          .update(drugPayload)
          .eq('id', editingDrug.id)

        if (error) throw error
        
        await logAuditEvent({
          user,
          action: 'update_drug',
          tableName: 'drugs',
          recordId: editingDrug.id,
          oldValues: editingDrug,
          newValues: drugPayload
        })
        
        toast.success('Drug updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('drugs')
          .insert([drugPayload])
          .select()
          .single()

        if (error) throw error
        
        await logAuditEvent({
          user,
          action: 'add_drug',
          tableName: 'drugs',
          recordId: data.id,
          newValues: drugPayload
        })
        
        toast.success('Drug added successfully!')
      }

      setDrugFormData({
        name: '',
        category: '',
        description: '',
        price: '',
        stock: '',
        unit: 'tablets',
        reorder_level: '10',
        manufacturer: '',
        expiry_date: ''
      })
      setEditingDrug(null)
      setShowAddDrugForm(false)
      fetchDrugs()
    } catch (error) {
      console.error('Error saving drug:', error)
      toast.error('Failed to save drug')
    }
  }

  const handleEditDrug = (drug) => {
    setEditingDrug(drug)
    setDrugFormData({
      name: drug.name,
      category: drug.category,
      description: drug.description || '',
      price: drug.price.toString(),
      stock: drug.stock.toString(),
      unit: drug.unit || 'tablets',
      reorder_level: drug.reorder_level?.toString() || '10',
      manufacturer: drug.manufacturer || '',
      expiry_date: drug.expiry_date || ''
    })
    setShowAddDrugForm(true)
    setActiveTab('manage-drugs')
  }

  const handleDeleteDrug = async (drugId) => {
    if (!confirm('Are you sure you want to delete this drug?')) return

    try {
      const { error } = await supabase
        .from('drugs')
        .delete()
        .eq('id', drugId)

      if (error) throw error
      
      await logAuditEvent({
        user,
        action: 'delete_drug',
        tableName: 'drugs',
        recordId: drugId
      })
      
      toast.success('Drug deleted successfully!')
      fetchDrugs()
    } catch (error) {
      console.error('Error deleting drug:', error)
      toast.error('Failed to delete drug')
    }
  }

  // Calculations and filtered data
  const pendingPrescriptions = prescriptions.filter((p) => p.status === 'pending')
  const dispensedCount = prescriptions.filter((p) => p.status === 'dispensed').length
  const lowStockDrugs = drugs.filter((d) => d.stock <= (d.reorder_level || 10))
  const outOfStockDrugs = drugs.filter((d) => d.stock === 0)
  
  const expiringDrugs = drugs.filter((d) => {
    if (!d.expiry_date) return false
    const expiryDate = new Date(d.expiry_date)
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)
    return expiryDate <= threeMonthsFromNow && expiryDate >= new Date()
  })

  const expiredDrugs = drugs.filter((d) => {
    if (!d.expiry_date) return false
    return new Date(d.expiry_date) < new Date()
  })

  const categories = [...new Set(drugs.map(d => d.category))].filter(Boolean)
  
  const filteredDrugs = drugs.filter(drug => {
    const matchesSearch = drug.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         drug.category?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || drug.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const totalInventoryValue = drugs.reduce((sum, drug) => sum + (drug.price * drug.stock), 0)
  
  const totalAmount = prescriptionItems.reduce(
    (sum, item) => sum + (Number(item.drugs?.price || 0) * Number(item.quantity || 0)),
    0,
  )

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="spinner mb-4"></div>
            <p className="text-gray-600">Loading pharmacy dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'dispense', label: 'Dispense', icon: '💊', badge: pendingPrescriptions.length },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'low-stock', label: 'Low Stock', icon: '⚠️', badge: lowStockDrugs.length },
    { id: 'expiry', label: 'Expiry', icon: '⏰', badge: expiringDrugs.length + expiredDrugs.length },
    { id: 'manage-drugs', label: 'Manage', icon: '⚙️' }
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Pharmacy Dashboard</h1>
            <p className="text-gray-600 mt-1">Complete pharmacy management and dispensing</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium text-sm whitespace-nowrap transition relative ${
                  activeTab === tab.id
                    ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <h4 className="text-blue-100 text-sm font-medium">Total Drugs</h4>
                  <h2 className="text-4xl font-bold mt-2">{drugs.length}</h2>
                  <p className="text-blue-100 text-sm mt-1">In inventory</p>
                </div>
                
                <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <h4 className="text-green-100 text-sm font-medium">Inventory Value</h4>
                  <h2 className="text-4xl font-bold mt-2">₵{totalInventoryValue.toFixed(0)}</h2>
                  <p className="text-green-100 text-sm mt-1">Total worth</p>
                </div>
                
                <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                  <h4 className="text-orange-100 text-sm font-medium">Low Stock</h4>
                  <h2 className="text-4xl font-bold mt-2">{lowStockDrugs.length}</h2>
                  <p className="text-orange-100 text-sm mt-1">{outOfStockDrugs.length} out of stock</p>
                </div>
                
                <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <h4 className="text-purple-100 text-sm font-medium">Pending</h4>
                  <h2 className="text-4xl font-bold mt-2">{pendingPrescriptions.length}</h2>
                  <p className="text-purple-100 text-sm mt-1">Prescriptions</p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Prescription Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Pending</span>
                      <span className="font-bold text-orange-600">{pendingPrescriptions.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Dispensed Today</span>
                      <span className="font-bold text-green-600">{dispensedCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total</span>
                      <span className="font-bold text-blue-600">{prescriptions.length}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Stock Alerts</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Expiring Soon</span>
                      <span className="font-bold text-yellow-600">{expiringDrugs.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Expired</span>
                      <span className="font-bold text-red-600">{expiredDrugs.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Low Stock</span>
                      <span className="font-bold text-orange-600">{lowStockDrugs.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Drug Categories ({categories.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span
                      key={category}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {category} ({drugs.filter(d => d.category === category).length})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DISPENSE TAB */}
          {activeTab === 'dispense' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Prescriptions List */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">
                    Pending Prescriptions ({pendingPrescriptions.length})
                  </h3>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {pendingPrescriptions.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <div className="text-4xl mb-2">✅</div>
                        <p>No pending prescriptions</p>
                      </div>
                    ) : (
                      pendingPrescriptions.map((prescription) => (
                        <div
                          key={prescription.id}
                          onClick={() => handleSelectPrescription(prescription)}
                          className={`p-4 rounded-lg cursor-pointer transition ${
                            selectedPrescription?.id === prescription.id
                              ? 'bg-blue-50 border-2 border-blue-500'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{prescription.patients?.name}</h4>
                              <p className="text-sm text-gray-600">{prescription.patients?.phone}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Dr. {getDoctorLabel(prescription)}
                              </p>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(prescription.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {prescription.diagnosis && (
                            <p className="text-sm text-gray-700 mt-2 italic">{prescription.diagnosis}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Prescription Details */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Prescription Details</h3>
                  {!selectedPrescription ? (
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-4xl mb-2">📋</div>
                      <p>Select a prescription to view details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="font-medium text-lg">{selectedPrescription.patients?.name}</h4>
                        <p className="text-sm text-gray-600">{selectedPrescription.patients?.phone}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Doctor: {getDoctorLabel(selectedPrescription)}
                        </p>
                      </div>

                      <div>
                        <h5 className="font-medium mb-3">Medications:</h5>
                        {prescriptionItems.length === 0 ? (
                          <p className="text-gray-500 text-sm">Loading...</p>
                        ) : (
                          <div className="space-y-2">
                            {prescriptionItems.map((item) => {
                              const hasStock = Number(item.drugs?.stock || 0) >= Number(item.quantity || 0)
                              return (
                                <div
                                  key={item.id}
                                  className={`p-3 rounded-lg ${
                                    hasStock ? 'bg-green-50' : 'bg-red-50 border border-red-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium">{item.drugs?.name || item.drug_name}</p>
                                      <p className={`text-sm ${hasStock ? 'text-gray-600' : 'text-red-600 font-medium'}`}>
                                        Stock: {item.drugs?.stock ?? 'N/A'} {!hasStock && '(Insufficient!)'}
                                      </p>
                                      {item.dosage && (
                                        <p className="text-xs text-gray-500">
                                          {item.dosage} • {item.frequency} • {item.duration}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right ml-4">
                                      <p className="font-bold">Qty: {item.quantity}</p>
                                      <p className="text-sm text-gray-600">
                                        ₵{(Number(item.drugs?.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {prescriptionItems.length > 0 && (
                        <div className="pt-4 border-t">
                          <div className="flex items-center justify-between mb-4">
                            <span className="font-semibold">Total Amount:</span>
                            <span className="text-2xl font-bold text-blue-600">
                              ₵{totalAmount.toFixed(2)}
                            </span>
                          </div>
                          <button
                            onClick={handleDispense}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition font-semibold"
                          >
                            ✓ Dispense Prescription
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* INVENTORY TAB */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Search drugs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drug Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredDrugs.map((drug) => (
                        <tr key={drug.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{drug.name}</p>
                              <p className="text-xs text-gray-500">{drug.manufacturer || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {drug.category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${
                              drug.stock === 0 ? 'text-red-600' :
                              drug.stock <= (drug.reorder_level || 10) ? 'text-orange-600' :
                              'text-green-600'
                            }`}>
                              {drug.stock} {drug.unit || 'units'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">₵{drug.price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {drug.expiry_date ? new Date(drug.expiry_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleEditDrug(drug)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteDrug(drug.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LOW STOCK TAB */}
          {activeTab === 'low-stock' && (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>⚠️</span>
                  Low Stock Alerts ({lowStockDrugs.length})
                </h3>
                {lowStockDrugs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">✅</div>
                    <p>All drugs have sufficient stock</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lowStockDrugs.map((drug) => (
                      <div
                        key={drug.id}
                        className={`p-4 rounded-lg border-2 ${
                          drug.stock === 0
                            ? 'bg-red-50 border-red-200'
                            : 'bg-orange-50 border-orange-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{drug.name}</h4>
                            <p className="text-sm text-gray-600">{drug.category}</p>
                            <p className={`text-sm font-bold mt-2 ${
                              drug.stock === 0 ? 'text-red-600' : 'text-orange-600'
                            }`}>
                              {drug.stock === 0 ? 'OUT OF STOCK' : `Only ${drug.stock} ${drug.unit} left`}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Reorder level: {drug.reorder_level || 10}
                            </p>
                          </div>
                          <button
                            onClick={() => handleEditDrug(drug)}
                            className="bg-white px-3 py-1 rounded text-sm font-medium hover:bg-gray-100"
                          >
                            Restock
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EXPIRY TAB */}
          {activeTab === 'expiry' && (
            <div className="space-y-4">
              {/* Expired Drugs */}
              {expiredDrugs.length > 0 && (
                <div className="card bg-red-50 border-2 border-red-200">
                  <h3 className="text-lg font-semibold mb-4 text-red-800 flex items-center gap-2">
                    <span>🚫</span>
                    Expired Drugs ({expiredDrugs.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {expiredDrugs.map((drug) => (
                      <div key={drug.id} className="bg-white p-3 rounded-lg border border-red-200">
                        <h4 className="font-medium text-red-800">{drug.name}</h4>
                        <p className="text-sm text-gray-600">{drug.category}</p>
                        <p className="text-sm font-bold text-red-600 mt-1">
                          Expired: {new Date(drug.expiry_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">Stock: {drug.stock} {drug.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiring Soon */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>⏰</span>
                  Expiring Soon (Next 3 Months) - {expiringDrugs.length}
                </h3>
                {expiringDrugs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">✅</div>
                    <p>No drugs expiring in the next 3 months</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {expiringDrugs.map((drug) => {
                      const daysUntilExpiry = Math.ceil(
                        (new Date(drug.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
                      )
                      return (
                        <div
                          key={drug.id}
                          className="p-3 rounded-lg bg-yellow-50 border border-yellow-200"
                        >
                          <h4 className="font-medium">{drug.name}</h4>
                          <p className="text-sm text-gray-600">{drug.category}</p>
                          <p className="text-sm font-bold text-yellow-700 mt-1">
                            Expires: {new Date(drug.expiry_date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-yellow-600">{daysUntilExpiry} days remaining</p>
                          <p className="text-xs text-gray-500 mt-1">Stock: {drug.stock} {drug.unit}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MANAGE DRUGS TAB */}
          {activeTab === 'manage-drugs' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {showAddDrugForm ? (editingDrug ? 'Edit Drug' : 'Add New Drug') : 'Manage Drugs'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddDrugForm(!showAddDrugForm)
                    if (showAddDrugForm) {
                      setEditingDrug(null)
                      setDrugFormData({
                        name: '',
                        category: '',
                        description: '',
                        price: '',
                        stock: '',
                        unit: 'tablets',
                        reorder_level: '10',
                        manufacturer: '',
                        expiry_date: ''
                      })
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  {showAddDrugForm ? 'Cancel' : '+ Add New Drug'}
                </button>
              </div>

              {showAddDrugForm && (
                <div className="card">
                  <form onSubmit={handleSaveDrug} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Drug Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={drugFormData.name}
                          onChange={(e) => setDrugFormData({...drugFormData, name: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Paracetamol"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Category *
                        </label>
                        <input
                          type="text"
                          required
                          value={drugFormData.category}
                          onChange={(e) => setDrugFormData({...drugFormData, category: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Analgesics"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Price (₵) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={drugFormData.price}
                          onChange={(e) => setDrugFormData({...drugFormData, price: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Stock Quantity *
                        </label>
                        <input
                          type="number"
                          required
                          value={drugFormData.stock}
                          onChange={(e) => setDrugFormData({...drugFormData, stock: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Unit
                        </label>
                        <select
                          value={drugFormData.unit}
                          onChange={(e) => setDrugFormData({...drugFormData, unit: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="tablets">Tablets</option>
                          <option value="capsules">Capsules</option>
                          <option value="bottles">Bottles</option>
                          <option value="vials">Vials</option>
                          <option value="boxes">Boxes</option>
                          <option value="units">Units</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reorder Level
                        </label>
                        <input
                          type="number"
                          value={drugFormData.reorder_level}
                          onChange={(e) => setDrugFormData({...drugFormData, reorder_level: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="10"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Manufacturer
                        </label>
                        <input
                          type="text"
                          value={drugFormData.manufacturer}
                          onChange={(e) => setDrugFormData({...drugFormData, manufacturer: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Pfizer"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={drugFormData.expiry_date}
                          onChange={(e) => setDrugFormData({...drugFormData, expiry_date: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={drugFormData.description}
                          onChange={(e) => setDrugFormData({...drugFormData, description: e.target.value})}
                          rows="2"
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional description"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold"
                    >
                      {editingDrug ? 'Update Drug' : 'Add Drug'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Pharmacy
