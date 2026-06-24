import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../layouts/DashboardLayout'
import { generateDHIMS2Report, exportDHIMS2CSV, markReportSubmitted } from '../services/dhims2Bridge'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DHIMS2Reports = () => {
  const { user } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // previous month by default
  const [report, setReport] = useState(null)
  const [savedReport, setSavedReport] = useState(null)
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await generateDHIMS2Report(year, month + 1, user.id)
      if (result.error) {
        toast.error('Failed to generate report')
        return
      }
      setReport(result.report)
      setSavedReport(result.saved)
      toast.success('DHIMS2 report generated')
    } catch (error) {
      toast.error('Error generating report')
      console.error(error)
    } finally {
      setGenerating(false)
    }
  }

  const handleExportCSV = () => {
    if (!report) return
    const csv = exportDHIMS2CSV(report)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DHIMS2_${year}_${String(month + 1).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const handleMarkSubmitted = async () => {
    if (!savedReport?.id) return
    const { error } = await markReportSubmitted(savedReport.id, user.id)
    if (error) {
      toast.error('Failed to mark as submitted')
    } else {
      setSavedReport(prev => ({ ...prev, status: 'submitted' }))
      toast.success('Marked as submitted to DHIMS2')
    }
  }

  const getRiskColor = (status) => {
    if (status === 'error') return 'text-red-600 bg-red-50'
    return 'text-slate-800'
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">DHIMS2 Report Bridge</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Auto-generate monthly DHIMS2 indicators from CareLink data
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Report Output */}
        {report && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">
                  DHIMS2 Monthly Report — {MONTHS[month]} {year}
                </h3>
                {savedReport && (
                  <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                    savedReport.status === 'submitted'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {savedReport.status === 'submitted' ? '✓ Submitted' : 'Draft'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  Export CSV
                </button>
                {savedReport?.status !== 'submitted' && (
                  <button
                    type="button"
                    onClick={handleMarkSubmitted}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Mark as Submitted
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {Object.entries(report.indicators).map(([key, ind]) => (
                <div key={key} className={`px-4 py-3 flex items-center justify-between ${getRiskColor(ind.status)}`}>
                  <div>
                    <div className="text-sm font-medium">{ind.name}</div>
                    <div className="text-xs text-slate-500">{key}</div>
                  </div>
                  <div className="text-right">
                    {key === 'TOP10_OPD_MORBIDITIES' ? (
                      <div className="text-xs text-right">
                        {Array.isArray(ind.value) && ind.value.length > 0 ? (
                          ind.value.slice(0, 5).map((item, i) => (
                            <div key={i} className="text-slate-600">
                              {item.icd10_code}: {item.count}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400">No data</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-lg font-bold">{ind.value ?? '—'}</span>
                    )}
                    {ind.status === 'error' && (
                      <div className="text-xs text-red-500">{ind.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Card */}
        {!report && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="text-sm font-semibold text-blue-800 mb-1">Automated DHIMS2 Reporting</h3>
            <p className="text-xs text-blue-600 max-w-md mx-auto">
              Select a reporting period and generate indicators automatically from CareLink data.
              Export as CSV to upload directly to the DHIMS2 portal — no double data entry.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default DHIMS2Reports
