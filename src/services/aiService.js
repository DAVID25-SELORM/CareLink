import { supabase } from '../supabaseClient'

// ─── AI Clinical Decision Support Service ────────────────────────────
// Runs locally using rule-based engines with Supabase Edge Functions
// for more advanced inference when online.

// ─── 1. Abnormal Lab Result Flagging ─────────────────────────────────

const REFERENCE_RANGES = {
  // Hematology
  'hemoglobin': { unit: 'g/dL', male: { low: 13.0, high: 17.5 }, female: { low: 12.0, high: 15.5 } },
  'wbc': { unit: '×10⁹/L', low: 4.0, high: 11.0 },
  'platelets': { unit: '×10⁹/L', low: 150, high: 400 },
  'hematocrit': { unit: '%', male: { low: 38.3, high: 48.6 }, female: { low: 35.5, high: 44.9 } },

  // Chemistry
  'glucose_fasting': { unit: 'mmol/L', low: 3.9, high: 5.6 },
  'glucose_random': { unit: 'mmol/L', low: 3.9, high: 7.8 },
  'creatinine': { unit: 'µmol/L', male: { low: 62, high: 106 }, female: { low: 44, high: 80 } },
  'urea': { unit: 'mmol/L', low: 2.5, high: 6.7 },
  'alt': { unit: 'U/L', low: 7, high: 56 },
  'ast': { unit: 'U/L', low: 10, high: 40 },
  'bilirubin_total': { unit: 'µmol/L', low: 3.4, high: 20.5 },
  'albumin': { unit: 'g/L', low: 35, high: 50 },
  'sodium': { unit: 'mmol/L', low: 136, high: 145 },
  'potassium': { unit: 'mmol/L', low: 3.5, high: 5.1 },
  'chloride': { unit: 'mmol/L', low: 98, high: 106 },

  // Malaria (Ghana-specific)
  'malaria_rdt': { type: 'qualitative', normal: 'negative' },
  'malaria_parasite_count': { unit: '/µL', low: 0, high: 0, criticalHigh: 100000 },
}

export function flagAbnormalLab(testName, value, gender = null) {
  const normalizedName = testName.toLowerCase().replace(/\s+/g, '_')
  const range = REFERENCE_RANGES[normalizedName]
  if (!range) return null

  // Qualitative test
  if (range.type === 'qualitative') {
    const isNormal = String(value).toLowerCase() === range.normal
    return {
      testName,
      value,
      status: isNormal ? 'normal' : 'abnormal',
      severity: isNormal ? 'normal' : 'critical',
      message: isNormal ? 'Within normal limits' : `Abnormal: expected ${range.normal}`,
    }
  }

  const numVal = parseFloat(value)
  if (isNaN(numVal)) return null

  // Gender-specific ranges
  const low = gender && range[gender] ? range[gender].low : range.low
  const high = gender && range[gender] ? range[gender].high : range.high

  let status = 'normal'
  let severity = 'normal'
  let message = 'Within normal limits'

  if (numVal < low) {
    status = 'low'
    severity = numVal < low * 0.7 ? 'critical' : 'warning'
    message = `Low: ${numVal} ${range.unit} (ref: ${low}–${high})`
  } else if (numVal > high) {
    status = 'high'
    severity = range.criticalHigh
      ? (numVal > range.criticalHigh ? 'critical' : 'warning')
      : (numVal > high * 1.5 ? 'critical' : 'warning')
    message = `High: ${numVal} ${range.unit} (ref: ${low}–${high})`
  }

  return { testName, value: numVal, unit: range.unit, status, severity, message, refRange: `${low}–${high}` }
}

// ─── 2. Auto-generate Doctor Notes from Structured Data ──────────────

export function generateClinicalSummary({ vitals, diagnoses, orders, allergies }) {
  const lines = []

  if (vitals) {
    const v = vitals
    lines.push('VITALS:')
    if (v.blood_pressure_systolic && v.blood_pressure_diastolic) {
      lines.push(`  BP: ${v.blood_pressure_systolic}/${v.blood_pressure_diastolic} mmHg`)
    }
    if (v.heart_rate) lines.push(`  HR: ${v.heart_rate} bpm`)
    if (v.temperature) lines.push(`  Temp: ${v.temperature}°C`)
    if (v.respiratory_rate) lines.push(`  RR: ${v.respiratory_rate}/min`)
    if (v.oxygen_saturation) lines.push(`  SpO2: ${v.oxygen_saturation}%`)
    if (v.weight) lines.push(`  Weight: ${v.weight} kg`)
    lines.push('')
  }

  if (allergies?.length > 0) {
    lines.push('ALLERGIES:')
    allergies.forEach(a => lines.push(`  - ${a.allergen} (${a.severity}): ${a.reaction}`))
    lines.push('')
  }

  if (diagnoses?.length > 0) {
    lines.push('DIAGNOSES:')
    diagnoses.forEach(d => {
      const primary = d.diagnosis_type === 'primary' ? ' [PRIMARY]' : ''
      lines.push(`  - ${d.icd10_code}: ${d.description}${primary}`)
    })
    lines.push('')
  }

  if (orders?.length > 0) {
    lines.push('ACTIVE ORDERS:')
    orders.forEach(o => {
      lines.push(`  - [${o.order_type.toUpperCase()}] ${o.order_details?.description || 'N/A'} (${o.priority})`)
    })
  }

  return lines.join('\n')
}

// ─── 3. NHIA Claim Rejection Prediction ──────────────────────────────

