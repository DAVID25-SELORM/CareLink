// One SMS to one patient. Safety rules: the caller must hold a staff role; the phone number is ALWAYS read from the
// patient record (the caller can never supply a number); the patient must have agreed to SMS; the message is
// length-limited plain text. Provider keys exist only in Edge Function secrets.
import { normalizeGhanaPhone } from '../_shared/sms.mjs'

const ALLOWED_ROLES = ['admin', 'doctor', 'nurse', 'records_officer', 'receptionist']
const MAX_MESSAGE = 320
const json = (status, body, cors) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

export function createHandler({ allowedOrigins, getUser, getRole, getPatient, sendSms }) {
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
    if (!ALLOWED_ROLES.includes(await getRole(context))) return json(403, { error: 'Your role cannot send SMS' }, cors)

    let body
    try { body = await request.json() } catch { return json(400, { error: 'Invalid request' }, cors) }
    const patientId = String(body?.patient_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(patientId)) return json(400, { error: 'Choose a patient' }, cors)
    // eslint-disable-next-line no-control-regex
    const message = String(body?.message ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!message) return json(400, { error: 'Write a message' }, cors)
    if (message.length > MAX_MESSAGE) return json(400, { error: `Message is too long (limit ${MAX_MESSAGE} characters)` }, cors)

    let patient
    try { patient = await getPatient(context, patientId) } catch { return json(500, { error: 'Could not load the patient. Apply migration 029 first.' }, cors) }
    if (!patient) return json(404, { error: 'Patient not found' }, cors)
    if (patient.consent_sms !== true) return json(409, { error: 'This patient has not agreed to SMS. Record consent on the patient page first.' }, cors)
    const phone = normalizeGhanaPhone(patient.phone)
    if (!phone) return json(422, { error: 'The patient has no valid Ghana phone number' }, cors)

    let ok = false
    try { ok = (await sendSms(phone, message)) === true } catch { ok = false }
    if (!ok) return json(502, { error: 'The SMS provider did not accept the message. Check the SMS settings on the server.' }, cors)
    return json(200, { status: 'sent', patient_id: patient.id, length: message.length }, cors)
  }
}
