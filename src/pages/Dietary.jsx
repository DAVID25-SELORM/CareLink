import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'

const DIET_TYPES = ['Regular', 'Soft', 'Liquid', 'Clear Liquid', 'NPO (Nil by Mouth)', 'Diabetic', 'Low Sodium', 'Low Fat', 'High Protein', 'Renal', 'Cardiac', 'High Fibre', 'Gluten-Free', 'Lactose-Free']

export default function Dietary() {
  const { user, userRole } = useAuth()
  const { orgId } = useOrg()
  const [orders, setOrders] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('active')

  const [form, setForm] = useState({
    admission_id: '',
    diet_type: 'Regular',
    special_instructions: '',
    allergies: '',
    fluid_restriction_ml: '',
    meal_frequency: '3',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    ordered_by: '',
    notes: '',
  })

  useEffect(() => {
    if (orgId) {
      fetchOrders()
      fetchAdmissions()
    }
  }, [orgId, filterStatus])

  async function fetchOrders() {
    setLoading(true)
    try {
      let query = supabase
        .from('diet_orders')
        .select('*, admissions(admission_number, patients(full_name, folder_number))')
        .eq('hospital_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query
      if (error) throw error
      setOrders(data || [])
    } catch {
      toast.error('Failed to load diet orders')
    } finally {
      setLoading(false)
    }
  }

  async function fetchAdmissions() {
    const { data } = await supabase
      .from('admissions')
      .select('id, admission_number, patients(full_name, folder_number)')
      .eq('hospital_id', orgId)
      .is('discharge_date', null)
      .order('created_at', { ascending: false })
      .limit(200)
    setAdmissions(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.admission_id || !form.diet_type) {
      toast.error('Admission and diet type are required')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('diet_orders').insert({
        ...form,
        hospital_id: orgId,
        status: 'active',
        ordered_by: user.id,
      })
      if (error) throw error
      toast.success('Diet order created')
      setShowForm(false)
      setForm({ admission_id: '', diet_type: 'Regular', special_instructions: '', allergies: '', fluid_restriction_ml: '', meal_frequency: '3', start_date: new Date().toISOString().split('T')[0], end_date: '', ordered_by: '', notes: '' })
      fetchOrders()
    } catch {
      toast.error('Failed to create diet order')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(orderId, status) {
    const { error } = await supabase.from('diet_orders').update({ status }).eq('id', orderId)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Diet order updated')
    fetchOrders()
  }

  const canEdit = ['admin', 'doctor', 'nurse'].includes(userRole)

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Dietary Services</h2>
            <p className="text-sm text-slate-500 mt-0.5">Diet orders and nutritional management for admitted patients</p>
          </div>
          {canEdit && (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
              + New Diet Order
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Orders', value: orders.filter(o => o.status === 'active').length, color: 'bg-green-50 text-green-700' },
            { label: 'NPO Patients', value: orders.filter(o => o.status === 'active' && o.diet_type === 'NPO (Nil by Mouth)').length, color: 'bg-red-50 text-red-700' },
            { label: 'Special Diets', value: orders.filter(o => o.status === 'active' && !['Regular', 'Soft', 'Liquid'].includes(o.diet_type)).length, color: 'bg-blue-50 text-blue-700' },
            { label: 'Total Orders', value: orders.length, color: 'bg-slate-100 text-slate-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color} border border-current border-opacity-20`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm font-medium opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* New Order Form */}
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">New Diet Order</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Admitted Patient *</label>
                <select value={form.admission_id} onChange={e => setForm(f => ({ ...f, admission_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Select admission</option>
                  {admissions.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.patients?.full_name} ({a.patients?.folder_number}) — Adm #{a.admission_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Diet Type *</label>
                <select value={form.diet_type} onChange={e => setForm(f => ({ ...f, diet_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                  {DIET_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Meals Per Day</label>
                <select value={form.meal_frequency} onChange={e => setForm(f => ({ ...f, meal_frequency: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="6">6 (small frequent)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fluid Restriction (mL/day)</label>
                <input type="number" value={form.fluid_restriction_ml} onChange={e => setForm(f => ({ ...f, fluid_restriction_ml: e.target.value }))} placeholder="Leave blank if none" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Allergies / Intolerances</label>
                <input value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} placeholder="e.g. Peanuts, Dairy" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Special Instructions</label>
                <textarea value={form.special_instructions} onChange={e => setForm(f => ({ ...f, special_instructions: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. No added salt, pureed consistency" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Create Diet Order'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Filter:</span>
          {['active', 'discontinued', 'all'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${filterStatus === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Patient', 'Diet Type', 'Meals/Day', 'Fluid Restriction', 'Allergies', 'Start Date', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No diet orders found</td></tr>
              )}
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{o.admissions?.patients?.full_name}</td>
                  <td className="px-4 py-3 text-slate-700">{o.diet_type}</td>
                  <td className="px-4 py-3 text-slate-600">{o.meal_frequency}x/day</td>
                  <td className="px-4 py-3 text-slate-600">{o.fluid_restriction_ml ? `${o.fluid_restriction_ml} mL` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{o.allergies || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{o.start_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${o.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {o.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      {o.status === 'active' && (
                        <button onClick={() => updateStatus(o.id, 'discontinued')} className="text-xs text-red-600 hover:text-red-800 font-medium">Discontinue</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
