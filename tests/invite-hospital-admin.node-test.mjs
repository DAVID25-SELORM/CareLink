import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../supabase/functions/invite-hospital-admin/handler.mjs'

const ORIGIN = 'https://app.example'
const TENANT = '11111111-1111-1111-1111-111111111111'
const make = (overrides = {}) => {
  const calls = { invite: [] }
  const handle = createHandler({
    allowedOrigins: [ORIGIN], redirectTo: `${ORIGIN}/reset-password`,
    getUser: async () => ({ id: 'owner' }), isPlatformOwner: async () => true,
    getTenant: async () => ({ owner_email: ' Admin@Hospital.org ', lifecycle_state: 'onboarding' }),
    inviteUser: async (email, redirect) => { calls.invite.push([email, redirect]); return { existing: false } },
    ...overrides,
  })
  return { handle, calls }
}
const post = (body, headers = {}) => new Request('https://fn/invite', { method: 'POST', headers: { Origin: ORIGIN, Authorization: 'Bearer t', ...headers }, body: JSON.stringify(body) })

test('invites the registered owner email, normalised, and never a caller-supplied one', async () => {
  const { handle, calls } = make()
  const res = await handle(post({ tenant_id: TENANT, email: 'attacker@evil.com' }))
  assert.equal(res.status, 200)
  assert.deepEqual(calls.invite, [['admin@hospital.org', `${ORIGIN}/reset-password`]])
  assert.deepEqual(await res.json(), { status: 'invited', email: 'admin@hospital.org' })
})
test('requires a session', async () => {
  const { handle } = make()
  assert.equal((await handle(post({ tenant_id: TENANT }, { Authorization: '' }))).status, 401)
  assert.equal((await make({ getUser: async () => null }).handle(post({ tenant_id: TENANT }))).status, 401)
})
test('requires the platform owner role', async () => {
  const { handle, calls } = make({ isPlatformOwner: async () => false })
  assert.equal((await handle(post({ tenant_id: TENANT }))).status, 403)
  assert.equal(calls.invite.length, 0)
})
test('validates the hospital', async () => {
  assert.equal((await make().handle(post({ tenant_id: 'nope' }))).status, 400)
  assert.equal((await make({ getTenant: async () => null }).handle(post({ tenant_id: TENANT }))).status, 404)
  assert.equal((await make({ getTenant: async () => ({ owner_email: 'a@b.co', lifecycle_state: 'suspended' }) }).handle(post({ tenant_id: TENANT }))).status, 409)
  assert.equal((await make({ getTenant: async () => ({ owner_email: 'not-an-email', lifecycle_state: 'onboarding' }) }).handle(post({ tenant_id: TENANT }))).status, 422)
})
test('reports an existing user and email failures without leaking details', async () => {
  const existing = await make({ inviteUser: async () => ({ existing: true }) }).handle(post({ tenant_id: TENANT }))
  assert.equal((await existing.json()).status, 'existing_user')
  const failed = await make({ inviteUser: async () => ({ error: { message: 'smtp secret detail' } }) }).handle(post({ tenant_id: TENANT }))
  assert.equal(failed.status, 502)
  assert.doesNotMatch(JSON.stringify(await failed.json()), /secret/)
})
test('only allows CORS from the app origin and handles preflight', async () => {
  const { handle } = make()
  const ok = await handle(new Request('https://fn', { method: 'OPTIONS', headers: { Origin: ORIGIN } }))
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  const bad = await handle(new Request('https://fn', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }))
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal((await handle(new Request('https://fn', { method: 'GET', headers: { Origin: ORIGIN } }))).status, 405)
})
