import { useState } from 'react'
import { toast } from 'react-toastify'
import { recordVitals } from '../services/encounterService'

const VITAL_FIELDS = [
  { key: 'temperature_c', label: 'Temperature (°C)', min: 30, max: 45, step: 0.1, unit: '°C' },
  { key: 'bp_systolic', label: 'Systolic BP', min: 50, max: 300, step: 1, unit: 'mmHg' },
  { key: 'bp_diastolic', label: 'Diastolic BP', min: 20, max: 200, step: 1, unit: 'mmHg' },
  { key: 'pulse_rate', label: 'Pulse Rate', min: 20, max: 250, step: 1, unit: '/min' },
  { key: 'respiratory_rate', label: 'Respiratory Rate', min: 4, max: 60, step: 1, unit: '/min' },
  { key: 'spo2', label: 'SpO₂', min: 50, max: 100, step: 1, unit: '%' },
  { key: 'weight_kg', label: 'Weight', min: 0.5, max: 500, step: 0.1, unit: 'kg' },
  { key: 'height_cm', label: 'Height', min: 20, max: 280, step: 0.1, unit: 'cm' },
  { key: 'blood_glucose', label: 'Blood Glucose', min: 0.5, max: 50, step: 0.1, unit: 'mmol/L' },
  { key: 'pain_scale', label: 'Pain Scale', min: 0, max: 10, step: 1, unit: '/10' },
]

const getVitalStatus = (key, value) => {
  const ranges = {
    temperature_c: { low: 36, high: 38, critLow: 35, critHigh: 40 },
    bp_systolic: { low: 90, high: 140, critLow: 70, critHigh: 180 },
    bp_diastolic: { low: 60, high: 90, critLow: 40, critHigh: 120 },
    pulse_rate: { low: 60, high: 100, critLow: 40, critHigh: 150 },
    respiratory_rate: { low: 12, high: 20, critLow: 8, critHigh: 30 },
    spo2: { low: 95, high: 100, critLow: 90, critHigh: 101 },
    blood_glucose: { low: 4, high: 7, critLow: 2.5, critHigh: 20 },
  }
  const r = ranges[key]
  if (!r || !value) return ''
  if (value <= r.critLow || value >= r.critHigh) return 'bg-red-100 border-red-300 text-red-900'
  if (value < r.low || value > r.high) return 'bg-amber-50 border-amber-300 text-amber-900'
  return 'bg-green-50 border-green-300 text-green-900'
}

const VitalsForm = ({ patientId, encounterId, recordedBy, onSaved, existingVitals }) => {
  const [vitals, setVitals] = useState(() => {
    const defaults = {}
    VITAL_FIELDS.forEach(f => { defaults[f.key] = '' })
    return { ...defaults, notes: '' }
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (key, value) => {
    setVitals(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        patient_id: patientId,
        encounter_id: encounterId,
        recorded_by: recordedBy,
      }
      VITAL_FIELDS.forEach(f => {
        if (vitals[f.key] !== '' && vitals[f.key] !== null) {
          payload[f.key] = parseFloat(vitals[f.key])
        }
      })
      if (vitals.notes) payload.notes = vitals.notes

      const { data, error } = await recordVitals(payload)
      if (error) throw error
      toast.success('Vitals recorded successfully')
      onSaved?.(data)
      // Reset form
      const defaults = {}
      VITAL_FIELDS.forEach(f => { defaults[f.key] = '' })
      setVitals({ ...defaults, notes: '' })
    } catch (error) {
      console.error('Error recording vitals:', error)
      toast.error('Failed to record vitals')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {VITAL_FIELDS.map(field => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {field.label}
            </label>
            <div className="relative">
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={vitals[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getVitalStatus(field.key, parseFloat(vitals[field.key])) || 'border-slate-200'}`}
                placeholder={field.unit}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {field.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Auto-calculated BMI display */}
      {vitals.weight_kg && vitals.height_cm && (
        <div className="text-sm text-slate-600">
          <span className="font-medium">Calculated BMI:</span>{' '}
          {(parseFloat(vitals.weight_kg) / Math.pow(parseFloat(vitals.height_cm) / 100, 2)).toFixed(1)} kg/m²
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea
          value={vitals.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Additional observations..."
        />
      </div>

      {/* Previous vitals comparison */}
      {existingVitals && existingVitals.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-500 mb-2">Previous Vitals ({new Date(existingVitals[0].recorded_at).toLocaleString()})</p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            {VITAL_FIELDS.map(f => existingVitals[0][f.key] ? (
              <span key={f.key}>
                <span className="font-medium">{f.label}:</span> {existingVitals[0][f.key]} {f.unit}
              </span>
            ) : null)}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Record Vitals'}
      </button>
    </form>
  )
}

export default VitalsForm
