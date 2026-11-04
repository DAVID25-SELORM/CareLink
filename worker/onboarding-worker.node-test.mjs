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
