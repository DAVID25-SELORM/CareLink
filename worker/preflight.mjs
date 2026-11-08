import { pathToFileURL } from 'node:url'

export function validateConfiguration(env = process.env) {
  const mode = env.ONBOARDING_PROVIDER_MODE || 'simulation'
  if (!['simulation','production'].includes(mode)) throw new Error('Invalid provider mode')
  const required = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']
  if (mode === 'production') required.push('SUPABASE_MANAGEMENT_TOKEN','SUPABASE_ORGANIZATION','SUPABASE_DEFAULT_REGION','VERCEL_TOKEN','VERCEL_TEAM_ID','VERCEL_GIT_REPO','ONBOARDING_DEPLOY_REF','TENANT_SCHEMA_SQL')
  const missing = required.filter(key => !env[key]?.trim())
  if (missing.length) throw new Error(`Missing server configuration: ${missing.join(', ')}`)
  const url = new URL(env.SUPABASE_URL)
  if (url.protocol !== 'https:' && !(mode === 'simulation' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Platform endpoint requires HTTPS')
  if (mode === 'production') {
    if (env.ONBOARDING_PROVISIONING_APPROVED !== 'true') throw new Error('Real provisioning requires explicit server approval')
    if (!/^[a-f0-9]{40}$/i.test(env.ONBOARDING_DEPLOY_REF)) throw new Error('Deployment must use an immutable 40-character commit SHA')
  }
  return { mode, configured:true }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(validateConfiguration())) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
