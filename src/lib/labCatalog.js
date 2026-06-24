/**
 * Lab Test Catalog for CareLink HMS
 * Common laboratory tests with analyte-level reference ranges
 * Used for automatic result flagging (High / Low / Normal)
 */

export const LAB_CATALOG = [
  {
    code: 'FBC',
    name: 'Full Blood Count',
    category: 'Haematology',
    turnaroundHrs: 2,
    analytes: [
      { name: 'WBC', unit: '×10⁹/L', refLow: 4.0, refHigh: 11.0 },
      { name: 'RBC', unit: '×10¹²/L', refLow: 4.5, refHigh: 5.5 },
      { name: 'Haemoglobin', unit: 'g/dL', refLow: 12.0, refHigh: 17.5 },
      { name: 'Haematocrit', unit: '%', refLow: 36, refHigh: 50 },
      { name: 'Platelets', unit: '×10⁹/L', refLow: 150, refHigh: 400 },
      { name: 'MCV', unit: 'fL', refLow: 80, refHigh: 100 },
      { name: 'MCH', unit: 'pg', refLow: 27, refHigh: 33 },
      { name: 'MCHC', unit: 'g/dL', refLow: 32, refHigh: 36 },
    ],
  },
  {
    code: 'BMP',
    name: 'Basic Metabolic Panel',
    category: 'Chemistry',
    turnaroundHrs: 4,
    analytes: [
      { name: 'Sodium', unit: 'mmol/L', refLow: 136, refHigh: 145 },
      { name: 'Potassium', unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 },
      { name: 'Chloride', unit: 'mmol/L', refLow: 98, refHigh: 106 },
      { name: 'Bicarbonate', unit: 'mmol/L', refLow: 22, refHigh: 29 },
      { name: 'BUN', unit: 'mg/dL', refLow: 7, refHigh: 20 },
      { name: 'Creatinine', unit: 'mg/dL', refLow: 0.6, refHigh: 1.2 },
      { name: 'Glucose', unit: 'mg/dL', refLow: 70, refHigh: 100 },
    ],
  },
  {
    code: 'LFT',
    name: 'Liver Function Tests',
    category: 'Chemistry',
    turnaroundHrs: 4,
    analytes: [
      { name: 'ALT', unit: 'U/L', refLow: 7, refHigh: 56 },
      { name: 'AST', unit: 'U/L', refLow: 10, refHigh: 40 },
      { name: 'ALP', unit: 'U/L', refLow: 44, refHigh: 147 },
      { name: 'GGT', unit: 'U/L', refLow: 9, refHigh: 48 },
      { name: 'Total Bilirubin', unit: 'mg/dL', refLow: 0.1, refHigh: 1.2 },
      { name: 'Direct Bilirubin', unit: 'mg/dL', refLow: 0.0, refHigh: 0.3 },
      { name: 'Albumin', unit: 'g/dL', refLow: 3.5, refHigh: 5.5 },
      { name: 'Total Protein', unit: 'g/dL', refLow: 6.0, refHigh: 8.3 },
    ],
  },
  {
    code: 'RFT',
    name: 'Renal Function Tests',
    category: 'Chemistry',
    turnaroundHrs: 4,
    analytes: [
      { name: 'BUN', unit: 'mg/dL', refLow: 7, refHigh: 20 },
      { name: 'Creatinine', unit: 'mg/dL', refLow: 0.6, refHigh: 1.2 },
      { name: 'Uric Acid', unit: 'mg/dL', refLow: 3.4, refHigh: 7.0 },
      { name: 'eGFR', unit: 'mL/min/1.73m²', refLow: 90, refHigh: null },
    ],
  },
  {
    code: 'LIPID',
    name: 'Lipid Profile',
    category: 'Chemistry',
    turnaroundHrs: 4,
    analytes: [
      { name: 'Total Cholesterol', unit: 'mg/dL', refLow: null, refHigh: 200 },
      { name: 'LDL Cholesterol', unit: 'mg/dL', refLow: null, refHigh: 100 },
      { name: 'HDL Cholesterol', unit: 'mg/dL', refLow: 40, refHigh: null },
      { name: 'Triglycerides', unit: 'mg/dL', refLow: null, refHigh: 150 },
    ],
  },
  {
    code: 'FBS',
    name: 'Fasting Blood Sugar',
    category: 'Chemistry',
    turnaroundHrs: 1,
    analytes: [
      { name: 'Glucose (fasting)', unit: 'mg/dL', refLow: 70, refHigh: 100 },
    ],
  },
  {
    code: 'URINE',
    name: 'Urinalysis',
    category: 'Microbiology',
    turnaroundHrs: 1,
    analytes: [
      { name: 'pH', unit: '', refLow: 4.5, refHigh: 8.0 },
      { name: 'Specific Gravity', unit: '', refLow: 1.005, refHigh: 1.030 },
      { name: 'Protein', unit: '', qualitativeRef: 'Negative' },
      { name: 'Glucose', unit: '', qualitativeRef: 'Negative' },
      { name: 'Blood', unit: '', qualitativeRef: 'Negative' },
      { name: 'Leukocytes', unit: '', qualitativeRef: 'Negative' },
      { name: 'Nitrites', unit: '', qualitativeRef: 'Negative' },
    ],
  },
  {
    code: 'MPRDT',
    name: 'Malaria Rapid Diagnostic Test',
    category: 'Parasitology',
    turnaroundHrs: 0.5,
    analytes: [
      { name: 'P. falciparum', unit: '', qualitativeRef: 'Negative' },
      { name: 'Pan-species', unit: '', qualitativeRef: 'Negative' },
    ],
  },
  {
    code: 'BF',
    name: 'Blood Film for Malaria Parasites',
    category: 'Parasitology',
    turnaroundHrs: 1,
    analytes: [
      { name: 'Malaria Parasites', unit: '', qualitativeRef: 'Not seen' },
      { name: 'Parasite density', unit: '/µL', refLow: null, refHigh: null },
    ],
  },
  {
    code: 'WIDAL',
    name: 'Widal Test',
    category: 'Serology',
    turnaroundHrs: 2,
    analytes: [
      { name: 'Salmonella typhi O', unit: 'titre', qualitativeRef: '<1:80' },
      { name: 'Salmonella typhi H', unit: 'titre', qualitativeRef: '<1:80' },
    ],
  },
  {
    code: 'HIV',
    name: 'HIV Screening',
    category: 'Serology',
    turnaroundHrs: 1,
    analytes: [
      { name: 'HIV 1/2 Antibody', unit: '', qualitativeRef: 'Non-reactive' },
    ],
  },
  {
    code: 'HBSAG',
    name: 'Hepatitis B Surface Antigen',
    category: 'Serology',
    turnaroundHrs: 1,
    analytes: [
      { name: 'HBsAg', unit: '', qualitativeRef: 'Non-reactive' },
    ],
  },

  // ── Ghana-specific additions ──────────────────────────────────────

  {
    code: 'SICK',
    name: 'Sickling Test',
    category: 'Haematology',
    turnaroundHrs: 1,
    analytes: [
      { name: 'Sickling', unit: '', qualitativeRef: 'Negative' },
    ],
    note: 'Screens for sickle cell trait / disease (HbSS, HbAS). Confirm positives with Hb electrophoresis.',
  },
  {
    code: 'G6PD',
    name: 'G6PD Screening',
    category: 'Haematology',
    turnaroundHrs: 2,
    analytes: [
      { name: 'G6PD Activity', unit: 'U/g Hb', refLow: 6.97, refHigh: 20.5 },
      { name: 'G6PD Qualitative', unit: '', qualitativeRef: 'Normal' },
    ],
    note: 'Deficiency contraindicates primaquine and dapsone — critical before malaria treatment.',
  },
  {
    code: 'VDRL',
    name: 'VDRL / RPR (Syphilis Screening)',
    category: 'Serology',
    turnaroundHrs: 1,
    analytes: [
      { name: 'VDRL/RPR', unit: '', qualitativeRef: 'Non-reactive' },
    ],
    note: 'Mandatory ANC screening. Reactive results require confirmatory TPHA/TPPA.',
  },
  {
    code: 'PREG',
    name: 'Pregnancy Test (Urine hCG)',
    category: 'Chemistry',
    turnaroundHrs: 0.5,
    analytes: [
      { name: 'hCG', unit: '', qualitativeRef: 'Negative' },
    ],
    note: 'Qualitative urine hCG. Used in ANC booking and emergency presentations.',
  },
  {
    code: 'AFB',
    name: 'AFB Smear (Sputum)',
    category: 'Microbiology',
    turnaroundHrs: 4,
    analytes: [
      { name: 'AFB Smear 1', unit: '', qualitativeRef: 'No AFB seen' },
      { name: 'AFB Smear 2', unit: '', qualitativeRef: 'No AFB seen' },
    ],
    note: 'Ziehl-Neelsen stain for M. tuberculosis. Collect 3 sputum samples (spot-morning-spot). GeneXpert preferred when available.',
  },
  {
    code: 'HBA1C',
    name: 'HbA1c (Glycated Haemoglobin)',
    category: 'Chemistry',
    turnaroundHrs: 2,
    analytes: [
      { name: 'HbA1c', unit: '%', refLow: null, refHigh: 5.7 },
      { name: 'HbA1c (IFCC)', unit: 'mmol/mol', refLow: null, refHigh: 39 },
    ],
    note: 'Diabetes monitoring: <5.7% normal, 5.7–6.4% pre-diabetes, ≥6.5% diabetes. Target for treated diabetics: <7%.',
  },
]

