import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useOrg } from '../hooks/useOrg'

const TABS = ['Find Patient', 'Appointments', 'Lab Results', 'Bills', 'Visit History']

export default function PatientPortal() {
  const { orgId } = useOrg()
  const [activeTab, setActiveTab] = useState('Find Patient')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [appointments, setAppointments] = useState([])
  const [labResults, setLabResults] = useState([])
  const [bills, setBills] = useState([])
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, folder_number, phone_number, date_of_birth, gender, nhis_number')
        .eq('hospital_id', orgId)
        .or(`full_name.ilike.%${searchQuery}%,folder_number.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%,nhis_number.ilike.%${searchQuery}%`)
        .limit(20)
      if (error) throw error
      setSearchResults(data || [])
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function selectPatient(patient) {
    setSelectedPatient(patient)
    setSearchResults([])
    setActiveTab('Appointments')
    setLoading(true)
    try {
      const [appRes, labRes, billRes, visitRes] = await Promise.all([
        supabase.from('appointments').select('*').eq('patient_id', patient.id).order('appointment_date', { ascending: false }).limit(20),
        supabase
          .from('lab_tests')
          .select('id, test_name, result, numeric_value, unit, reference_range, result_flag, status, completed_at, created_at')
          .eq('patient_id', patient.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(50),
        supabase.from('payments').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('encounters').select('id, encounter_date, encounter_type, chief_complaint, status, users(email)').eq('patient_id', patient.id).order('encounter_date', { ascending: false }).limit(30),
      ])
      setAppointments(appRes.data || [])
      setLabResults(labRes.data || [])
      setBills(billRes.data || [])
      setVisits(visitRes.data || [])
    } catch {
      toast.error('Failed to load patient data')
    } finally {
      setLoading(false)
    }
  }

  function clearPatient() {
    setSelectedPatient(null)
    setActiveTab('Find Patient')
    setAppointments([])
    setLabResults([])
    setBills([])
    setVisits([])
  }

  const totalBilled = bills.reduce((sum, b) => sum + (parseFloat(b.amount_paid) || 0), 0)

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Patient Portal</h2>
            <p className="text-sm text-slate-500 mt-0.5">Patient self-service view — appointments, results, and bills</p>
          </div>
          {selectedPatient && (
            <button onClick={clearPatient} className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg">
              ← Change Patient
            </button>
          )}
        </div>

        {/* Patient Banner */}
        {selectedPatient && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {selectedPatient.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900">{selectedPatient.full_name}</p>
              <div className="flex gap-4 text-xs text-slate-500 mt-0.5 flex-wrap">
                <span>Folder: {selectedPatient.folder_number}</span>
                <span>Phone: {selectedPatient.phone_number}</span>
                {selectedPatient.date_of_birth && <span>DOB: {selectedPatient.date_of_birth}</span>}
                {selectedPatient.nhis_number && <span>NHIS: {selectedPatient.nhis_number}</span>}
                <span className="capitalize">{selectedPatient.gender}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-500">Total Paid</p>
              <p className="font-bold text-slate-900">GHS {totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => selectedPatient || tab === 'Find Patient' ? setActiveTab(tab) : toast.info('Search for a patient first')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'} ${!selectedPatient && tab !== 'Find Patient' ? 'opacity-40 cursor-not-allowed' : ''}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Find Patient */}
        {activeTab === 'Find Patient' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl">
              <h3 className="font-semibold text-slate-900 mb-4">Search Patient</h3>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Name, folder number, phone, or NHIS number"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" disabled={searching} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {searching ? '...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-3 divide-y divide-slate-100">
                  {searchResults.map(p => (
                    <button key={p.id} onClick={() => selectPatient(p)}
                      className="w-full text-left py-3 px-2 hover:bg-slate-50 rounded-lg transition">
                      <p className="font-medium text-slate-900 text-sm">{p.full_name}</p>
                      <p className="text-xs text-slate-500">Folder: {p.folder_number} | Phone: {p.phone_number}</p>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !searching && (
                <p className="mt-3 text-sm text-slate-400">No patients found for "{searchQuery}"</p>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Appointments */}
        {activeTab === 'Appointments' && !loading && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-semibold text-slate-700">Appointments ({appointments.length})</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Date', 'Time', 'Doctor', 'Department', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">No appointments</td></tr>}
                {appointments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.appointment_date}</td>
                    <td className="px-4 py-3 text-slate-600">{a.appointment_time}</td>
                    <td className="px-4 py-3 text-slate-700">{a.doctor_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{a.department || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${a.status === 'confirmed' ? 'bg-green-100 text-green-700' : a.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Lab Results */}
        {activeTab === 'Lab Results' && !loading && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-semibold text-slate-700">Lab Results ({labResults.length})</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Test', 'Result', 'Unit', 'Reference Range', 'Flag', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {labResults.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No lab results</td></tr>}
                {labResults.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.test_name}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{r.numeric_value ?? r.result ?? 'Pending'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.unit}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.reference_range}</td>
                    <td className="px-4 py-3">
                      {r.result_flag && r.result_flag !== 'normal' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium capitalize">
                          {r.result_flag.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{(r.completed_at || r.created_at) ? new Date(r.completed_at || r.created_at).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bills */}
        {activeTab === 'Bills' && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Paid', value: `GHS ${totalBilled.toFixed(2)}`, color: 'bg-green-50 text-green-700' },
                { label: 'Transactions', value: bills.length, color: 'bg-blue-50 text-blue-700' },
                { label: 'Insurance Claims', value: bills.filter(b => b.payment_method === 'insurance').length, color: 'bg-purple-50 text-purple-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-4 ${s.color} border border-current border-opacity-20`}>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-sm font-medium opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Receipt #', 'Date', 'Amount', 'Method', 'Description', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No payment records</td></tr>}
                  {bills.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.receipt_number || b.id?.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-slate-600">{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">GHS {parseFloat(b.amount_paid || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{b.payment_method?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{b.description || b.service_description || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${b.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Visit History */}
        {activeTab === 'Visit History' && !loading && (
          <div className="space-y-3">
            {visits.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
                <p className="text-slate-400 text-sm">No visit history</p>
              </div>
            )}
            {visits.map(v => (
              <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded capitalize">{v.encounter_type?.replace('_', ' ')}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${v.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.status}</span>
                    </div>
                    <p className="font-medium text-slate-900">{v.chief_complaint || 'Visit'}</p>
                    {v.users && <p className="text-xs text-slate-500 mt-0.5">Attended by: {v.users.email}</p>}
                  </div>
                  <p className="text-sm text-slate-500">{v.encounter_date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
