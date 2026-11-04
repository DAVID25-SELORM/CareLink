import test from 'node:test'
import assert from 'node:assert/strict'
import { executeJob } from './onboarding-worker.mjs'

test('simulation worker checkpoints every provisioning stage', async () => {
  const calls = []
  const api = async (name, args) => { calls.push({ name, args }); return null }
  const old = process.env.ONBOARDING_PROVIDER_MODE
  process.env.ONBOARDING_PROVIDER_MODE = 'simulation'
  try {
    const result = await executeJob({ id: 'job-1', lease_token: 'lease-1', kind: 'provision' }, api)
    assert.equal(result.stages.length, 6)
    assert.equal(calls.length, 6)
    assert.equal(calls[0].args.p_token, 'lease-1')
  } finally { if (old === undefined) delete process.env.ONBOARDING_PROVIDER_MODE; else process.env.ONBOARDING_PROVIDER_MODE = old }
})

test('real provisioning path uses injected providers and only checkpoints identifiers', async () => {
  const old = process.env.ONBOARDING_PROVIDER_MODE; const oldSql = process.env.TENANT_SCHEMA_SQL; delete process.env.ONBOARDING_PROVIDER_MODE; process.env.TENANT_SCHEMA_SQL = 'create table public.test_marker(id uuid primary key);'
  const calls = []; const api = async (name, args) => { calls.push({ name, args }) }
  const supabase = { createProject: async () => ({ id:'sb-ref', name:'carelink-demo' }), health: async () => ({ status:'ACTIVE_HEALTHY' }), migrate: async () => ({}), apiKeys: async () => [{ type:'publishable', api_key:'public-key' }, { type:'secret', api_key:'secret-key' }] }
  const vercel = { createProject: async () => ({ id:'vc-project' }), setEnvironment: async () => ({}), deploy: async () => ({ id:'deploy-1', url:'https://example.test' }), deployment: async () => ({ readyState:'READY' }) }
  try { const result = await executeJob({ id:'job-2', tenant_id:'tenant-1', draft_revision:2, lease_token:'lease-2', kind:'provision', configuration:{ _tenant_name:'Demo Hospital', _region:'eu' } }, api, { supabase, vercel, verifyTenantIdentity:async () => ({ instance_kind:'tenant' }) }); assert.equal(result.provider, 'verified'); assert.equal(calls.some(call => JSON.stringify(call.args).includes('public-key')), false) } finally { if (old === undefined) delete process.env.ONBOARDING_PROVIDER_MODE; else process.env.ONBOARDING_PROVIDER_MODE = old; if (oldSql === undefined) delete process.env.TENANT_SCHEMA_SQL; else process.env.TENANT_SCHEMA_SQL = oldSql }
})
