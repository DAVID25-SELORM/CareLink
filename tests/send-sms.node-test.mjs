import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../supabase/functions/send-sms/handler.mjs'

const ID = '11111111-1111-1111-1111-111111111111'
function setup({ role = 'admin', patient = { id: ID, name: 'Ama', phone: '0244123456', consent_sms: true }, sendOk = true } = {}) {
  const sent = []
  const handle = createHandler({
    allowedOrigins: ['https://app.test'],
    getUser: async (t) => (t === 'good' ? { id: 'u' } : null),
    getRole: async () => role,
    getPatient: async () => patient,
    sendSms: async (phone, message) => { sent.push({ phone, message }); return sendOk },
  })
  const call = (body, token = 'good') => handle(new Request('https://fn.test', { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://app.test' }, body: JSON.stringify(body) }))
  return { call, sent }
}

test('auth and role checks', async () => {
  assert.equal((await setup().call({}, '')).status, 401)
  assert.equal((await setup().call({}, 'bad')).status, 401)
  assert.equal((await setup({ role: 'pharmacist' }).call({ patient_id: ID, message: 'hi' })).status, 403)
})

test('sends to the number on the patient record, ignoring any number in the request', async () => {
  const s = setup()
  const res = await s.call({ patient_id: ID, message: 'Your results are ready.', phone: '0200000000', to: '0200000000' })
  assert.equal(res.status, 200)
  assert.deepEqual(s.sent, [{ phone: '233244123456', message: 'Your results are ready.' }])
})

test('refuses without consent, without a valid phone, or for an unknown patient', async () => {
  assert.equal((await setup({ patient: { id: ID, phone: '0244123456', consent_sms: null } }).call({ patient_id: ID, message: 'x' })).status, 409)
  assert.equal((await setup({ patient: { id: ID, phone: '12', consent_sms: true } }).call({ patient_id: ID, message: 'x' })).status, 422)
  assert.equal((await setup({ patient: null }).call({ patient_id: ID, message: 'x' })).status, 404)
})

test('validates the message and patient id', async () => {
  assert.equal((await setup().call({ patient_id: 'nope', message: 'x' })).status, 400)
  assert.equal((await setup().call({ patient_id: ID, message: '   ' })).status, 400)
  assert.equal((await setup().call({ patient_id: ID, message: 'a'.repeat(321) })).status, 400)
})

test('a provider failure is reported, not hidden', async () => {
  assert.equal((await setup({ sendOk: false }).call({ patient_id: ID, message: 'x' })).status, 502)
})
