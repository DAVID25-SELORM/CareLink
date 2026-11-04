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

export async function executeJob(job, api = rpc) {
  if (!isSimulation()) throw new Error('Provider adapters are disabled. Set ONBOARDING_PROVIDER_MODE=simulation for local validation or configure approved adapters.')
  const token = job.lease_token
  const checkpoint = (name, result) => api('platform_checkpoint_job', { p_id: job.id, p_token: token, p_name: name, p_result: result })
  const stages = {
    provision: ['validate_configuration', 'create_supabase_project', 'apply_tenant_schema', 'create_vercel_project', 'deploy_pinned_revision', 'verify_tenant_identity'],
    invite_admin: ['validate_admin_email', 'create_invitation_request'],
    apply_modules: ['validate_licensed_modules', 'apply_configuration'],
    go_live: ['verify_readiness', 'mark_ready_for_launch'],
    backup: ['request_backup', 'verify_backup'],
    restore: ['validate_backup', 'verify_isolated_restore'],
  }
  for (const stage of (stages[job.kind] || ['execute_operation'])) {
    await checkpoint(stage, { mode: 'simulation', job: job.id, completed_at: new Date().toISOString() })
  }
  return { mode: 'simulation', kind: job.kind, stages: stages[job.kind] || ['execute_operation'] }
}

export async function runOnce(api = rpc) {
  const job = await api('platform_claim_job')
  if (!job) return false
  try {
    const result = await executeJob(job, api)
    await api('platform_finish_job', { p_id: job.id, p_token: job.lease_token, p_status: 'succeeded', p_error: null })
  } catch (error) {
    await api('platform_finish_job', { p_id: job.id, p_token: job.lease_token, p_status: 'failed', p_error: error.message })
  }
  return true
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!endpoint || !serviceKey) { console.error('Worker configuration is incomplete'); process.exitCode = 1 }
  else { console.log(`CareLink onboarding worker started (${isSimulation() ? 'simulation' : 'provider adapters disabled'})`); while (true) { await runOnce(); await new Promise(resolve => setTimeout(resolve, pollMs)) } }
}
