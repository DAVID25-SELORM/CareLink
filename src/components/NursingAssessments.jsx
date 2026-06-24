import { useState } from 'react'
import { toast } from 'react-toastify'
import { createNursingAssessment } from '../services/nursingService'

const ASSESSMENT_TYPES = [
  { value: 'admission', label: 'Admission Assessment' },
  { value: 'shift', label: 'Shift Assessment' },
  { value: 'focused', label: 'Focused Assessment' },
  { value: 'pain', label: 'Pain Assessment' },
  { value: 'fall_risk', label: 'Fall Risk (Morse)' },
  { value: 'pressure_injury', label: 'Pressure Injury (Braden)' },
  { value: 'neurological', label: 'Neurological (Glasgow)' },
]

const GCS_SCALES = {
  eye_opening: [
    { score: 4, label: 'Spontaneous' },
    { score: 3, label: 'To voice' },
    { score: 2, label: 'To pressure' },
    { score: 1, label: 'None' },
  ],
  verbal_response: [
    { score: 5, label: 'Oriented' },
    { score: 4, label: 'Confused' },
    { score: 3, label: 'Inappropriate words' },
    { score: 2, label: 'Incomprehensible' },
    { score: 1, label: 'None' },
  ],
  motor_response: [
    { score: 6, label: 'Obeys commands' },
    { score: 5, label: 'Localizing pain' },
    { score: 4, label: 'Withdrawal' },
    { score: 3, label: 'Abnormal flexion' },
    { score: 2, label: 'Extension' },
    { score: 1, label: 'None' },
  ],
}

const BRADEN_SCALES = {
  sensory_perception: [
    { score: 1, label: 'Completely limited' },
    { score: 2, label: 'Very limited' },
    { score: 3, label: 'Slightly limited' },
    { score: 4, label: 'No impairment' },
  ],
  moisture: [
    { score: 1, label: 'Constantly moist' },
    { score: 2, label: 'Very moist' },
    { score: 3, label: 'Occasionally moist' },
    { score: 4, label: 'Rarely moist' },
  ],
  activity: [
    { score: 1, label: 'Bedfast' },
    { score: 2, label: 'Chairfast' },
    { score: 3, label: 'Walks occasionally' },
    { score: 4, label: 'Walks frequently' },
  ],
  mobility: [
    { score: 1, label: 'Completely immobile' },
    { score: 2, label: 'Very limited' },
    { score: 3, label: 'Slightly limited' },
    { score: 4, label: 'No limitation' },
  ],
  nutrition: [
    { score: 1, label: 'Very poor' },
    { score: 2, label: 'Probably inadequate' },
    { score: 3, label: 'Adequate' },
    { score: 4, label: 'Excellent' },
  ],
  friction_shear: [
    { score: 1, label: 'Problem' },
    { score: 2, label: 'Potential problem' },
    { score: 3, label: 'No apparent problem' },
  ],
}

