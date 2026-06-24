import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getPatientMAR, updateMARStatus } from '../services/nursingService'

const TIME_SLOTS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00']

const STATUS_STYLES = {
  given: 'bg-green-500 text-white',
  held: 'bg-amber-400 text-white',
  refused: 'bg-red-500 text-white',
  missed: 'bg-slate-300 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700 border border-blue-200',
}

const STATUS_ICONS = {
  given: '✓',
  held: 'H',
  refused: 'R',
  missed: '—',
  scheduled: '·',
}

const MARGrid = ({ patientId, nurseId }) => {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [activeCell, setActiveCell] = useState(null)

  useEffect(() => {
    fetchMAR()
  }, [patientId, date])

  const fetchMAR = async () => {
    setLoading(true)
    try {
      const { data, error } = await getPatientMAR(patientId, { date })
      if (error) throw error
      setRecords(data || [])
    } catch (error) {
      console.error('Error fetching MAR:', error)
      toast.error('Failed to load MAR')
    } finally {
      setLoading(false)
    }
  }

  // Group records by drug for the grid
  const drugGroups = records.reduce((acc, rec) => {
    const key = `${rec.drug_name}-${rec.dose}-${rec.dose_unit}-${rec.route}`
    if (!acc[key]) {
      acc[key] = {
        drug_name: rec.drug_name,
        dose: rec.dose,
        dose_unit: rec.dose_unit,
        route: rec.route,
        frequency: rec.frequency,
        records: [],
      }
    }
    acc[key].records.push(rec)
    return acc
  }, {})

  const getRecordForSlot = (group, slot) => {
    return group.records.find(r => {
      const time = new Date(r.scheduled_time).toTimeString().slice(0, 5)
      return time === slot
    })
  }

  const handleStatusChange = async (recordId, newStatus) => {
    try {
      const { error } = await updateMARStatus(recordId, newStatus)
      if (error) throw error
      setRecords(prev => prev.map(r =>
        r.id === recordId ? { ...r, status: newStatus, administered_time: newStatus === 'given' ? new Date().toISOString() : null } : r
      ))
      setActiveCell(null)
      toast.success(`Medication marked as ${newStatus}`)
    } catch (error) {
      toast.error('Failed to update MAR')
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">Loading MAR...</div>
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Medication Administration Record</h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {Object.keys(drugGroups).length === 0 ? (
        <div className="text-sm text-slate-400 py-8 text-center bg-slate-50 rounded-lg">
          No medications scheduled for this date
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-3 py-2 border-r border-slate-200 min-w-[200px]">Medication</th>
                {TIME_SLOTS.map(slot => (
                  <th key={slot} className="px-2 py-2 text-center border-r border-slate-200 min-w-[50px]">
                    {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(drugGroups).map(([key, group]) => (
                <tr key={key} className="border-t border-slate-200">
                  <td className="px-3 py-2 border-r border-slate-200">
                    <div className="font-medium text-slate-800">{group.drug_name}</div>
                    <div className="text-slate-500">
                      {group.dose} {group.dose_unit} · {group.route} · {group.frequency}
                    </div>
                  </td>
                  {TIME_SLOTS.map(slot => {
                    const record = getRecordForSlot(group, slot)
                    if (!record) return <td key={slot} className="border-r border-slate-200" />

                    const cellId = `${record.id}-${slot}`
                    const isActive = activeCell === cellId

                    return (
                      <td key={slot} className="border-r border-slate-200 text-center relative">
                        <button
                          type="button"
                          onClick={() => setActiveCell(isActive ? null : cellId)}
                          className={`w-8 h-8 rounded-full text-xs font-bold mx-auto flex items-center justify-center ${STATUS_STYLES[record.status] || STATUS_STYLES.scheduled}`}
                          title={`${record.status} - Click to update`}
                        >
                          {STATUS_ICONS[record.status]}
                        </button>

                        {/* Status dropdown */}
                        {isActive && record.status === 'scheduled' && nurseId && (
                          <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[100px]">
                            {['given', 'held', 'refused'].map(status => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => handleStatusChange(record.id, status)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 capitalize"
                              >
                                {STATUS_ICONS[status]} {status}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="font-medium">Legend:</span>
        {Object.entries(STATUS_STYLES).map(([status, style]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${style}`}>
              {STATUS_ICONS[status]}
            </span>
            <span className="capitalize">{status}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default MARGrid
