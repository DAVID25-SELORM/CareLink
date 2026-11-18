// Ghana routine childhood immunisation and vitamin A schedule, and per-child status.
// Source: Ghana Health Service "National Immunisation and Vitamin A Schedule" (ghs.gov.gh/immunisation), read 2026-11-17.
// The schedule changes (malaria vaccine and HPV were phased in). A facility's immunisation lead must confirm it against
// the current GHS schedule; edit this list, no other code depends on the contents.
// Birth contact: the source page also repeated the 6-week doses under "At birth"; that looks like a table layout
// error, so birth is BCG, OPV0 and Hepatitis B birth dose only.

const w = (weeks) => ({ weeks })
const m = (months) => ({ months })

export const EPI_SCHEDULE = [
  { code: 'BCG', label: 'BCG', due: w(0) },
  { code: 'OPV0', label: 'OPV 0', due: w(0) },
  { code: 'HEPB0', label: 'Hepatitis B birth dose', due: w(0) },
  { code: 'PENTA1', label: 'DPT-HepB-Hib 1 (Penta)', due: w(6) },
  { code: 'OPV1', label: 'OPV 1', due: w(6) },
  { code: 'PCV1', label: 'PCV 1', due: w(6) },
  { code: 'ROTA1', label: 'Rotavirus 1', due: w(6), maxAgeWeeks: 15 },
  { code: 'PENTA2', label: 'DPT-HepB-Hib 2 (Penta)', due: w(10) },
  { code: 'OPV2', label: 'OPV 2', due: w(10) },
  { code: 'PCV2', label: 'PCV 2', due: w(10) },
  { code: 'ROTA2', label: 'Rotavirus 2', due: w(10), maxAgeWeeks: 32 },
  { code: 'PENTA3', label: 'DPT-HepB-Hib 3 (Penta)', due: w(14) },
  { code: 'OPV3', label: 'OPV 3', due: w(14) },
  { code: 'PCV3', label: 'PCV 3', due: w(14) },
  { code: 'ROTA3', label: 'Rotavirus 3', due: w(14), maxAgeWeeks: 32 },
  { code: 'IPV1', label: 'IPV 1', due: w(14) },
  { code: 'VITA6', label: 'Vitamin A 100,000 IU', due: m(6), kind: 'supplement' },
  { code: 'MAL1', label: 'Malaria vaccine 1', due: m(6) },
  { code: 'MAL2', label: 'Malaria vaccine 2', due: m(7) },
  { code: 'IPV2', label: 'IPV 2', due: m(7) },
  { code: 'MR1', label: 'Measles-Rubella 1', due: m(9) },
  { code: 'YF', label: 'Yellow fever', due: m(9) },
  { code: 'MAL3', label: 'Malaria vaccine 3', due: m(9) },
  { code: 'VITA12', label: 'Vitamin A 200,000 IU', due: m(12), kind: 'supplement' },
  { code: 'MR2', label: 'Measles-Rubella 2', due: m(18) },
  { code: 'MENA', label: 'Meningitis A', due: m(18) },
  { code: 'MAL4', label: 'Malaria vaccine 4', due: m(18) },
  { code: 'VITA18', label: 'Vitamin A 200,000 IU', due: m(18), kind: 'supplement' },
  { code: 'VITA24', label: 'Vitamin A 200,000 IU', due: m(24), kind: 'supplement' },
  { code: 'VITA30', label: 'Vitamin A 200,000 IU', due: m(30), kind: 'supplement' },
  { code: 'VITA36', label: 'Vitamin A 200,000 IU', due: m(36), kind: 'supplement' },
  { code: 'VITA42', label: 'Vitamin A 200,000 IU', due: m(42), kind: 'supplement' },
  { code: 'VITA48', label: 'Vitamin A 200,000 IU', due: m(48), kind: 'supplement' },
  { code: 'VITA54', label: 'Vitamin A 200,000 IU', due: m(54), kind: 'supplement' },
  { code: 'VITA60', label: 'Vitamin A 200,000 IU', due: m(60), kind: 'supplement' },
  { code: 'HPV', label: 'HPV', due: m(108) },
]

export const OVERDUE_AFTER_DAYS = 28
export const DUE_SOON_DAYS = 14
const DAY = 86400000

// Dates are handled as UTC calendar days so a time zone never moves a due date.
const toUtc = (value) => {
  const [y, mo, d] = String(value).slice(0, 10).split('-').map(Number)
  return Date.UTC(y, mo - 1, d)
}
const iso = (ms) => new Date(ms).toISOString().slice(0, 10)

function addMonths(ms, months) {
  const d = new Date(ms)
  const target = d.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), target + 1, 0)).getUTCDate()
  return Date.UTC(d.getUTCFullYear(), target, Math.min(d.getUTCDate(), lastDay))
}

export function dueDateFor(dob, due) {
  const start = toUtc(dob)
  return iso(due.weeks != null ? start + due.weeks * 7 * DAY : addMonths(start, due.months))
}

/**
 * @param {{dateOfBirth: string, given?: Array<{vaccine_code: string, given_date: string}>, today?: string}} input
 * @returns {Array<{code, label, kind, dueDate, status, givenDate?}>} status: given | overdue | due | due_soon | upcoming | too_late
 */
export function buildChildSchedule({ dateOfBirth, given = [], today = new Date().toISOString().slice(0, 10) }) {
  if (!dateOfBirth) return []
  const givenBy = new Map(given.map((g) => [g.vaccine_code, g.given_date]))
  const now = toUtc(today)
  const dob = toUtc(dateOfBirth)
  return EPI_SCHEDULE.map((item) => {
    const dueDate = dueDateFor(dateOfBirth, item.due)
    const base = { code: item.code, label: item.label, kind: item.kind || 'vaccine', dueDate }
    if (givenBy.has(item.code)) return { ...base, status: 'given', givenDate: String(givenBy.get(item.code)).slice(0, 10) }
    const days = Math.round((toUtc(dueDate) - now) / DAY)
    if (item.maxAgeWeeks != null && now - dob > item.maxAgeWeeks * 7 * DAY) return { ...base, status: 'too_late' }
    if (days > DUE_SOON_DAYS) return { ...base, status: 'upcoming' }
    if (days > 0) return { ...base, status: 'due_soon' }
    return { ...base, status: -days > OVERDUE_AFTER_DAYS ? 'overdue' : 'due' }
  })
}

export function summarizeSchedule(rows) {
  const count = (status) => rows.filter((r) => r.status === status).length
  return { given: count('given'), overdue: count('overdue'), due: count('due') + count('due_soon'), tooLate: count('too_late') }
}

/** "3 months", "2 years 4 months", "5 weeks" - for the child header. */
export function ageText(dateOfBirth, today = new Date().toISOString().slice(0, 10)) {
  if (!dateOfBirth) return ''
  const days = Math.floor((toUtc(today) - toUtc(dateOfBirth)) / DAY)
  if (days < 0) return 'not yet born'
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`
  if (days < 84) return `${Math.floor(days / 7)} weeks`
  const start = new Date(toUtc(dateOfBirth))
  const end = new Date(toUtc(today))
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  if (end.getUTCDate() < start.getUTCDate()) months -= 1
  if (months < 24) return `${months} months`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest ? `${years} years ${rest} months` : `${years} years`
}
