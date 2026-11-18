// SMS recall for children with overdue immunisations.
// The text never names vaccines or diagnoses; it only asks the guardian to bring the child in.
// The send-sms function enforces SMS consent and uses the phone number on the patient record.

export const RECALL_KIND = 'immunisation_recall'
export const RECALL_COOLDOWN_DAYS = 14

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'your child'

export function buildRecallMessage({ childName, hospital }) {
  const where = hospital || 'the clinic'
  return `Dear parent/guardian, ${firstName(childName)} is due for a clinic visit at ${where}. Please bring the child health record card. Thank you.`
}

/** Latest recall time per patient from audit entries ({record_id, created_at, new_values:{kind}}). */
export function lastRecallByPatient(entries, kind = RECALL_KIND) {
  const latest = new Map()
  for (const e of entries || []) {
    if (e?.new_values?.kind !== kind || !e.record_id) continue
    const at = new Date(e.created_at).getTime()
    if (!(at > (latest.get(e.record_id) || 0))) continue
    latest.set(e.record_id, at)
  }
  return latest
}

export function recalledRecently(lastAt, now = Date.now(), days = RECALL_COOLDOWN_DAYS) {
  return Boolean(lastAt) && now - lastAt < days * 86400000
}

/** Why a child cannot be texted from this screen, or '' when they can. */
export function recallBlocker(patient) {
  if (patient?.consent_sms !== true) return 'No SMS consent'
  // Mirrors normalizeGhanaPhone in supabase/functions/_shared/sms.mjs (the server is the real check).
  const digits = String(patient?.phone || '').replace(/[\s()-]/g, '').replace(/^\+/, '')
  if (!/^(0\d{9}|233\d{9}|\d{9})$/.test(digits)) return 'No valid phone'
  return ''
}