const NursingAssessments = ({ patientId, encounterId, assessedBy, onSaved }) => {
  const [assessmentType, setAssessmentType] = useState('shift')
  const [gcs, setGcs] = useState({ eye_opening: 4, verbal_response: 5, motor_response: 6 })
  const [braden, setBraden] = useState({
    sensory_perception: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 3, friction_shear: 3,
  })
  const [fallRisk, setFallRisk] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const gcsTotal = gcs.eye_opening + gcs.verbal_response + gcs.motor_response
  const bradenTotal = Object.values(braden).reduce((a, b) => a + b, 0)

  const getGcsSeverity = (score) => {
    if (score <= 8) return { label: 'Severe', color: 'text-red-700 bg-red-100' }
    if (score <= 12) return { label: 'Moderate', color: 'text-amber-700 bg-amber-100' }
    return { label: 'Mild/None', color: 'text-green-700 bg-green-100' }
  }

  const getBradenRisk = (score) => {
    if (score <= 9) return { label: 'Very High Risk', color: 'text-red-700 bg-red-100' }
    if (score <= 12) return { label: 'High Risk', color: 'text-orange-700 bg-orange-100' }
    if (score <= 14) return { label: 'Moderate Risk', color: 'text-amber-700 bg-amber-100' }
    if (score <= 18) return { label: 'Mild Risk', color: 'text-yellow-700 bg-yellow-100' }
    return { label: 'No Risk', color: 'text-green-700 bg-green-100' }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        patient_id: patientId,
        encounter_id: encounterId,
        assessed_by: assessedBy,
        assessment_type: assessmentType,
        notes: notes || null,
      }

      if (assessmentType === 'neurological') {
        payload.glasgow_eye = gcs.eye_opening
        payload.glasgow_verbal = gcs.verbal_response
        payload.glasgow_motor = gcs.motor_response
        payload.glasgow_total = gcsTotal
      }
      if (assessmentType === 'pressure_injury') {
        payload.braden_score = bradenTotal
        payload.assessment_data = braden
      }
      if (assessmentType === 'fall_risk') {
        payload.fall_risk_score = fallRisk
      }

      const { data, error } = await createNursingAssessment(payload)
      if (error) throw error
      toast.success('Assessment saved')
      onSaved?.(data)
      setNotes('')
    } catch (error) {
      console.error('Error saving assessment:', error)
      toast.error('Failed to save assessment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Assessment Type Selection */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Type</label>
        <div className="flex flex-wrap gap-2">
          {ASSESSMENT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setAssessmentType(t.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                assessmentType === t.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Glasgow Coma Scale */}
      {assessmentType === 'neurological' && (
        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Glasgow Coma Scale</h4>
            <span className={`px-2 py-0.5 text-sm font-bold rounded ${getGcsSeverity(gcsTotal).color}`}>
              GCS: {gcsTotal}/15 — {getGcsSeverity(gcsTotal).label}
            </span>
          </div>
          {Object.entries(GCS_SCALES).map(([key, options]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">
                {key.replace('_', ' ')}
              </label>
              <div className="flex flex-wrap gap-2">
                {options.map(opt => (
                  <button
                    key={opt.score}
                    type="button"
                    onClick={() => setGcs(prev => ({ ...prev, [key]: opt.score }))}
                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                      gcs[key] === opt.score
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {opt.score} — {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Braden Scale */}
      {assessmentType === 'pressure_injury' && (
        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Braden Scale</h4>
            <span className={`px-2 py-0.5 text-sm font-bold rounded ${getBradenRisk(bradenTotal).color}`}>
              Score: {bradenTotal}/23 — {getBradenRisk(bradenTotal).label}
            </span>
          </div>
          {Object.entries(BRADEN_SCALES).map(([key, options]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">
                {key.replace('_', ' ')}
              </label>
              <div className="flex flex-wrap gap-2">
                {options.map(opt => (
                  <button
                    key={opt.score}
                    type="button"
                    onClick={() => setBraden(prev => ({ ...prev, [key]: opt.score }))}
                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                      braden[key] === opt.score
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {opt.score} — {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fall Risk */}
      {assessmentType === 'fall_risk' && (
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Fall Risk Score</h4>
            <span className={`px-2 py-0.5 text-sm font-bold rounded ${
              fallRisk >= 45 ? 'bg-red-100 text-red-700' :
              fallRisk >= 25 ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'
            }`}>
              Score: {fallRisk} — {fallRisk >= 45 ? 'High Risk' : fallRisk >= 25 ? 'Moderate Risk' : 'Low Risk'}
            </span>
          </div>
          <input
            type="number"
            min={0}
            max={125}
            value={fallRisk}
            onChange={(e) => setFallRisk(parseInt(e.target.value) || 0)}
            className="w-32 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Additional findings, observations, nursing plan..."
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Assessment'}
      </button>
    </form>
  )
}

export default NursingAssessments
