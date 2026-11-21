// Chronic-care follow-up: patients with a long-term condition who have not been seen for a while.
// A condition counts as chronic when the diagnosis is flagged is_chronic or its ICD-10 code is in this list.
// HIV/AIDS is deliberately NOT listed: recall for it needs a separate, confidential process, never a general SMS.
// The clinical lead should confirm the list and the default interval.

export const CHRONIC_PREFIXES = [
  ['I10', 'Hypertension'], ['I11', 'Hypertension'], ['I12', 'Hypertension'], ['I13', 'Hypertension'], ['I15', 'Hypertension'],
  ['E10', 'Diabetes'], ['E11', 'Diabetes'], ['E13', 'Diabetes'], ['E14', 'Diabetes'],
  ['J45', 'Asthma'], ['J44', 'COPD'], ['G40', 'Epilepsy'], ['D57', 'Sickle cell disease'],
  ['N18', 'Chronic kidney disease'], ['I50', 'Heart failure'],
]
export const DEFAULT_OVERDUE_DAYS = 90
export const RECALL_KIND = 'chronic_recall'
export const COOLDOWN_DAYS = 30
const DAY = 86400000

export function chronicLabel(diagnosis) {
  const code = String(diagnosis?.icd10_code || '').toUpperCase().replace(/\s/g, '')
  const hit = CHRONIC_PREFIXES.find(([prefix]) => code.startsWith(prefix))
  if (hit) return hit[1]
  return diagnosis?.is_chronic === true ? diagnosis.icd10_description || code || 'Chronic condition' : ''
}

/**
 * @param diagnoses rows with patient_id, icd10_code, icd10_description, is_chronic, resolved_date, certainty
 * @param lastSeen Map patient_id -> ms of latest encounter
 * @returns patients not seen for more than `days`, longest gap first
 */
export function overdueChronicPatients({ diagnoses, lastSeen, now = Date.now(), days = DEFAULT_OVERDUE_DAYS }) {
  const byPatient = new Map()
  for (const d of diagnoses || []) {
    if (d.resolved_date || (d.certainty && d.certainty !== 'confirmed')) continue
    const label = chronicLabel(d)
    if (!label) continue
    byPatient.set(d.patient_id, new Set([...(byPatient.get(d.patient_id) || []), label]))
  }
  const out = []
  for (const [patientId, conditions] of byPatient) {
    const seen = lastSeen.get(patientId)
    const daysSince = seen ? Math.floor((now - seen) / DAY) : null
    if (daysSince === null || daysSince > days) out.push({ patientId, conditions: [...conditions].sort(), daysSince })
  }
  return out.sort((a, b) => (b.daysSince ?? 1e9) - (a.daysSince ?? 1e9))
}

// Never names the condition: a text can be read by anyone holding the phone.
export const buildChronicRecallMessage = ({ name, hospital }) =>
  `Dear ${String(name || '').trim().split(/\s+/)[0] || 'patient'}, it is time for your routine check-up at ${hospital || 'the clinic'}. Please come in or call us to book a visit.`
