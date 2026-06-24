import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'

const TABS = ['Staff', 'Attendance', 'Leave', 'Payroll']

const DEPARTMENTS = ['Administration', 'Clinical', 'Nursing', 'Laboratory', 'Pharmacy', 'Radiology', 'Accounts', 'Records', 'Maintenance', 'Security', 'Catering', 'IT']
const ROLES = ['Doctor', 'Nurse', 'Pharmacist', 'Lab Technician', 'Radiographer', 'Cashier', 'Records Officer', 'Administrator', 'Driver', 'Security Guard', 'Cleaner', 'Other']
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Locum', 'Intern', 'Volunteer']
const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Maternity Leave', 'Paternity Leave', 'Study Leave', 'Emergency Leave', 'Unpaid Leave']

export default function HRPayroll() {
  const { user } = useAuth()
  const { orgId } = useOrg()
  const [activeTab, setActiveTab] = useState('Staff')
  const [staff, setStaff] = useState([])
  const [attendance, setAttendance] = useState([])
  const [leaves, setLeaves] = useState([])
  const [payroll, setPayroll] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showStaffForm, setShowStaffForm] = useState(false)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [showPayrollForm, setShowPayrollForm] = useState(false)
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7))

  const [staffForm, setStaffForm] = useState({
    full_name: '',
    employee_id: '',
    department: 'Clinical',
    role: 'Doctor',
    employment_type: 'Full-time',
    phone: '',
    email: '',
    hire_date: '',
    basic_salary: '',
    allowances: '',
    bank_name: '',
    bank_account: '',
    national_id: '',
    ssnit_number: '',
    tin_number: '',
  })

  const [leaveForm, setLeaveForm] = useState({
    staff_id: '',
    leave_type: 'Annual Leave',
    start_date: '',
    end_date: '',
    reason: '',
  })

  const [payrollForm, setPayrollForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    notes: '',
  })

  useEffect(() => {
    if (orgId) {
      fetchAll()
    }
  }, [orgId])

  useEffect(() => {
    if (orgId && activeTab === 'Attendance') fetchAttendance()
  }, [orgId, attendanceDate, activeTab])

  useEffect(() => {
    if (orgId && activeTab === 'Payroll') fetchPayroll()
  }, [orgId, payrollMonth, activeTab])

  async function fetchAll() {
    setLoading(true)
    try {
      const [staffRes, leaveRes] = await Promise.all([
        supabase.from('hr_staff').select('*').eq('hospital_id', orgId).order('full_name'),
        supabase.from('hr_leaves').select('*, hr_staff(full_name, employee_id)').eq('hospital_id', orgId).order('created_at', { ascending: false }).limit(100),
      ])
      setStaff(staffRes.data || [])
      setLeaves(leaveRes.data || [])
    } catch {
      toast.error('Failed to load HR data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchAttendance() {
    const { data } = await supabase
      .from('hr_attendance')
      .select('*, hr_staff(full_name, employee_id, department)')
      .eq('hospital_id', orgId)
      .eq('date', attendanceDate)
    setAttendance(data || [])
  }

  async function fetchPayroll() {
    const { data } = await supabase
      .from('hr_payroll')
      .select('*, hr_staff(full_name, employee_id, department, role)')
      .eq('hospital_id', orgId)
      .eq('month', payrollMonth)
    setPayroll(data || [])
  }

  async function handleStaffSubmit(e) {
    e.preventDefault()
    if (!staffForm.full_name || !staffForm.employee_id) { toast.error('Name and Employee ID required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('hr_staff').insert({ ...staffForm, hospital_id: orgId, created_by: user.id, status: 'active' })
      if (error) throw error
      toast.success('Staff record created')
      setShowStaffForm(false)
      setStaffForm({ full_name: '', employee_id: '', department: 'Clinical', role: 'Doctor', employment_type: 'Full-time', phone: '', email: '', hire_date: '', basic_salary: '', allowances: '', bank_name: '', bank_account: '', national_id: '', ssnit_number: '', tin_number: '' })
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to save staff record')
    } finally {
      setSaving(false)
    }
  }

  async function markAttendance(staffId, status) {
    const existing = attendance.find(a => a.staff_id === staffId)
    if (existing) {
      await supabase.from('hr_attendance').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('hr_attendance').insert({ hospital_id: orgId, staff_id: staffId, date: attendanceDate, status, marked_by: user.id })
    }
    fetchAttendance()
  }

  async function handleLeaveSubmit(e) {
    e.preventDefault()
    if (!leaveForm.staff_id || !leaveForm.start_date || !leaveForm.end_date) { toast.error('Staff, start and end dates required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('hr_leaves').insert({ ...leaveForm, hospital_id: orgId, status: 'pending', applied_by: user.id })
      if (error) throw error
      toast.success('Leave request submitted')
      setShowLeaveForm(false)
      setLeaveForm({ staff_id: '', leave_type: 'Annual Leave', start_date: '', end_date: '', reason: '' })
      fetchAll()
    } catch {
      toast.error('Failed to submit leave request')
    } finally {
      setSaving(false)
    }
  }

  async function handleLeaveAction(leaveId, action) {
    const { error } = await supabase.from('hr_leaves').update({ status: action, approved_by: user.id }).eq('id', leaveId)
    if (error) { toast.error('Failed to update leave'); return }
    toast.success(`Leave ${action}`)
    fetchAll()
  }

  async function generatePayroll(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const activeStaff = staff.filter(s => s.status === 'active')
      const payrollEntries = activeStaff.map(s => ({
        hospital_id: orgId,
        staff_id: s.id,
        month: payrollForm.month,
        basic_salary: parseFloat(s.basic_salary) || 0,
        allowances: parseFloat(s.allowances) || 0,
        gross_salary: (parseFloat(s.basic_salary) || 0) + (parseFloat(s.allowances) || 0),
        ssnit_deduction: ((parseFloat(s.basic_salary) || 0) * 0.055),
        income_tax: ((parseFloat(s.basic_salary) || 0) * 0.1),
        net_salary: ((parseFloat(s.basic_salary) || 0) + (parseFloat(s.allowances) || 0)) - ((parseFloat(s.basic_salary) || 0) * 0.055) - ((parseFloat(s.basic_salary) || 0) * 0.1),
        status: 'draft',
        notes: payrollForm.notes,
        generated_by: user.id,
      }))
      const { error } = await supabase.from('hr_payroll').upsert(payrollEntries, { onConflict: 'hospital_id,staff_id,month' })
      if (error) throw error
      toast.success(`Payroll generated for ${payrollEntries.length} staff members`)
      setShowPayrollForm(false)
      fetchPayroll()
    } catch (err) {
      toast.error('Failed to generate payroll')
    } finally {
      setSaving(false)
    }
  }

  async function processPayroll(payrollId) {
    const { error } = await supabase.from('hr_payroll').update({ status: 'processed', processed_by: user.id, processed_at: new Date().toISOString() }).eq('id', payrollId)
    if (error) { toast.error('Failed'); return }
    toast.success('Payment marked as processed')
    fetchPayroll()
  }

  const totalPayroll = payroll.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0)

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">HR & Payroll</h2>
            <p className="text-sm text-slate-500 mt-0.5">Staff records, attendance, leave management, and payroll</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'Staff' && <button onClick={() => setShowStaffForm(true)} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition">+ Add Staff</button>}
            {activeTab === 'Leave' && <button onClick={() => setShowLeaveForm(true)} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition">+ Leave Request</button>}
            {activeTab === 'Payroll' && <button onClick={() => setShowPayrollForm(true)} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition">Generate Payroll</button>}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Staff', value: staff.length, color: 'bg-purple-50 text-purple-700' },
            { label: 'Active', value: staff.filter(s => s.status === 'active').length, color: 'bg-green-50 text-green-700' },
            { label: 'On Leave', value: leaves.filter(l => l.status === 'approved').length, color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Pending Leave', value: leaves.filter(l => l.status === 'pending').length, color: 'bg-red-50 text-red-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color} border border-current border-opacity-20`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm font-medium opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Staff Tab */}
        {activeTab === 'Staff' && (
          <div className="space-y-4">
            {showStaffForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">New Staff Record</h3>
                <form onSubmit={handleStaffSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Full Name *', key: 'full_name', type: 'text' },
                    { label: 'Employee ID *', key: 'employee_id', type: 'text' },
                    { label: 'Phone', key: 'phone', type: 'tel' },
                    { label: 'Email', key: 'email', type: 'email' },
                    { label: 'Hire Date', key: 'hire_date', type: 'date' },
                    { label: 'Basic Salary (GHS)', key: 'basic_salary', type: 'number' },
                    { label: 'Allowances (GHS)', key: 'allowances', type: 'number' },
                    { label: 'National ID', key: 'national_id', type: 'text' },
                    { label: 'SSNIT Number', key: 'ssnit_number', type: 'text' },
                    { label: 'TIN Number', key: 'tin_number', type: 'text' },
                    { label: 'Bank Name', key: 'bank_name', type: 'text' },
                    { label: 'Bank Account', key: 'bank_account', type: 'text' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input type={f.type} value={staffForm[f.key]} onChange={e => setStaffForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  ))}
                  {[
                    { label: 'Department', key: 'department', options: DEPARTMENTS },
                    { label: 'Role', key: 'role', options: ROLES },
                    { label: 'Employment Type', key: 'employment_type', options: EMPLOYMENT_TYPES },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <select value={staffForm[f.key]} onChange={e => setStaffForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="md:col-span-2 lg:col-span-3 flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowStaffForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Staff'}</button>
                  </div>
                </form>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Name', 'ID', 'Department', 'Role', 'Type', 'Phone', 'Basic Salary', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No staff records found</td></tr>}
                  {staff.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{s.employee_id}</td>
                      <td className="px-4 py-3 text-slate-600">{s.department}</td>
                      <td className="px-4 py-3 text-slate-600">{s.role}</td>
                      <td className="px-4 py-3 text-slate-600">{s.employment_type}</td>
                      <td className="px-4 py-3 text-slate-600">{s.phone}</td>
                      <td className="px-4 py-3 text-slate-600">GHS {parseFloat(s.basic_salary || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'Attendance' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700">Date:</label>
              <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Staff Member', 'Department', 'Role', 'Attendance'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.filter(s => s.status === 'active').length === 0 && (
                    <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">No active staff</td></tr>
                  )}
                  {staff.filter(s => s.status === 'active').map(s => {
                    const att = attendance.find(a => a.staff_id === s.id)
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{s.department}</td>
                        <td className="px-4 py-3 text-slate-600">{s.role}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {['present', 'absent', 'late', 'off'].map(status => (
                              <button
                                key={status}
                                onClick={() => markAttendance(s.id, status)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition capitalize ${att?.status === status
                                  ? status === 'present' ? 'bg-green-600 text-white' : status === 'absent' ? 'bg-red-600 text-white' : status === 'late' ? 'bg-yellow-500 text-white' : 'bg-slate-500 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Leave Tab */}
        {activeTab === 'Leave' && (
          <div className="space-y-4">
            {showLeaveForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl">
                <h3 className="font-semibold text-slate-900 mb-4">Leave Request</h3>
                <form onSubmit={handleLeaveSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
                    <select value={leaveForm.staff_id} onChange={e => setLeaveForm(f => ({ ...f, staff_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
                      <option value="">Select staff</option>
                      {staff.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type</label>
                    <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                      <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
                      <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                    <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowLeaveForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">{saving ? 'Saving...' : 'Submit Request'}</button>
                  </div>
                </form>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Staff', 'Leave Type', 'Start', 'End', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No leave requests</td></tr>}
                  {leaves.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{l.hr_staff?.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{l.leave_type}</td>
                      <td className="px-4 py-3 text-slate-600">{l.start_date}</td>
                      <td className="px-4 py-3 text-slate-600">{l.end_date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${l.status === 'approved' ? 'bg-green-100 text-green-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {l.status === 'pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleLeaveAction(l.id, 'approved')} className="text-xs font-medium text-green-600 hover:text-green-800">Approve</button>
                            <button onClick={() => handleLeaveAction(l.id, 'rejected')} className="text-xs font-medium text-red-600 hover:text-red-800">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payroll Tab */}
        {activeTab === 'Payroll' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700">Month:</label>
              <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            {showPayrollForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl">
                <h3 className="font-semibold text-slate-900 mb-2">Generate Payroll</h3>
                <p className="text-sm text-slate-500 mb-4">This will generate payroll for all {staff.filter(s => s.status === 'active').length} active staff members for the selected month. SSNIT (5.5%) and Income Tax (10%) will be deducted automatically.</p>
                <form onSubmit={generatePayroll} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Month *</label>
                    <input type="month" value={payrollForm.month} onChange={e => setPayrollForm(f => ({ ...f, month: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                    <textarea value={payrollForm.notes} onChange={e => setPayrollForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowPayrollForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">{saving ? 'Generating...' : 'Generate'}</button>
                  </div>
                </form>
              </div>
            )}
            {payroll.length > 0 && (
              <div className="bg-purple-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-900">Total Net Payroll — {payrollMonth}</p>
                  <p className="text-2xl font-bold text-purple-700">GHS {totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <span className="text-sm text-purple-600">{payroll.length} staff</span>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Staff', 'Department', 'Basic', 'Allowances', 'Gross', 'SSNIT', 'Tax', 'Net', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payroll.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">No payroll generated for this month</td></tr>}
                  {payroll.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-medium text-slate-900 text-xs">{p.hr_staff?.full_name}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{p.hr_staff?.department}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{parseFloat(p.basic_salary || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{parseFloat(p.allowances || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 font-medium text-slate-700 text-xs">{parseFloat(p.gross_salary || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-red-600 text-xs">-{parseFloat(p.ssnit_deduction || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-red-600 text-xs">-{parseFloat(p.income_tax || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 font-bold text-green-700 text-xs">{parseFloat(p.net_salary || 0).toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${p.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span>
                      </td>
                      <td className="px-3 py-3">
                        {p.status === 'draft' && (
                          <button onClick={() => processPayroll(p.id)} className="text-xs text-purple-600 hover:text-purple-800 font-medium">Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
