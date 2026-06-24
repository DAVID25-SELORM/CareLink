import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import {
  getLabWorklist,
  collectSample,
  startProcessing,
  enterResults,
  getSampleTimeline,
  getLabTAT,
} from '../services/labSampleService'
import {
  findTest,
  searchTests,
  flagValue,
  flagQualitative,
  formatRange,
} from '../lib/labCatalog'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  pending:    'bg-slate-100 text-slate-700',
  ordered:    'bg-blue-50 text-blue-700',
  collected:  'bg-indigo-100 text-indigo-700',
  processing: 'bg-amber-100 text-amber-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
}

const PRIORITY_COLORS = {
  stat:      'bg-red-100 text-red-700',
  emergency: 'bg-red-100 text-red-700',
  urgent:    'bg-amber-100 text-amber-700',
  routine:   'bg-slate-100 text-slate-600',
}

const SPECIMEN_TYPES = [
  'Whole Blood', 'Serum', 'Plasma', 'Urine', 'Stool',
  'Sputum', 'CSF', 'Swab', 'Tissue', 'Other',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve catalog entries from a test_type string (e.g. "FBC" or "FBC, LFT").
 * Returns an array of catalog entries (may be empty if no match).
 */
function resolveCatalogEntries(testType) {
  if (!testType) return []
  const codes = testType.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
  return codes.map(code => {
    const exact = findTest(code)
    if (exact) return exact
    const results = searchTests(code, 1)
    return results[0] || null
  }).filter(Boolean)
}

/** Compute live flag for one analyte given its value */
function computeFlag(analyte, value) {
  if (value === '' || value == null) return null
  if (analyte.qualitativeRef) return flagQualitative(value, analyte)
  return flagValue(value, analyte)
}

/** Render a flag badge */
function FlagBadge({ flag }) {
  if (!flag) return <span className="text-slate-300 text-xs">—</span>
  const styles = {
    HIGH:     'bg-red-100 text-red-700 border border-red-200',
    LOW:      'bg-orange-100 text-orange-700 border border-orange-200',
    NORMAL:   'bg-green-100 text-green-700 border border-green-200',
    ABNORMAL: 'bg-red-100 text-red-700 border border-red-200',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${styles[flag] || 'bg-slate-100 text-slate-600'}`}>
      {flag}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SampleTracking = () => {
  const { user, userRole } = useAuth()

  // List state
  const [statusFilter, setStatusFilter] = useState('ordered')
  const [worklist, setWorklist]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [tatStats, setTatStats]         = useState(null)

  // Active view: 'worklist' | 'collect' | 'result' | 'timeline'
  const [activeTab, setActiveTab] = useState('worklist')
  const [selectedSample, setSelectedSample] = useState(null)

  // Collection form
  const [collectForm, setCollectForm] = useState({ specimenType: '', collectionNotes: '' })

  // Result entry: per-analyte values keyed by analyte name
  const [analyteValues, setAnalyteValues] = useState({})
  const [resultNotes, setResultNotes]     = useState('')
  const [saving, setSaving]               = useState(false)

  // Timeline
  const [timeline, setTimeline] = useState(null)

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadWorklist()
    loadTAT()
  }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadWorklist() {
    setLoading(true)
    const { data, error } = await getLabWorklist(statusFilter)
    if (error) toast.error('Failed to load worklist')
    else setWorklist(data || [])
    setLoading(false)
  }

  async function loadTAT() {
    const { data } = await getLabTAT(30)
    if (data) setTatStats(data)
  }

  // ─── Catalog resolution (for selected sample) ──────────────────────────────

  const catalogEntries = useMemo(() => {
    if (!selectedSample) return []
    return resolveCatalogEntries(selectedSample.test_type || selectedSample.test_name || '')
  }, [selectedSample])

  // ─── Live flag computation ──────────────────────────────────────────────────

  const { flagMap, abnormalCount, criticalFlags } = useMemo(() => {
    const flagMap = {}
    let abnormalCount = 0
    const criticalFlags = []

    catalogEntries.forEach(entry => {
      entry.analytes.forEach(analyte => {
        const key = `${entry.code}::${analyte.name}`
        const val = analyteValues[key] ?? ''
        const flag = computeFlag(analyte, val)
        flagMap[key] = flag
        if (flag === 'HIGH' || flag === 'LOW' || flag === 'ABNORMAL') {
          abnormalCount++
          if (flag === 'ABNORMAL' || (analyte.refHigh != null && parseFloat(val) > analyte.refHigh * 1.5) ||
              (analyte.refLow != null && parseFloat(val) < analyte.refLow * 0.7)) {
            criticalFlags.push(`${analyte.name}: ${val}${analyte.unit ? ' ' + analyte.unit : ''} (${flag})`)
          }
        }
      })
    })

    return { flagMap, abnormalCount, criticalFlags }
  }, [analyteValues, catalogEntries])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleCollect(sampleId) {
    if (!collectForm.specimenType) { toast.error('Select specimen type'); return }
    const { error } = await collectSample(sampleId, {
      collectedBy: user.id,
      specimenType: collectForm.specimenType,
      collectionNotes: collectForm.collectionNotes,
    })
    if (error) {
      toast.error('Failed to record collection')
    } else {
      toast.success('Sample collected ✓')
      setCollectForm({ specimenType: '', collectionNotes: '' })
      setSelectedSample(null)
      setActiveTab('worklist')
      loadWorklist()
    }
  }

  async function handleStartProcessing(sampleId) {
    const { error } = await startProcessing(sampleId, user.id)
    if (error) toast.error('Failed to start processing')
    else { toast.success('Processing started'); loadWorklist() }
  }

  function openResultEntry(sample) {
    setSelectedSample(sample)
    setAnalyteValues({})
    setResultNotes('')
    setActiveTab('result')
  }

  async function handleSaveResults() {
    // Validate: at least one analyte has a value
    const hasAnyValue = Object.values(analyteValues).some(v => v !== '')
    if (!hasAnyValue && catalogEntries.length > 0) {
      toast.error('Enter at least one analyte value')
      return
    }

    setSaving(true)
    try {
      // Build structured result_details
      const analyteResults = catalogEntries.flatMap(entry =>
        entry.analytes.map(analyte => {
          const key = `${entry.code}::${analyte.name}`
          const value = analyteValues[key] ?? ''
          const flag = flagMap[key] ?? null
          return {
            testCode:  entry.code,
            testName:  entry.name,
            analyte:   analyte.name,
            value:     value,
            unit:      analyte.unit || '',
            refRange:  formatRange(analyte),
            flag:      flag,
          }
        }).filter(r => r.value !== '')
      )

      // Build human-readable summary for result column
      const resultSummary = analyteResults.length > 0
        ? analyteResults
            .map(r => `${r.analyte}: ${r.value}${r.unit ? ' ' + r.unit : ''}${r.flag && r.flag !== 'NORMAL' ? ' [' + r.flag + ']' : ''}`)
            .join(' | ')
        : 'Results entered'

      const resultDetails = {
        analytes: analyteResults,
        notes: resultNotes,
        enteredBy: user?.email || user?.id,
        enteredAt: new Date().toISOString(),
      }

      const isAbnormal = abnormalCount > 0

      const { error } = await enterResults(selectedSample.id, {
        result: resultSummary,
        resultDetails,
        technicianId: user.id,
        isAbnormal,
      })

      if (error) throw error

      // Notify the requesting doctor/user
      if (selectedSample.requested_by) {
        const notifMsg = isAbnormal
          ? `⚠ ABNORMAL result: ${selectedSample.test_type} for ${selectedSample.patients?.name}. ${criticalFlags.length > 0 ? criticalFlags.join(', ') : ''} — please review.`
          : `Lab results ready: ${selectedSample.test_type} for ${selectedSample.patients?.name}.`

        await supabase.from('notifications').insert({
          user_id:    selectedSample.requested_by,
          type:       isAbnormal ? 'lab_critical' : 'lab_result',
          title:      isAbnormal ? '⚠ Abnormal Lab Result' : 'Lab Result Ready',
          message:    notifMsg,
          patient_id: selectedSample.patient_id,
          reference_id: selectedSample.id,
          is_read:    false,
        })
      }

      toast.success(isAbnormal
        ? `Results saved — ⚠ ${abnormalCount} abnormal value(s) flagged. Doctor notified.`
        : 'Results saved and doctor notified ✓'
      )

      setSelectedSample(null)
      setActiveTab('worklist')
      setStatusFilter('processing')
      loadWorklist()
    } catch (err) {
      toast.error('Failed to save results')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleViewTimeline(sampleId) {
    const { data } = await getSampleTimeline(sampleId)
    if (data) {
      setTimeline(data)
      setSelectedSample(sampleId)
      setActiveTab('timeline')
    }
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  function renderWorklist() {
    if (loading) return (
      <div className="p-10 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
      </div>
    )
    if (worklist.length === 0) return (
      <div className="p-10 text-center text-sm text-slate-400">
        No <span className="font-medium">{statusFilter}</span> samples in the queue
      </div>
    )
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Accession #</th>
              <th className="text-left px-4 py-3">Patient</th>
              <th className="text-left px-4 py-3">Test Requested</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Ordered</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {worklist.map(sample => (
              <tr
                key={sample.id}
                className={`hover:bg-slate-50 transition-colors ${
                  sample.priority === 'stat' || sample.priority === 'emergency' ? 'bg-red-50/40' : ''
                }`}
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {sample.accession_number || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{sample.patients?.name || '—'}</div>
                  <div className="text-xs text-slate-400">
                    {sample.patients?.patient_id} · {sample.patients?.gender} · {sample.patients?.age}y
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-800">{sample.test_type || sample.test_name}</div>
                  {sample.clinical_notes && (
                    <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{sample.clinical_notes}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                    PRIORITY_COLORS[sample.priority] || PRIORITY_COLORS.routine
                  }`}>
                    {sample.priority || 'routine'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                    STATUS_COLORS[sample.status] || STATUS_COLORS.pending
                  }`}>
                    {sample.status}
                  </span>
                  {sample.is_abnormal && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-bold">⚠ ABN</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(sample.created_at).toLocaleString([], {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {/* Step 1: Collect */}
                    {(sample.status === 'ordered' || sample.status === 'pending') &&
                     (userRole === 'lab_tech' || userRole === 'admin' || userRole === 'nurse') && (
                      <button
                        type="button"
                        onClick={() => { setSelectedSample(sample); setActiveTab('collect') }}
                        className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium"
                      >
                        Collect
                      </button>
                    )}
                    {/* Step 2: Process */}
                    {sample.status === 'collected' &&
                     (userRole === 'lab_tech' || userRole === 'admin') && (
                      <button
                        type="button"
                        onClick={() => handleStartProcessing(sample.id)}
                        className="px-2.5 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 font-medium"
                      >
                        Process
                      </button>
                    )}
                    {/* Step 3: Enter Result */}
                    {sample.status === 'processing' &&
                     (userRole === 'lab_tech' || userRole === 'admin') && (
                      <button
                        type="button"
                        onClick={() => openResultEntry(sample)}
                        className="px-2.5 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium"
                      >
                        Enter Results
                      </button>
                    )}
                    {/* View results (completed) */}
                    {sample.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleViewTimeline(sample.id)}
                        className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 font-medium"
                      >
                        View
                      </button>
                    )}
                    {/* Track (any status) */}
                    {sample.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleViewTimeline(sample.id)}
                        className="px-2.5 py-1 text-xs bg-slate-100 text-slate-500 rounded hover:bg-slate-200"
                      >
                        Track
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderCollectionForm() {
    if (!selectedSample) return null
    return (
      <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 max-w-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">Specimen Collection</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {selectedSample.patients?.name} · {selectedSample.test_type}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
            PRIORITY_COLORS[selectedSample.priority] || PRIORITY_COLORS.routine
          }`}>
            {selectedSample.priority || 'routine'}
          </span>
        </div>

        {selectedSample.clinical_notes && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <span className="font-medium">Clinical notes: </span>{selectedSample.clinical_notes}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Specimen Type <span className="text-red-500">*</span></label>
            <select
              value={collectForm.specimenType}
              onChange={e => setCollectForm(p => ({ ...p, specimenType: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select specimen type…</option>
              {SPECIMEN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Collection Notes</label>
            <textarea
              value={collectForm.collectionNotes}
              onChange={e => setCollectForm(p => ({ ...p, collectionNotes: e.target.value }))}
              rows={2}
              placeholder="e.g., fasting sample, difficult venipuncture, haemolysed…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleCollect(selectedSample.id)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
            >
              Confirm Collection
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('worklist'); setSelectedSample(null) }}
              className="px-4 py-2 text-slate-600 text-sm rounded-lg hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderResultEntry() {
    if (!selectedSample) return null

    // Determine if we have catalog entries or need freetext fallback
    const hasCatalog = catalogEntries.length > 0

    return (
      <div className="bg-white rounded-xl shadow-sm border border-green-100 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800 text-base">Enter Lab Results</h3>
            <div className="text-sm text-slate-500 mt-0.5">
              <span className="font-medium text-slate-700">{selectedSample.patients?.name}</span>
              {selectedSample.patients?.gender && ` · ${selectedSample.patients.gender}`}
              {selectedSample.patients?.age && ` · ${selectedSample.patients.age}y`}
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="font-mono text-xs text-slate-500">{selectedSample.accession_number || 'No accession'}</div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
              PRIORITY_COLORS[selectedSample.priority] || PRIORITY_COLORS.routine
            }`}>
              {selectedSample.priority || 'routine'}
            </span>
          </div>
        </div>

        {/* Test + specimen info */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4 text-xs text-slate-600">
          <span><span className="font-medium">Test:</span> {selectedSample.test_type || selectedSample.test_name}</span>
          {selectedSample.specimen_type && (
            <span><span className="font-medium">Specimen:</span> {selectedSample.specimen_type}</span>
          )}
          {selectedSample.collected_at && (
            <span><span className="font-medium">Collected:</span> {new Date(selectedSample.collected_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
          )}
        </div>

        {/* Clinical notes from doctor */}
        {selectedSample.clinical_notes && (
          <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100">
            <span className="text-xs font-medium text-blue-700">Doctor&apos;s notes: </span>
            <span className="text-xs text-blue-800">{selectedSample.clinical_notes}</span>
          </div>
        )}

        <div className="p-5 space-y-6">
          {/* ── Catalog-based analyte entry ─────────────────────────── */}
          {hasCatalog ? (
            catalogEntries.map(entry => (
              <div key={entry.code}>
                {/* Test section header */}
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-slate-700">{entry.name}</h4>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">{entry.code}</span>
                  <span className="text-xs text-slate-400">TAT {entry.turnaroundHrs}h</span>
                </div>

                {/* Analyte table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500">
                        <th className="text-left px-3 py-2 font-medium">Analyte</th>
                        <th className="text-left px-3 py-2 font-medium w-36">Value</th>
                        <th className="text-left px-3 py-2 font-medium w-24">Unit</th>
                        <th className="text-left px-3 py-2 font-medium">Reference Range</th>
                        <th className="text-center px-3 py-2 font-medium w-20">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entry.analytes.map(analyte => {
                        const key   = `${entry.code}::${analyte.name}`
                        const val   = analyteValues[key] ?? ''
                        const flag  = flagMap[key]
                        const isAbn = flag === 'HIGH' || flag === 'LOW' || flag === 'ABNORMAL'

                        return (
                          <tr
                            key={key}
                            className={isAbn ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}
                          >
                            <td className="px-3 py-2.5 font-medium text-slate-700">{analyte.name}</td>
                            <td className="px-3 py-2.5">
                              {analyte.qualitativeRef ? (
                                /* Qualitative — dropdown */
                                <select
                                  value={val}
                                  onChange={e => setAnalyteValues(p => ({ ...p, [key]: e.target.value }))}
                                  className={`w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                    isAbn ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                  }`}
                                >
                                  <option value="">—</option>
                                  <option value={analyte.qualitativeRef}>{analyte.qualitativeRef}</option>
                                  {/* Common alternatives per test type */}
                                  {getQualitativeOptions(entry.code, analyte.name, analyte.qualitativeRef).map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                /* Quantitative — number input */
                                <input
                                  type="number"
                                  step="any"
                                  value={val}
                                  onChange={e => setAnalyteValues(p => ({ ...p, [key]: e.target.value }))}
                                  placeholder="—"
                                  className={`w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                    isAbn ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                  }`}
                                />
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{analyte.unit || '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{formatRange(analyte)}</td>
                            <td className="px-3 py-2.5 text-center">
                              <FlagBadge flag={flag} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Note for this test (from catalog) */}
                {entry.note && (
                  <p className="mt-1.5 text-xs text-slate-400 italic">{entry.note}</p>
                )}
              </div>
            ))
          ) : (
            /* ── Fallback: free text for unknown tests ─────────────── */
            <div>
              <p className="text-xs text-slate-500 mb-3">
                No catalog entry found for <span className="font-medium">{selectedSample.test_type}</span>.
                Enter result manually.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Result</label>
                <textarea
                  value={analyteValues['__freetext__'] ?? ''}
                  onChange={e => setAnalyteValues({ '__freetext__': e.target.value })}
                  rows={3}
                  placeholder="Enter result value or description…"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Abnormal summary bar ──────────────────────────────── */}
          {abnormalCount > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-1">
                <span>⚠</span>
                <span>{abnormalCount} abnormal value{abnormalCount > 1 ? 's' : ''} flagged</span>
              </div>
              {criticalFlags.length > 0 && (
                <div className="text-xs text-red-600 space-y-0.5">
                  {criticalFlags.map((f, i) => <div key={i}>• {f}</div>)}
                </div>
              )}
              <p className="text-xs text-red-500 mt-1">Doctor will be notified automatically.</p>
            </div>
          )}

          {/* ── Notes ────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Lab Notes / Comments</label>
            <textarea
              value={resultNotes}
              onChange={e => setResultNotes(e.target.value)}
              rows={2}
              placeholder="Any additional observations, quality issues, repeat recommended…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* ── Actions ──────────────────────────────────────────── */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveResults}
              disabled={saving}
              className={`px-5 py-2 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${
                abnormalCount > 0
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {saving ? 'Saving…' : abnormalCount > 0 ? '⚠ Save & Notify Doctor' : 'Save Results & Notify Doctor'}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('worklist'); setSelectedSample(null) }}
              className="px-4 py-2 text-slate-600 text-sm rounded-lg hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderTimeline() {
    if (!timeline) return null
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Sample Timeline</h3>
          <button
            type="button"
            onClick={() => { setActiveTab('worklist'); setTimeline(null) }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            ← Back
          </button>
        </div>
        <div className="text-xs text-slate-500 mb-4 space-y-0.5">
          <div>Accession: <span className="font-mono">{timeline.accession_number || 'N/A'}</span></div>
          <div>Test: <span className="font-medium">{timeline.test_type}</span></div>
          {timeline.is_abnormal && (
            <div className="text-red-600 font-medium">⚠ Abnormal result</div>
          )}
        </div>

        {/* Structured analyte results (if available) */}
        {timeline.result_details?.analytes?.length > 0 && (
          <div className="mb-5 border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Results</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/60 text-slate-400 border-t border-slate-100">
                  <th className="text-left px-3 py-1.5">Analyte</th>
                  <th className="text-left px-3 py-1.5">Value</th>
                  <th className="text-left px-3 py-1.5">Ref Range</th>
                  <th className="text-center px-3 py-1.5">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.result_details.analytes.map((a, i) => (
                  <tr key={i} className={a.flag && a.flag !== 'NORMAL' ? 'bg-red-50/40' : ''}>
                    <td className="px-3 py-1.5 font-medium text-slate-700">{a.analyte}</td>
                    <td className="px-3 py-1.5">{a.value} <span className="text-slate-400">{a.unit}</span></td>
                    <td className="px-3 py-1.5 text-slate-400">{a.refRange}</td>
                    <td className="px-3 py-1.5 text-center"><FlagBadge flag={a.flag} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {timeline.result_details.notes && (
              <div className="px-3 py-2 border-t border-slate-100 text-xs text-slate-500">
                <span className="font-medium">Notes: </span>{timeline.result_details.notes}
              </div>
            )}
          </div>
        )}

        {/* Legacy plain-text result */}
        {timeline.result && !timeline.result_details?.analytes?.length && (
          <div className="mb-5 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
            {timeline.result}
          </div>
        )}

        {/* Step timeline */}
        <div className="relative pl-6 space-y-4">
          {timeline.timeline.map((step, i) => (
            <div key={step.step} className="relative">
              {i < timeline.timeline.length - 1 && (
                <div className={`absolute left-[-18px] top-6 w-0.5 h-full ${
                  step.completed ? 'bg-green-300' : 'bg-slate-200'
                }`} />
              )}
              <div className={`absolute left-[-22px] top-1 w-3 h-3 rounded-full border-2 ${
                step.completed ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300'
              }`} />
              <div>
                <div className={`text-sm font-medium ${step.completed ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step.label}
                </div>
                {step.timestamp && (
                  <div className="text-xs text-slate-500">{new Date(step.timestamp).toLocaleString()}</div>
                )}
                {step.details && (
                  <div className="text-xs text-slate-600 mt-0.5">{step.details}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Page header */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Lab Sample Tracking</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Specimen collection → processing → result entry
            </p>
          </div>
          {tatStats && (
            <div className="bg-white rounded-lg border border-slate-200 px-4 py-2 text-center min-w-[120px]">
              <div className="text-xs text-slate-500">Avg Turnaround</div>
              <div className="text-sm font-bold text-blue-700">{tatStats.avgTATFormatted}</div>
              <div className="text-xs text-slate-400">{tatStats.totalCompleted} tests / 30d</div>
            </div>
          )}
        </div>

        {/* Status filter tabs */}
        {activeTab === 'worklist' && (
          <div className="flex flex-wrap gap-2">
            {['pending', 'ordered', 'collected', 'processing', 'completed'].map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            ))}
            <button
              type="button"
              onClick={loadWorklist}
              className="px-3 py-2 rounded-lg text-sm text-slate-500 border border-slate-200 bg-white hover:bg-slate-50"
              title="Refresh"
            >
              ↺
            </button>
          </div>
        )}

        {/* Active view */}
        <div>
          {activeTab === 'worklist'  && renderWorklist()}
          {activeTab === 'collect'   && renderCollectionForm()}
          {activeTab === 'result'    && renderResultEntry()}
          {activeTab === 'timeline'  && renderTimeline()}
        </div>
      </div>
    </DashboardLayout>
  )
}

// ─── Qualitative option helpers ───────────────────────────────────────────────
// Provides appropriate dropdown choices for qualitative analytes per test type.
// The "normal" option is already rendered from analyte.qualitativeRef.

function getQualitativeOptions(testCode, analyteName, normalRef) {
  const name = analyteName.toLowerCase()
  const tc   = testCode.toUpperCase()

  // Malaria tests
  if (tc === 'MPRDT' || tc === 'BF') {
    if (name.includes('parasite') || name.includes('falciparum') || name.includes('pan')) {
      return ['Positive', '+', '++', '+++']
    }
  }
  // Widal
  if (tc === 'WIDAL') return ['<1:80', '1:80', '1:160', '1:320', '1:640']
  // HIV / HBsAg / Syphilis serology
  if (tc === 'HIV' || tc === 'HBSAG' || tc === 'VDRL') return ['Reactive', 'Weakly Reactive', 'Non-reactive']
  // Sickling
  if (tc === 'SICK') return ['Positive (HbSS)', 'Positive (HbAS)', 'Negative']
  // G6PD qualitative
  if (tc === 'G6PD' && name.includes('qualitative')) return ['Normal', 'Deficient', 'Intermediate']
  // Pregnancy
  if (tc === 'PREG') return ['Positive', 'Negative']
  // AFB
  if (tc === 'AFB') return ['No AFB seen', 'Scanty (1–9/100 fields)', '1+ (10–99/100 fields)', '2+ (1–10/field)', '3+ (>10/field)']
  // Urinalysis qualitative
  if (tc === 'URINE') {
    if (name === 'protein') return ['Negative', 'Trace', '+', '++', '+++']
    if (name === 'glucose') return ['Negative', 'Trace', '+', '++', '+++']
    if (name === 'blood') return ['Negative', 'Trace', '+', '++', '+++']
    if (name === 'leukocytes') return ['Negative', '+', '++', '+++']
    if (name === 'nitrites') return ['Negative', 'Positive']
  }
  return []
}

export default SampleTracking