/** Find a lab test by its code */
export function findTest(code) {
  if (!code) return null
  return LAB_CATALOG.find((t) => t.code.toUpperCase() === code.toUpperCase()) || null
}

/** Search tests by name, code, or category */
export function searchTests(query, limit = 20) {
  if (!query || query.trim().length === 0) return LAB_CATALOG.slice(0, limit)
  const q = query.toLowerCase().trim()
  return LAB_CATALOG.filter(
    (t) =>
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
  ).slice(0, limit)
}

/**
 * Flag a numeric value against an analyte's reference range
 * @returns {'HIGH'|'LOW'|'NORMAL'|null}
 */
export function flagValue(value, analyte) {
  if (value == null || (!analyte.refLow && analyte.refLow !== 0) && !analyte.refHigh) return null
  const v = Number(value)
  if (isNaN(v)) return null
  if (analyte.refHigh != null && v > analyte.refHigh) return 'HIGH'
  if (analyte.refLow != null && v < analyte.refLow) return 'LOW'
  return 'NORMAL'
}

/**
 * Flag a qualitative result against expected reference
 * @returns {'ABNORMAL'|'NORMAL'|null}
 */
export function flagQualitative(value, analyte) {
  if (!value || !analyte.qualitativeRef) return null
  return value.toLowerCase() === analyte.qualitativeRef.toLowerCase() ? 'NORMAL' : 'ABNORMAL'
}

/** Format a reference range string for display */
export function formatRange(analyte) {
  if (analyte.qualitativeRef) return analyte.qualitativeRef
  const parts = []
  if (analyte.refLow != null) parts.push(analyte.refLow)
  parts.push('–')
  if (analyte.refHigh != null) parts.push(analyte.refHigh)
  else parts.push('∞')
  if (analyte.unit) parts.push(analyte.unit)
  return parts.join(' ')
}

/** Get unique lab categories */
export function getLabCategories() {
  return [...new Set(LAB_CATALOG.map((t) => t.category))]
}
