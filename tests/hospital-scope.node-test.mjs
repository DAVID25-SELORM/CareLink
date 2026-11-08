import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHospitalScope } from '../src/services/hospitalScope.mjs'
const userId = '00000000-0000-0000-0000-000000000001'
const hospitalA = '10000000-0000-0000-0000-000000000001'
const hospitalB = '10000000-0000-0000-0000-000000000002'
const session = () => ({ data: { session: { user: { id: userId }, access_token: 'synthetic-test-token' } } })

test('concurrent hospital requests cannot overwrite one another or spoof the header', async () => {
  const received = []
  const fetchImpl = async (_, options) => { received.push(options.headers.get('x-carelink-hospital')); return new Response('{}') }
  const a = createHospitalScope({ hospitalId: hospitalA, userId, getSession: session, fetchImpl })
  const b = createHospitalScope({ hospitalId: hospitalB, userId, getSession: session, fetchImpl })
  await Promise.all([a.fetch('https://example.test', { headers: { 'x-carelink-hospital': hospitalB } }), b.fetch('https://example.test')])
  assert.deepEqual(received, [hospitalA, hospitalB])
})
test('old user scope cannot send a request as another signed-in user', async () => {
  let called = false
  const scope = createHospitalScope({ hospitalId: hospitalA, userId, getSession: () => ({ data: { session: { user: { id: hospitalB }, access_token: 'test' } } }), fetchImpl: () => { called = true } })
  await assert.rejects(scope.fetch('https://example.test'), /session ended/)
  assert.equal(called, false)
})
test('logout during a request suppresses its response', async () => {
  let loggedOut = false
  const scope = createHospitalScope({ hospitalId: hospitalA, userId, getSession: () => loggedOut ? { data: { session: null } } : session(), fetchImpl: async () => { loggedOut = true; return new Response('{}') } })
  await assert.rejects(scope.fetch('https://example.test'), /session ended/)
})
test('disposing a scope aborts in-flight requests and rejects future requests', async () => {
  let started
  const ready = new Promise(resolve => { started = resolve })
  const scope = createHospitalScope({ hospitalId: hospitalA, userId, getSession: session, fetchImpl: (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); started()
  }) })
  const request = scope.fetch('https://example.test')
  await ready
  scope.dispose()
  await assert.rejects(request, /aborted/)
  await assert.rejects(scope.accessToken(), /session ended/)
})
test('invalid context never creates a scope', () => {
  assert.throws(() => createHospitalScope({ hospitalId: 'forged', userId, getSession: session }), /Valid hospital/)
})
