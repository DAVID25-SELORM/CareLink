import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../hooks/useOrg'
import { findActiveEncounterCcCode, getCcCodeExpiry } from '../services/nhisCcCodeService'
import { lookupNhisMemberViaHealthFlow, pingHealthFlow } from '../services/healthflowService'

const VERIFICATION_METHODS = ['manual', 'healthflow', 'api', 'card_swipe']
const METHOD_LABELS = {
  manual: 'Manual Entry',
  healthflow: 'HealthFlow POS',
  api: 'NHIA API',
  card_swipe: 'Card Swipe',
}

const TABS = ['Generate CC Code', 'Today\'s Codes', 'History']

function generateLocalCcCode(memberNumber) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  const prefix = memberNumber?.slice(-4) || '0000'
  return `CC${yy}${mm}${dd}${prefix}${rand}`
}

export default function NhisCcCode() {
  const { user } = useAuth()
  const { orgId } = useOrg()

  const [activeTab, setActiveTab] = useState('Generate CC Code')
  const [patients, setPatients] = useState([])
  const [encounters, setEncounters] = useState([])
  const [todayCodes, setTodayCodes] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchPatient, setSearchPatient] = useState('')
  const [historySearch, setHistorySearch] = useState('')

  const [form, setForm] = useState({
    patient_id: '',
    encounter_id: '',
    nhis_member_number: '',
    cc_code: '',
    verification_method: 'manual',
  })
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [generatedCode, setGeneratedCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [hfMember, setHfMember] = useState(null)   // HealthFlow member lookup result
  const [hfOnline, setHfOnline] = useState(null)   // null=unknown, true, false

  useEffect(() => {
    fetchPatients()
    fetchTodayCodes()
    fetchHistory()
  }, [orgId])

  useEffect(() => {
    if (form.patient_id) {
      fetchPatientEncounters(form.patient_id)
      const p = patients.find(x => x.id === form.patient_id)
      setSelectedPatient(p || null)
      setHfMember(null)
      if (p?.nhis_number) setForm(prev => ({ ...prev, nhis_member_number: p.nhis_number }))
    }
  }, [form.patient_id])

  const fetchPatients = async () => {
    const { data } = await supabase
      .from('patients')
      .select('id, name, patient_id, nhis_number, phone, date_of_birth, insurance_type, insurance_name')
      .order('name')
    setPatients(data || [])
    setLoading(false)
  }

  const fetchPatientEncounters = async (patientId) => {
    const { data } = await supabase
      .from('encounters')
      .select('id, encounter_type, status, chief_complaint, created_at, nhis_cc_code, nhis_member_number')
      .eq('patient_id', patientId)
      .in('status', ['registered', 'in_progress', 'triaged'])
      .order('created_at', { ascending: false })
      .limit(10)
    setEncounters(data || [])
  }

  const fetchTodayCodes = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('nhis_cc_codes')
      .select(`
        *,
        patients:patient_id (name, patient_id),
        users:generated_by (full_name)
      `)
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
    setTodayCodes(data || [])
  }

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('nhis_cc_codes')
      .select(`
        *,
        patients:patient_id (name, patient_id, nhis_number),
        users:generated_by (full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    setHistory(data || [])
  }

  // Check HealthFlow reachability on mount
  useEffect(() => {
    pingHealthFlow().then(r => setHfOnline(r.reachable))
  }, [])

  const handleVerifyWithHealthFlow = async () => {
    if (!form.nhis_member_number.trim()) {
      toast.error('Enter the NHIS member number first')
      return
    }
    setVerifying(true)
    setHfMember(null)
    try {
      const result = await lookupNhisMemberViaHealthFlow(form.nhis_member_number.trim())
      if (!result.success) {
        toast.error(result.message || 'HealthFlow verification failed')
        if (result.localOnly) setHfOnline(false)
        return
      }
      setHfMember(result)
      setHfOnline(true)

      // Auto-fill CC code if HealthFlow returned one
      if (result.ccCode) {
        setForm(prev => ({ ...prev, cc_code: result.ccCode, verification_method: 'healthflow' }))
        setGeneratedCode(result.ccCode)
        toast.success(`CC Code received from HealthFlow: ${result.ccCode}`)
      } else {
        // Member verified but no CC code yet — generate locally and mark as healthflow-verified
        const code = generateLocalCcCode(form.nhis_member_number)
        setForm(prev => ({ ...prev, cc_code: code, verification_method: 'healthflow' }))
        setGeneratedCode(code)
        toast.success(`Member verified. CC Code generated: ${code}`)
      }
    } catch (err) {
      toast.error('HealthFlow error: ' + err.message)
    } finally {
      setVerifying(false)
    }
  }

  const handleGenerate = () => {
    if (!form.nhis_member_number.trim()) {
      toast.error('Enter the NHIS member number first')
      return
    }
    const code = generateLocalCcCode(form.nhis_member_number)
    setGeneratedCode(code)
    setForm(prev => ({ ...prev, cc_code: code }))
    toast.success('CC Code generated — review and save')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.patient_id) return toast.error('Select a patient')
    if (!form.nhis_member_number.trim()) return toast.error('NHIS member number is required')
    if (!form.cc_code.trim()) return toast.error('Generate or enter a CC Code first')

    setSaving(true)
    try {
      const normalizedCode = form.cc_code.trim().toUpperCase()
      const verified = form.verification_method !== 'manual'
      let existingCode = null

      if (form.encounter_id) {
        existingCode = await findActiveEncounterCcCode(form.encounter_id)
        if (existingCode && existingCode.cc_code !== normalizedCode) {
          toast.error(`This encounter already has active CC Code ${existingCode.cc_code}`)
          setSaving(false)
          return
        }
      }

      // 1. Save CC code record
      if (!existingCode) {
        const { error: ccErr } = await supabase.from('nhis_cc_codes').insert({
          patient_id: form.patient_id,
          encounter_id: form.encounter_id || null,
          cc_code: normalizedCode,
          nhis_member_number: form.nhis_member_number.trim(),
          patient_name: selectedPatient?.name,
          verification_method: form.verification_method,
          verified,
          verified_at: verified ? new Date().toISOString() : null,
          status: 'active',
          expires_at: getCcCodeExpiry(),
          source_page: 'nhis_cc_code',
          user_agent: navigator.userAgent,
          generated_by: user.id,
          hospital_id: orgId,
        })
        if (ccErr) throw ccErr
      }

      // 2. Stamp the CC code onto the encounter if one is selected
      if (form.encounter_id) {
        await supabase
          .from('encounters')
          .update({
            nhis_cc_code: normalizedCode,
            nhis_member_number: form.nhis_member_number.trim(),
            nhis_verified: verified,
            nhis_verified_at: verified ? new Date().toISOString() : null,
            insurance_type: 'nhis',
          })
          .eq('id', form.encounter_id)
      }

      toast.success(`CC Code ${normalizedCode} saved successfully`)
      setForm({ patient_id: '', encounter_id: '', nhis_member_number: '', cc_code: '', verification_method: 'manual' })
      setSelectedPatient(null)
      setGeneratedCode('')
      setEncounters([])
      fetchTodayCodes()
      fetchHistory()
    } catch (err) {
      console.error(err)
      toast.error('Failed to save CC Code')
    } finally {
      setSaving(false)
    }
  }

  const filteredPatients = patients
    .filter(p =>
      !searchPatient ||
      p.name?.toLowerCase().includes(searchPatient.toLowerCase()) ||
      p.patient_id?.toLowerCase().includes(searchPatient.toLowerCase()) ||
      p.nhis_number?.toLowerCase().includes(searchPatient.toLowerCase())
    )
    .sort((a, b) => Number(Boolean(b.nhis_number || b.insurance_type === 'nhis')) - Number(Boolean(a.nhis_number || a.insurance_type === 'nhis')))

  const selectedEncounter = encounters.find((enc) => enc.id === form.encounter_id)

  const filteredHistory = history.filter(h =>
    !historySearch ||
    h.patients?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.cc_code?.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.nhis_member_number?.toLowerCase().includes(historySearch.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">NHIS CC Code</h1>
            <p className="text-slate-500 text-sm mt-1">Generate and track Continuation of Care codes for NHIS patients</p>
          </div>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-green-700">{todayCodes.length} codes today</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="flex border-b border-slate-100">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ── TAB 1: Generate ── */}
            {activeTab === 'Generate CC Code' && (
              <div className="max-w-2xl">
                <form onSubmit={handleSave} className="space-y-5">

                  {/* Patient Search & Select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
                    <input
                      type="text"
                      placeholder="Search by name, folder number or NHIS number..."
                      value={searchPatient}
                      onChange={e => setSearchPatient(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    />
                    <select
                      required
                      value={form.patient_id}
                      onChange={e => setForm(prev => ({ ...prev, patient_id: e.target.value, encounter_id: '' }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select patient --</option>
                      {filteredPatients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.patient_id}{p.nhis_number ? ` · NHIS: ${p.nhis_number}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Patient Info Banner */}
                  {selectedPatient && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs">Name</p>
                        <p className="font-semibold text-slate-800">{selectedPatient.name}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Folder No.</p>
                        <p className="font-semibold text-slate-800">{selectedPatient.patient_id}</p>
                      </div>
                      {selectedPatient.nhis_number && (
                        <div>
                          <p className="text-slate-500 text-xs">NHIS No.</p>
                          <p className="font-semibold text-green-700">{selectedPatient.nhis_number}</p>
                        </div>
                      )}
                      {selectedPatient.phone && (
                        <div>
                          <p className="text-slate-500 text-xs">Phone</p>
                          <p className="font-semibold text-slate-800">{selectedPatient.phone}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Link to Encounter (optional) */}
                  {encounters.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Link to Active Encounter</label>
                      <select
                        value={form.encounter_id}
                        onChange={e => setForm(prev => ({ ...prev, encounter_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Not linked to an encounter --</option>
                        {encounters.map(enc => (
                          <option key={enc.id} value={enc.id}>
                            {enc.encounter_type.toUpperCase()} · {enc.chief_complaint || 'No complaint recorded'} ·{' '}
                            {new Date(enc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {enc.nhis_cc_code ? ` · Already has CC: ${enc.nhis_cc_code}` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedEncounter?.nhis_cc_code && (
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                          This encounter already has active CC Code {selectedEncounter.nhis_cc_code}. Reuse it for claims unless it must be corrected by an admin.
                        </p>
                      )}
                    </div>
                  )}

                  {/* HealthFlow Status Banner */}
                  <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm border ${
                    hfOnline === true  ? 'bg-green-50 border-green-200 text-green-800' :
                    hfOnline === false ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      hfOnline === true ? 'bg-green-500' :
                      hfOnline === false ? 'bg-amber-500' :
                      'bg-slate-400'
                    }`} />
                    <span className="font-medium">HealthFlow CLAIM-it:</span>
                    <span>
                      {hfOnline === true  ? 'Connected — verification will use live NHIA API' :
                       hfOnline === false ? 'Offline or not configured — manual entry only' :
                       'Checking connection...'}
                    </span>
                    {hfOnline === false && (
                      <a href="/settings" className="ml-auto text-xs font-medium underline whitespace-nowrap">
                        Configure →
                      </a>
                    )}
                  </div>

                  {/* NHIS Member Number */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NHIS Member Number *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="e.g. P/NHF/12345/25"
                        value={form.nhis_member_number}
                        onChange={e => {
                          setForm(prev => ({ ...prev, nhis_member_number: e.target.value }))
                          setHfMember(null)
                        }}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyWithHealthFlow}
                        disabled={verifying || !form.nhis_member_number.trim()}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 ${
                          hfOnline === false
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        title={hfOnline === false ? 'HealthFlow not connected' : 'Verify via HealthFlow CLAIM-it'}
                      >
                        {verifying ? 'Verifying...' : '✓ Verify via HealthFlow'}
                      </button>
                    </div>
                  </div>

                  {/* HealthFlow Member Details */}
                  {hfMember && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-600 font-bold text-sm">✓ Member Verified via HealthFlow</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        {hfMember.memberName && (
                          <div>
                            <p className="text-xs text-slate-500">Member Name</p>
                            <p className="font-semibold text-slate-800">{hfMember.memberName}</p>
                          </div>
                        )}
                        {hfMember.memberNumber && (
                          <div>
                            <p className="text-xs text-slate-500">Member No.</p>
                            <p className="font-semibold font-mono text-slate-800">{hfMember.memberNumber}</p>
                          </div>
                        )}
                        {hfMember.schemeCode && (
                          <div>
                            <p className="text-xs text-slate-500">Scheme</p>
                            <p className="font-semibold text-slate-800">{hfMember.schemeCode}</p>
                          </div>
                        )}
                        {hfMember.expiryDate && (
                          <div>
                            <p className="text-xs text-slate-500">Card Expiry</p>
                            <p className={`font-semibold ${new Date(hfMember.expiryDate) < new Date() ? 'text-red-600' : 'text-slate-800'}`}>
                              {hfMember.expiryDate}
                            </p>
                          </div>
                        )}
                        {hfMember.status && (
                          <div>
                            <p className="text-xs text-slate-500">Status</p>
                            <p className={`font-semibold ${hfMember.status === 'active' ? 'text-green-700' : 'text-red-600'}`}>
                              {hfMember.status}
                            </p>
                          </div>
                        )}
                        {hfMember.ccCode && (
                          <div>
                            <p className="text-xs text-slate-500">CC Code (from API)</p>
                            <p className="font-bold font-mono text-green-700 text-base">{hfMember.ccCode}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Verification Method */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Verification Method</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {VERIFICATION_METHODS.map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, verification_method: method }))}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                            form.verification_method === method
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {METHOD_LABELS[method]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CC Code Input + Generate */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">CC Code *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Enter or generate CC Code"
                        value={form.cc_code}
                        onChange={e => setForm(prev => ({ ...prev, cc_code: e.target.value.toUpperCase() }))}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        Generate Locally
                      </button>
                    </div>
                    {generatedCode && (
                      <p className="text-xs text-slate-500 mt-1">
                        {form.verification_method === 'healthflow'
                          ? <span>From HealthFlow: <span className="font-mono font-semibold text-green-700">{generatedCode}</span></span>
                          : <span>Generated locally: <span className="font-mono font-semibold text-slate-700">{generatedCode}</span> — replace with NHIA-issued code if available</span>
                        }
                      </p>
                    )}
                  </div>

                  {/* CC Code Preview */}
                  {form.cc_code && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-500 mb-1">CC Code for this visit</p>
                      <p className="text-3xl font-bold font-mono tracking-widest text-green-700">{form.cc_code}</p>
                      {selectedPatient && (
                        <p className="text-sm text-slate-600 mt-1">{selectedPatient.name} · {form.nhis_member_number}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save CC Code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ patient_id: '', encounter_id: '', nhis_member_number: '', cc_code: '', verification_method: 'manual' })
                        setSelectedPatient(null)
                        setGeneratedCode('')
                        setEncounters([])
                        setSearchPatient('')
                      }}
                      className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── TAB 2: Today's Codes ── */}
            {activeTab === "Today's Codes" && (
              <div>
                {todayCodes.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <div className="text-5xl mb-3">🏥</div>
                    <p className="font-medium">No CC Codes generated today</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                          <th className="px-4 py-3 text-left">Time</th>
                          <th className="px-4 py-3 text-left">Patient</th>
                          <th className="px-4 py-3 text-left">NHIS No.</th>
                          <th className="px-4 py-3 text-left">CC Code</th>
                          <th className="px-4 py-3 text-left">Method</th>
                          <th className="px-4 py-3 text-left">By</th>
                          <th className="px-4 py-3 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {todayCodes.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{row.patients?.name}</p>
                              <p className="text-xs text-slate-400">{row.patients?.patient_id}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">{row.nhis_member_number}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                                {row.cc_code}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{METHOD_LABELS[row.verification_method]}</td>
                            <td className="px-4 py-3 text-slate-500">{row.users?.full_name}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                row.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {row.verified ? 'Verified' : 'Manual'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: History ── */}
            {activeTab === 'History' && (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Search by patient name, CC Code or NHIS number..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="w-full sm:w-96 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <p>No records found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Patient</th>
                          <th className="px-4 py-3 text-left">NHIS No.</th>
                          <th className="px-4 py-3 text-left">CC Code</th>
                          <th className="px-4 py-3 text-left">Method</th>
                          <th className="px-4 py-3 text-left">Generated By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredHistory.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {new Date(row.created_at).toLocaleDateString()} {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{row.patients?.name}</p>
                              <p className="text-xs text-slate-400">{row.patients?.patient_id}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">{row.nhis_member_number}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                                {row.cc_code}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{METHOD_LABELS[row.verification_method]}</td>
                            <td className="px-4 py-3 text-slate-500">{row.users?.full_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
