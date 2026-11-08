import test from 'node:test'
import assert from 'node:assert/strict'
import { isProviderHealthy } from './onboarding-worker.mjs'

test('provider health requires explicit healthy status for every returned service', () => {
  assert.equal(isProviderHealthy({ status:'ACTIVE_HEALTHY' }), true)
  assert.equal(isProviderHealthy([{ status:'healthy' }, { status:'ACTIVE_HEALTHY' }]), true)
  for (const value of [null, {}, [], { status:'unhealthy' }, { message:'healthy' }, { status:'NOT_ACTIVE_HEALTHY' }, [{ status:'healthy' }, { status:'down' }]]) {
    assert.equal(isProviderHealthy(value), false)
  }
})
