// Age- and sex-specific reference ranges. Catalog analytes carry one default (adult) range; for the tests below the
// range is replaced to suit the patient. Values are common textbook adult/child ranges and MUST be confirmed by
// each facility's laboratory lead, because ranges depend on the analyser and method.
//
// Safety rules: an override applies only when the analyte unit matches the unit the range is written in, and only
// when the patient's age and/or sex are known. Otherwise the catalog default is kept and no basis is claimed.

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const cleanUnit = (u) => String(u || '').toLowerCase().replace(/\s+/g, '').replace('µ', 'u').replace('μ', 'u')

const CHILD = { maxAge: 12 }
const ADULT = { minAge: 12 }

// match: analyte name (normalised). unit: the unit these numbers are written in.
const OVERLAYS = [
  { match: 'haemoglobin', unit: 'g/dl', ranges: [
    { ...CHILD, low: 11.0, high: 14.5, basis: 'child under 12' },
    { ...ADULT, sex: 'male', low: 13.0, high: 17.5, basis: 'male' },
    { ...ADULT, sex: 'female', low: 12.0, high: 15.5, basis: 'female' },
  ] },
  { match: 'haematocrit', unit: '%', ranges: [
    { ...CHILD, low: 33, high: 43, basis: 'child under 12' },
    { ...ADULT, sex: 'male', low: 40, high: 52, basis: 'male' },
    { ...ADULT, sex: 'female', low: 36, high: 46, basis: 'female' },
  ] },
  { match: 'rbc', unit: 'x10^12/l', ranges: [
    { ...CHILD, low: 3.9, high: 5.3, basis: 'child under 12' },
    { ...ADULT, sex: 'male', low: 4.5, high: 5.9, basis: 'male' },
    { ...ADULT, sex: 'female', low: 4.1, high: 5.1, basis: 'female' },
  ] },
  { match: 'wbc', unit: 'x10^9/l', ranges: [{ ...CHILD, low: 5.0, high: 14.5, basis: 'child under 12' }] },
  { match: 'creatinine', unit: 'mg/dl', ranges: [
    { ...CHILD, low: 0.3, high: 0.7, basis: 'child under 12' },
    { ...ADULT, sex: 'male', low: 0.7, high: 1.3, basis: 'male' },
    { ...ADULT, sex: 'female', low: 0.6, high: 1.1, basis: 'female' },
  ] },
  { match: 'creatinine', unit: 'umol/l', ranges: [
    { ...CHILD, low: 27, high: 62, basis: 'child under 12' },
    { ...ADULT, sex: 'male', low: 62, high: 115, basis: 'male' },
    { ...ADULT, sex: 'female', low: 53, high: 97, basis: 'female' },
  ] },
  { match: 'uric acid', unit: 'mg/dl', ranges: [
    { ...ADULT, sex: 'male', low: 3.4, high: 7.0, basis: 'male' },
    { ...ADULT, sex: 'female', low: 2.4, high: 6.0, basis: 'female' },
  ] },
  { match: 'alt', unit: 'u/l', ranges: [{ ...ADULT, sex: 'female', low: 7, high: 45, basis: 'female' }] },
  { match: 'ggt', unit: 'u/l', ranges: [
    { ...ADULT, sex: 'male', low: 8, high: 61, basis: 'male' },
    { ...ADULT, sex: 'female', low: 5, high: 36, basis: 'female' },
  ] },
  { match: 'alp', unit: 'u/l', ranges: [{ ...CHILD, low: 150, high: 420, basis: 'child under 12' }] },
  { match: 'hdl cholesterol', unit: 'mg/dl', ranges: [
    { ...ADULT, sex: 'male', low: 40, high: null, basis: 'male' },
    { ...ADULT, sex: 'female', low: 50, high: null, basis: 'female' },
  ] },
]

export function patientContext(patient) {
  if (!patient) return { sex: null, ageYears: null }
  const g = norm(patient.gender || patient.sex)
  const sex = g === 'male' || g === 'm' ? 'male' : g === 'female' || g === 'f' ? 'female' : null
  let ageYears = null
  if (patient.date_of_birth) {
    const dob = new Date(patient.date_of_birth)
    if (!Number.isNaN(dob.getTime())) ageYears = (Date.now() - dob.getTime()) / (365.25 * 86400000)
  }
  if (ageYears === null && patient.age != null && patient.age !== '' && !Number.isNaN(Number(patient.age))) ageYears = Number(patient.age)
  return { sex, ageYears }
}

/**
 * Returns the analyte with refLow/refHigh replaced for this patient, plus rangeBasis (e.g. "female").
 * The analyte is returned unchanged when no override applies.
 */
export function resolveAnalyte(analyte, context) {
  if (!analyte || analyte.qualitativeRef) return analyte
  const { sex, ageYears } = context || {}
  if (sex == null && ageYears == null) return analyte
  const name = norm(analyte.name)
  const unit = cleanUnit(analyte.unit).replace('×', 'x').replace('⁹', '^9').replace('¹²', '^12')
  for (const overlay of OVERLAYS) {
    if (overlay.match !== name || overlay.unit !== unit) continue
    const hit = overlay.ranges.find((r) =>
      (r.sex == null || r.sex === sex) &&
      (r.minAge == null || (ageYears != null && ageYears >= r.minAge)) &&
      (r.maxAge == null || (ageYears != null && ageYears < r.maxAge)))
    if (hit) return { ...analyte, refLow: hit.low, refHigh: hit.high, rangeBasis: hit.basis }
  }
  return analyte
}

export const resolveAnalytes = (analytes, patient) => {
  const context = patientContext(patient)
  return (analytes || []).map((a) => resolveAnalyte(a, context))
}
