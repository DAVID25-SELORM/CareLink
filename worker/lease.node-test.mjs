import test from 'node:test'
import assert from 'node:assert/strict'
import { executeJob, runOnce } from './onboarding-worker.mjs'

test('unset mode simulates without creating provider resources', async () => {
  delete process.env.ONBOARDING_PROVIDER_MODE
  const result = await executeJob({id:'job',kind:'provision',lease_token:'token'},async () => {})
  assert.equal(result.mode,'simulation')
})

test('production mode requires explicit approval before provider construction', async () => {
  process.env.ONBOARDING_PROVIDER_MODE = 'production'
  delete process.env.ONBOARDING_PROVISIONING_APPROVED
  try { await assert.rejects(executeJob({kind:'provision'}), /explicit server approval/) }
  finally { delete process.env.ONBOARDING_PROVIDER_MODE }
})

test('lost lease prevents execution and terminal writes', async () => {
  const calls = []
  await runOnce(async name => {
    calls.push(name)
    if (name === 'platform_claim_job') return {id:'job',lease_token:'token'}
    if (name === 'platform_job_heartbeat') return false
  }, async () => { assert.fail('must not execute after losing lease') })
  assert.deepEqual(calls,['platform_claim_job','platform_job_heartbeat'])
})

test('lease loss between stages stops checkpoint and success writes', async () => {
  let renewals = 0
  const writes = []
  await runOnce(async name => {
    if (name === 'platform_claim_job') return {id:'job',lease_token:'token'}
    if (name === 'platform_job_heartbeat') return ++renewals < 2
    writes.push(name)
  }, async (job, api) => { await api('platform_checkpoint_job',{}) })
  assert.deepEqual(writes,[])
})

test('transient read failure schedules retry without marking success', async () => {
  const terminal=[]
  await runOnce(async (name,args)=>{
    if(name==='platform_claim_job')return {id:'job',lease_token:'token'}
    if(name==='platform_job_heartbeat')return true
    if(name==='platform_finish_job')terminal.push(args)
  },async()=>{const error=new Error('temporary');error.retryable=true;throw error})
  assert.equal(terminal.length,1)
  assert.equal(terminal[0].p_status,'queued')
})