const REJECTION_RULES = [
  {
    id: 'missing_diagnosis',
    check: (claim) => !claim.diagnoses || claim.diagnoses.length === 0,
    risk: 'high',
    message: 'No diagnosis attached — NHIA will reject',
  },
  {
    id: 'no_primary_diagnosis',
    check: (claim) => claim.diagnoses && !claim.diagnoses.some(d => d.diagnosis_type === 'primary'),
    risk: 'high',
    message: 'No primary diagnosis — required for NHIA claims',
  },
  {
    id: 'expired_insurance',
    check: (claim) => {
      if (!claim.insurance_expiry) return true
      return new Date(claim.insurance_expiry) < new Date()
    },
    risk: 'high',
    message: 'Insurance expired — verify membership status',
  },
  {
    id: 'missing_insurance_number',
    check: (claim) => !claim.insurance_number || claim.insurance_number.trim() === '',
    risk: 'high',
    message: 'No NHIA insurance number provided',
  },
  {
    id: 'high_claim_amount',
    check: (claim) => claim.total_amount > 5000,
    risk: 'medium',
    message: 'High claim amount (>GH₵5,000) — likely to trigger NHIA review',
  },
  {
    id: 'duplicate_visit_same_day',
    check: (claim) => claim.otherVisitsSameDay > 0,
    risk: 'medium',
    message: 'Multiple visits on same day — potential duplicate flag',
  },
  {
    id: 'tariff_mismatch',
    check: (claim) => claim.items?.some(i => !i.nhia_tariff_code),
    risk: 'medium',
    message: 'Some items missing NHIA tariff codes — may be rejected',
  },
]

export function predictClaimRejection(claimData) {
  const flags = REJECTION_RULES.filter(rule => rule.check(claimData))
  const overallRisk = flags.some(f => f.risk === 'high')
    ? 'high'
    : flags.some(f => f.risk === 'medium')
      ? 'medium'
      : 'low'

  return {
    overallRisk,
    flags,
    score: Math.max(0, 100 - flags.length * 20),
    recommendation: overallRisk === 'high'
      ? 'Fix flagged issues before submitting to NHIA'
      : overallRisk === 'medium'
        ? 'Review flagged items — submission may succeed but could be delayed'
        : 'Claim looks good for submission',
  }
}

// ─── 4. Drug Stockout Prediction ─────────────────────────────────────

export async function predictStockouts(daysAhead = 30) {
  const { data: drugs, error } = await supabase
    .from('drugs')
    .select('id, name, stock_quantity, reorder_level, category')
    .order('stock_quantity', { ascending: true })
    .limit(200)

  if (error) return { error: error.message }

  // Simple heuristic: estimate daily usage from reorder level
  // Reorder level ≈ 2 weeks of stock → daily usage ≈ reorder_level / 14
  const predictions = drugs.map(drug => {
    const estimatedDailyUsage = Math.max(1, Math.ceil((drug.reorder_level || 10) / 14))
    const daysUntilStockout = Math.floor(drug.stock_quantity / estimatedDailyUsage)
    const willStockout = daysUntilStockout <= daysAhead

    return {
      id: drug.id,
      name: drug.name,
      category: drug.category,
      currentStock: drug.stock_quantity,
      estimatedDailyUsage,
      daysUntilStockout,
      willStockout,
      urgency: daysUntilStockout <= 3 ? 'critical' : daysUntilStockout <= 7 ? 'urgent' : daysUntilStockout <= 14 ? 'warning' : 'ok',
      recommendedOrder: Math.max(0, (estimatedDailyUsage * daysAhead) - drug.stock_quantity),
    }
  })

  return {
    predictions: predictions.filter(p => p.willStockout),
    summary: {
      critical: predictions.filter(p => p.urgency === 'critical').length,
      urgent: predictions.filter(p => p.urgency === 'urgent').length,
      warning: predictions.filter(p => p.urgency === 'warning').length,
    },
  }
}

// ─── 5. Vitals Trend Analysis ────────────────────────────────────────

export function analyzeVitalsTrend(vitalsHistory) {
  if (!vitalsHistory || vitalsHistory.length < 2) {
    return { hasTrend: false, alerts: [] }
  }

  const alerts = []
  const sorted = [...vitalsHistory].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
  const recent = sorted.slice(-5) // Last 5 readings

  // Check for trending BP
  const systolics = recent.map(v => v.blood_pressure_systolic).filter(Boolean)
  if (systolics.length >= 3) {
    const isRising = systolics.every((v, i) => i === 0 || v >= systolics[i - 1])
    const isFalling = systolics.every((v, i) => i === 0 || v <= systolics[i - 1])
    if (isRising && systolics[systolics.length - 1] > 140) {
      alerts.push({ type: 'bp_rising', severity: 'warning', message: 'Systolic BP trending upward — monitor closely' })
    }
    if (isFalling && systolics[systolics.length - 1] < 90) {
      alerts.push({ type: 'bp_falling', severity: 'critical', message: 'Systolic BP dropping — possible hypotension' })
    }
  }

  // Check for fever trend
  const temps = recent.map(v => v.temperature).filter(Boolean)
  if (temps.length >= 2 && temps[temps.length - 1] >= 38.5 && temps[temps.length - 2] >= 38.0) {
    alerts.push({ type: 'persistent_fever', severity: 'warning', message: 'Persistent fever — consider blood cultures / malaria RDT' })
  }

  // Oxygen desaturation
  const spo2 = recent.map(v => v.oxygen_saturation).filter(Boolean)
  if (spo2.length >= 2 && spo2[spo2.length - 1] < 92) {
    alerts.push({ type: 'desaturation', severity: 'critical', message: `SpO2 ${spo2[spo2.length - 1]}% — initiate oxygen therapy` })
  }

  return { hasTrend: alerts.length > 0, alerts }
}
