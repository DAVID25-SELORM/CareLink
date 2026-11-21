import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler, normalizeGhanaPhone, buildReminderMessage } from '../supabase/functions/send-appointment-reminders/handler.mjs'

const NOW = new Date('2026-11-17T08:00:00Z')
const patient = (over = {}) => ({ name: 'Kofi Mensah', phone: '0244123456', consent_sms: true, ...over })
const appt = (id, over = {}) => ({ id, appointment_date: '2026-11-18', appointment_time: '09:30:00', status: 'scheduled', reminder_sent_at: null, patients: patient(), ...over })

function setup({ role = 'nurse', appointments = [], sendOk = true } = {}) {
  const sent = []; const marked = []
  const handle = createHandler({
    allowedOrigins: ['https://app.test'],
    now: () => NOW,
    getUser: async (t) => (t === 'good' ? { id: 'u1' } : null),
    getRole: async () => role,
    getHospitalName: async () => 'Health Medics',
    listAppointments: async () => appointments,
    markReminded: async (_c, id) => { marked.push(id) },
    sendSms: async (phone, message) => { sent.push({ phone, message }); return sendOk },
  })
  const call = (body = {}, token = 'good', method = 'POST') =>
    handle(new Request('https://fn.test', { method, headers: { Authorization: `Bearer ${token}`, Origin: 'https://app.test' }, body: method === 'POST' ? JSON.stringify(body) : undefined }))
  return { call, sent, marked }
}

test('normalises Ghana numbers and rejects the rest', () => {
  assert.equal(normalizeGhanaPhone('0244 123 456'), '233244123456')
  assert.equal(normalizeGhanaPhone('+233244123456'), '233244123456')
  assert.equal(normalizeGhanaPhone('244123456'), '233244123456')
  assert.equal(normalizeGhanaPhone('12345'), null)
  assert.equal(normalizeGhanaPhone(null), null)
})

test('message names the hospital, date and time', () => {
  const m = buildReminderMessage({ patientName: 'Kofi Mensah', hospitalName: 'Health Medics', date: '2026-11-18', time: '09:30:00' })
  assert.match(m, /Dear Kofi/); assert.match(m, /Health Medics/); assert.match(m, /18\/11\/2026 at 09:30/)
})

test('rejects missing session, bad session and disallowed role', async () => {
  assert.equal((await setup().call({}, '')).status, 401)
  assert.equal((await setup().call({}, 'bad')).status, 401)
  assert.equal((await setup({ role: 'cashier' }).call()).status, 403)
})

test('sends only to consenting, valid, unreminded, scheduled appointments and marks them', async () => {
  const s = setup({ appointments: [
    appt('ok'),
    appt('done', { reminder_sent_at: '2026-11-16T10:00:00Z' }),
    appt('nocons', { patients: patient({ consent_sms: null }) }),
    appt('nophone', { patients: patient({ phone: 'abc' }) }),
    appt('cancelled', { status: 'cancelled' }),
  ] })
  const res = await s.call(); const body = await res.json()
  assert.equal(res.status, 200)
  assert.deepEqual([body.sent, body.already_reminded, body.no_consent, body.no_phone, body.not_scheduled], [1, 1, 1, 1, 1])
  assert.equal(s.sent.length, 1); assert.equal(s.sent[0].phone, '233244123456')
  assert.deepEqual(s.marked, ['ok'])
})

test('a provider failure is counted and the appointment is not marked', async () => {
  const s = setup({ appointments: [appt('a')], sendOk: false })
  const body = await (await s.call()).json()
  assert.equal(body.failed, 1); assert.equal(body.sent, 0); assert.deepEqual(s.marked, [])
})

test('only today up to 7 days ahead is accepted', async () => {
  assert.equal((await setup().call({ date: '2026-11-16' })).status, 400)
  assert.equal((await setup().call({ date: '2026-12-30' })).status, 400)
  assert.equal((await setup().call({ date: 'tomorrow' })).status, 400)
  assert.equal((await setup().call({ date: '2026-11-20' })).status, 200)
})
