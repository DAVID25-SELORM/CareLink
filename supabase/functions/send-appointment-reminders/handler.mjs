// Pure request handler so it can be unit-tested with node:test; index.ts wires it to Supabase and the SMS provider.
// Safety rules: (1) the signed-in caller must hold a clinical or records role; (2) the phone number is ALWAYS read
// from the patient record, never supplied by the caller; (3) a patient is texted only if SMS consent was recorded;
// (4) an appointment is never texted twice (reminder_sent_at).
const ALLOWED_ROLES = ['admin', 'doctor', 'nurse', 'records_officer', 'receptionist']
const MAX_PER_CALL = 200
const json = (status, body, cors) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

/** Ghana numbers: 0244123456, 244123456, +233244123456 -> 233244123456. Anything else returns null. */
export function normalizeGhanaPhone(value) {
  const digits = String(value || '').replace(/[\s()-]/g, '').replace(/^\+/, '')
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`
  if (/^233\d{9}$/.test(digits)) return digits
  if (/^\d{9}$/.test(digits)) return `233${digits}`
  return null
}

export function buildReminderMessage({ patientName, hospitalName, date, time }) {
  const first = String(patientName || '').trim().split(/\s+/)[0] || 'Patient'
  const [y, m, d] = String(date).slice(0, 10).split('-')
  const when = `${d}/${m}/${y}${time ? ` at ${String(time).slice(0, 5)}` : ''}`
  const where = String(hospitalName || 'the hospital').slice(0, 40)
  return `Dear ${first}, this is a reminder of your appointment at ${where} on ${when}. Please arrive 15 minutes early. Call us if you cannot come.`
}

export function createHandler({ allowedOrigins, getUser, getRole, getHospitalName, listAppointments, markReminded, sendSms, now = () => new Date() }) {
  return async function handle(request) {
    const origin = request.headers.get('Origin') || ''
    const cors = allowedOrigins.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-carelink-hospital', 'Vary': 'Origin' }
      : { 'Vary': 'Origin' }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, cors)

    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return json(401, { error: 'Sign in required' }, cors)
    const context = { token, hospital: request.headers.get('x-carelink-hospital') || '' }
    const user = await getUser(token)
    if (!user) return json(401, { error: 'Invalid session' }, cors)
    const role = await getRole(context)
    if (!ALLOWED_ROLES.includes(role)) return json(403, { error: 'Your role cannot send reminders' }, cors)

    let body = {}
    try { body = await request.json() } catch { body = {} }
    const today = now().toISOString().slice(0, 10)
    const tomorrow = new Date(now().getTime() + 86400000).toISOString().slice(0, 10)
    const date = body?.date ? String(body.date) : tomorrow
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > new Date(now().getTime() + 7 * 86400000).toISOString().slice(0, 10)) {
      return json(400, { error: 'Choose a date from today up to 7 days ahead' }, cors)
    }

    let appointments
    try { appointments = await listAppointments(context, date) } catch (error) {
      const hint = /reminder_sent_at/.test(String(error?.message)) ? ' Apply migration 030 first.' : ''
      return json(500, { error: `Could not load appointments.${hint}` }, cors)
    }

    const hospitalName = await getHospitalName(context)
    const result = { date, sent: 0, already_reminded: 0, no_consent: 0, no_phone: 0, failed: 0, not_marked: 0, not_scheduled: 0, truncated: false }
    const eligible = []
    for (const a of appointments || []) {
      if (a.status !== 'scheduled') { result.not_scheduled++; continue }
      if (a.reminder_sent_at) { result.already_reminded++; continue }
      if (a.patients?.consent_sms !== true) { result.no_consent++; continue }
      const phone = normalizeGhanaPhone(a.patients?.phone)
      if (!phone) { result.no_phone++; continue }
      eligible.push({ a, phone })
    }
    if (eligible.length > MAX_PER_CALL) { eligible.length = MAX_PER_CALL; result.truncated = true }

    for (const { a, phone } of eligible) {
      const message = buildReminderMessage({ patientName: a.patients?.name, hospitalName, date: a.appointment_date, time: a.appointment_time })
      let ok = false
      try { ok = (await sendSms(phone, message)) === true } catch { ok = false }
      if (!ok) { result.failed++; continue }
      result.sent++
      try { await markReminded(context, a.id, now().toISOString()) } catch { result.not_marked++ }
    }
    return json(200, result, cors)
  }
}
