import test from 'node:test'
import assert from 'node:assert/strict'
import { provisioningIdentity, validateRecovery } from './recovery.mjs'

test('recovery rejects changed deployment or schema and unknown legacy checkpoints', () => {
  const identity=provisioningIdentity('select 1;', 'a'.repeat(40))
  const previous=[{name:'provisioning_identity',result:identity}]
  assert.doesNotThrow(()=>validateRecovery(previous,identity))
  assert.doesNotThrow(()=>validateRecovery([],identity))
  assert.throws(()=>validateRecovery(previous,provisioningIdentity('select 2;','a'.repeat(40))),/inputs changed/)
  assert.throws(()=>validateRecovery(previous,provisioningIdentity('select 1;','b'.repeat(40))),/inputs changed/)
  assert.throws(()=>validateRecovery([{name:'supabase_project',result:{ref:'existing'}}],identity),/manual reconciliation/)
  assert.throws(()=>provisioningIdentity('select 1;','main'),/Immutable/)
})

test('changed inputs stop execution before any provider or metadata mutation', async () => {
  const { executeJob } = await import('./onboarding-worker.mjs')
  const keys=['ONBOARDING_PROVIDER_MODE','ONBOARDING_PROVISIONING_APPROVED','TENANT_SCHEMA_SQL','ONBOARDING_DEPLOY_REF']
  const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]))
  Object.assign(process.env,{ONBOARDING_PROVIDER_MODE:'production',ONBOARDING_PROVISIONING_APPROVED:'true',TENANT_SCHEMA_SQL:'select 2;',ONBOARDING_DEPLOY_REF:'a'.repeat(40)})
  try {
    const fail=()=>assert.fail('must stop before mutation')
    await assert.rejects(executeJob({id:'job',kind:'provision'},fail,{
      supabase:{createProject:fail},vercel:{createProject:fail},
      readSteps:async()=>[{name:'provisioning_identity',result:provisioningIdentity('select 1;','a'.repeat(40))}]
    }),/inputs changed/)
  } finally {for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key]}}
})
