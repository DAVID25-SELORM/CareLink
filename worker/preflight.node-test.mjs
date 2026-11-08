import test from 'node:test'
import assert from 'node:assert/strict'
import { validateConfiguration } from './preflight.mjs'
import { safeProviderError, requestJson } from './providers/http.mjs'

const base = { SUPABASE_URL:'https://platform.example.test', SUPABASE_SERVICE_ROLE_KEY:'test' }
test('preflight defaults to simulation', () => assert.equal(validateConfiguration(base).mode,'simulation'))
test('preflight lists missing names without values', () => {
  assert.throws(() => validateConfiguration({...base,ONBOARDING_PROVIDER_MODE:'production'}),/Missing server configuration/)
})
test('production requires approval and immutable revision', () => {
  const env = {...base,ONBOARDING_PROVIDER_MODE:'production'}
  for (const key of ['SUPABASE_MANAGEMENT_TOKEN','SUPABASE_ORGANIZATION','SUPABASE_DEFAULT_REGION','VERCEL_TOKEN','VERCEL_TEAM_ID','VERCEL_GIT_REPO','TENANT_SCHEMA_SQL']) env[key]='test'
  env.ONBOARDING_DEPLOY_REF = 'main'
  assert.throws(() => validateConfiguration(env),/explicit server approval/)
  env.ONBOARDING_PROVISIONING_APPROVED='true'
  assert.throws(() => validateConfiguration(env),/immutable/)
  env.ONBOARDING_DEPLOY_REF='a'.repeat(40)
  assert.equal(validateConfiguration(env).configured,true)
})
test('provider errors never retain response secrets', () => {
  assert.equal(safeProviderError('Supabase',400,'postgres://sensitive@example.test').message,'Supabase request failed (400)')
})
test('tenant transport includes gateway key and refuses redirects', async () => {
  await requestJson('https://tenant.example.test','/rest/v1/', {token:'secret',apiKey:'secret',fetchImpl:async (url, options) => {
    assert.equal(options.headers.apikey,'secret')
    assert.equal(options.redirect,'error')
    return {ok:true,text:async () => '{}'}
  }})
})

test('read failures retry while ambiguous writes require reconciliation', async () => {
  for (const method of ['GET','POST']) {
    await assert.rejects(requestJson('https://api.example.test','/resource',{method,fetchImpl:async()=>{throw Error('sensitive network details')}}), error => {
      assert.equal(error.retryable,method==='GET')
      assert.equal(error.message.includes('sensitive'),false)
      return true
    })
    await assert.rejects(requestJson('https://api.example.test','/resource',{method,fetchImpl:async()=>({ok:false,status:503,text:async()=>'{"secret":"hidden"}'})}), error => {
      assert.equal(error.retryable,method==='GET')
      assert.equal(error.message.includes('hidden'),false)
      return true
    })
  }
})
