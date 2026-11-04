import { SupabaseManagementAdapter } from './providers/supabase.mjs'
import { VercelAdapter } from './providers/vercel.mjs'
import { inviteAdministrator, verifyTenantIdentity } from './providers/tenant.mjs'
import { createHash } from 'node:crypto'

const endpoint = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const pollMs = Number(process.env.ONBOARDING_POLL_MS || 5000)
const isSimulation = () => process.env.ONBOARDING_PROVIDER_MODE === 'simulation'

async function rpc(name, args = {}) {
  if (!endpoint || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  const response = await fetch(`${endpoint}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify(args),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`RPC ${name} failed (${response.status}): ${body.slice(0, 500)}`)
  return body ? JSON.parse(body) : null
}
async function table(path) {
  if (!endpoint || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  const response = await fetch(`${endpoint}/rest/v1/${path}`, { headers:{ apikey:serviceKey, Authorization:`Bearer ${serviceKey}` } }); const body = await response.text()
  if (!response.ok) throw new Error(`Worker data lookup failed (${response.status})`)
  return body ? JSON.parse(body) : []
}
export async function executeJob(job, api = rpc, providers = {}) {
  if (!isSimulation() && job.kind === 'provision') {
    const cfg = job.configuration || {}; const supabase = providers.supabase || new SupabaseManagementAdapter(); const vercel = providers.vercel || new VercelAdapter()
    const previous = endpoint ? await table(`platform_job_steps?job_id=eq.${encodeURIComponent(job.id)}&select=name,result`) : []
    const prior = name => previous.find(step => step.name === name)?.result
    const projectName = `carelink-${String(cfg._tenant_name || job.tenant_id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45)}-${String(job.tenant_id).slice(0, 8)}`
    const project = prior('supabase_project')?.ref ? { id:prior('supabase_project').ref, name:prior('supabase_project').name || projectName } : await supabase.createProject({ name: projectName, region: cfg._region || process.env.SUPABASE_DEFAULT_REGION })
    await api('platform_record_binding', { p_tenant_id:job.tenant_id, p_state:{ supabase_project_ref:project.id || project.ref || project.slug, supabase_url:`https://${project.id || project.ref || project.slug}.supabase.co`, provider_status:'creating' } })
    await checkpoint(api, job, 'supabase_project', { provider:'supabase', ref:project.id || project.ref || project.slug, name:project.name || projectName })
    const health = prior('supabase_health') ? { status:'ACTIVE_HEALTHY' } : await waitForHealth(supabase, project.id || project.ref); if (!health) throw new Error('Supabase project did not become healthy before the worker deadline')
    await checkpoint(api, job, 'supabase_health', { status:'healthy' })
    if (!process.env.TENANT_SCHEMA_SQL) throw new Error('TENANT_SCHEMA_SQL is required; refusing to mark tenant schema complete')
    const schemaChecksum = createHash('sha256').update(process.env.TENANT_SCHEMA_SQL).digest('hex')
    if (!prior('tenant_schema')) { await supabase.migrate(project.id || project.ref, `carelink-${job.draft_revision}`, process.env.TENANT_SCHEMA_SQL); await api('platform_record_schema', { p_tenant_id:job.tenant_id, p_name:`carelink-${job.draft_revision}`, p_checksum:schemaChecksum, p_status:'applied', p_error:null }) }
    await checkpoint(api, job, 'tenant_schema', { migration:`carelink-${job.draft_revision}` })
    const vercelProject = await vercel.createProject(projectName); const publishable = await supabase.apiKeys(project.id || project.ref); const publicKey = (publishable || []).find?.(key => key.type === 'publishable')?.api_key || publishable?.publishable?.api_key
    const tenantSecret = (publishable || []).find?.(key => key.type === 'secret' || key.type === 'service_role')?.api_key || publishable?.secret?.api_key || publishable?.service_role?.api_key
    if (!publicKey) throw new Error('Supabase publishable key was not returned')
    await vercel.setEnvironment(vercelProject.id || vercelProject.name, 'VITE_SUPABASE_URL', `https://${project.id || project.ref}.supabase.co`)
    await vercel.setEnvironment(vercelProject.id || vercelProject.name, 'VITE_SUPABASE_PUBLISHABLE_KEY', publicKey)
    const deployment = prior('vercel_deployment')?.id ? prior('vercel_deployment') : await vercel.deploy(projectName, process.env.ONBOARDING_DEPLOY_REF || 'main')
    await checkpoint(api, job, 'vercel_deployment', { provider:'vercel', id:deployment.id, url:deployment.url })
    const deployed = await vercel.deployment(deployment.id); if (!['READY','ready'].includes(deployed?.readyState || deployed?.state)) throw new Error('Vercel deployment is not ready')
    if (!tenantSecret) throw new Error('Tenant secret key was not returned for identity verification')
    await (providers.verifyTenantIdentity || verifyTenantIdentity)({ projectUrl:`https://${project.id || project.ref}.supabase.co`, secretKey:tenantSecret })
    await checkpoint(api, job, 'tenant_identity', { instance_kind:'tenant' })
    await api('platform_record_binding', { p_tenant_id:job.tenant_id, p_state:{ supabase_project_ref:project.id || project.ref || project.slug, supabase_url:`https://${project.id || project.ref || project.slug}.supabase.co`, vercel_project_id:vercelProject.id, vercel_project_name:vercelProject.name || projectName, deployment_id:deployment.id, deployment_url:deployment.url, provider_status:'ready', health_status:'healthy', schema_version:`carelink-${job.draft_revision}`, schema_checksum:schemaChecksum, provisioned_at:new Date().toISOString(), estimated_monthly_cost:process.env.DEFAULT_MONTHLY_COST || null, cost_currency:process.env.DEFAULT_COST_CURRENCY || null } })
    if (process.env.DEFAULT_MONTHLY_COST && process.env.DEFAULT_COST_CURRENCY) {
      const now = new Date()
      const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
      await api('platform_record_cost', { p_tenant_id:job.tenant_id, p_provider:'other', p_period:period, p_amount:Number(process.env.DEFAULT_MONTHLY_COST), p_currency:process.env.DEFAULT_COST_CURRENCY, p_source:'configured estimate' })
    }
    await api('platform_record_health', { p_tenant_id:job.tenant_id, p_status:'healthy', p_latency:0, p_error:null })
    await checkpoint(api, job, 'deployment_health', { status:'ready' })
    return { provider:'verified', supabase_ref:project.id || project.ref, vercel_project:vercelProject.id || vercelProject.name, deployment_id:deployment.id }
  }
  if (!isSimulation() && job.kind === 'invite_admin') {
    const previous = await table(`platform_jobs?tenant_id=eq.${encodeURIComponent(job.tenant_id)}&kind=eq.provision&status=eq.succeeded&order=created_at.desc&limit=1`)
    const provisionJob = previous[0]; if (!provisionJob) throw new Error('A verified provisioning job is required before inviting an administrator')
    const steps = await table(`platform_job_steps?job_id=eq.${encodeURIComponent(provisionJob.id)}&name=eq.supabase_project&limit=1`)
    const ref = steps[0]?.result?.ref; if (!ref) throw new Error('Provisioning binding is incomplete')
    const management = providers.supabase || new SupabaseManagementAdapter(); const keys = await management.apiKeys(ref); const secret = (keys || []).find?.(key => key.type === 'secret' || key.type === 'service_role')?.api_key || keys?.secret?.api_key
    if (!secret) throw new Error('Tenant secret key was not returned')
    const result = await inviteAdministrator({ projectUrl:`https://${ref}.supabase.co`, secretKey:secret, email:job.configuration?._admin_email })
    await api('platform_record_binding', { p_tenant_id:job.tenant_id, p_state:{ admin_invitation_status:'requested' } })
    await checkpoint(api, job, 'administrator_invitation', { status:'requested', email_hash:Buffer.from(String(job.configuration?._admin_email || '')).toString('base64url').slice(0, 16) })
    return { provider:'verified', invitation:'requested', result: result?.id ? 'accepted-by-provider' : 'requested' }
  }
  if (!isSimulation()) throw new Error('Provider adapter for this job kind is not configured; no infrastructure was changed')
  const token = job.lease_token
  const stages = {
    provision: ['validate_configuration', 'create_supabase_project', 'apply_tenant_schema', 'create_vercel_project', 'deploy_pinned_revision', 'verify_tenant_identity'],
    invite_admin: ['validate_admin_email', 'create_invitation_request'],
    apply_modules: ['validate_licensed_modules', 'apply_configuration'],
    go_live: ['verify_readiness', 'mark_ready_for_launch'],
    backup: ['request_backup', 'verify_backup'],
    restore: ['validate_backup', 'verify_isolated_restore'],
  }
  for (const stage of (stages[job.kind] || ['execute_operation'])) {
    await checkpoint(api, job, stage, { mode: 'simulation', job: job.id, completed_at: new Date().toISOString() })
  }
  return { mode: 'simulation', kind: job.kind, stages: stages[job.kind] || ['execute_operation'] }
}

async function checkpoint(api, job, name, result) { return api('platform_checkpoint_job', { p_id:job.id, p_token:job.lease_token, p_name:name, p_result:result }) }
async function waitForHealth(adapter, ref) {
  const attempts = Number(process.env.ONBOARDING_HEALTH_ATTEMPTS || 8); const delay = Number(process.env.ONBOARDING_HEALTH_DELAY_MS || 15000)
  for (let attempt = 0; attempt < attempts; attempt += 1) { const health = await adapter.health(ref); if (JSON.stringify(health).match(/ACTIVE_HEALTHY|healthy/i)) return health; if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, delay)) }
  return null
}

export async function runOnce(api = rpc) {
  const job = await api('platform_claim_job')
  if (!job) return false
  const heartbeat = setInterval(() => { api('platform_job_heartbeat', { p_id:job.id, p_token:job.lease_token }).catch(() => {}) }, 30000)
  try {
    const result = await executeJob(job, api)
    await api('platform_finish_job', { p_id: job.id, p_token: job.lease_token, p_status: 'succeeded', p_error: null })
  } catch (error) {
    try { if (job.tenant_id) await api('platform_record_binding', { p_tenant_id:job.tenant_id, p_state:{ provider_status:'failed', last_error:error.message } }) } catch { /* preserve original failure */ }
    await api('platform_finish_job', { p_id: job.id, p_token: job.lease_token, p_status: 'failed', p_error: error.message })
  } finally {
    clearInterval(heartbeat)
  }
  return true
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!endpoint || !serviceKey) { console.error('Worker configuration is incomplete'); process.exitCode = 1 }
  else { console.log(`CareLink onboarding worker started (${isSimulation() ? 'simulation' : 'provider adapters disabled'})`); while (true) { await runOnce(); await new Promise(resolve => setTimeout(resolve, pollMs)) } }
}

