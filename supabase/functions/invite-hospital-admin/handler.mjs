// Pure request handler so it can be unit-tested with node:test; index.ts wires it to Supabase.
// Security model: only a platform owner may call it, and the invited address is ALWAYS the hospital's
// registered owner_email read from the database, never an address supplied by the caller.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const json = (status, body, cors) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

export function createHandler({ allowedOrigins, getUser, isPlatformOwner, getTenant, inviteUser, redirectTo }) {
  return async function handle(request) {
    const origin = request.headers.get('Origin') || ''
    const cors = allowedOrigins.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Vary': 'Origin' }
      : { 'Vary': 'Origin' }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, cors)

    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return json(401, { error: 'Sign in required' }, cors)
    const user = await getUser(token)
    if (!user) return json(401, { error: 'Invalid session' }, cors)
    if (!(await isPlatformOwner(token))) return json(403, { error: 'Platform owner permission required' }, cors)

    let body
    try { body = await request.json() } catch { return json(400, { error: 'Invalid request' }, cors) }
    const tenantId = String(body?.tenant_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return json(400, { error: 'A valid hospital id is required' }, cors)

    const tenant = await getTenant(token, tenantId)
    if (!tenant) return json(404, { error: 'Hospital not found' }, cors)
    if (['archived', 'suspended'].includes(tenant.lifecycle_state)) return json(409, { error: 'Hospital is not available' }, cors)
    const email = String(tenant.owner_email || '').trim().toLowerCase()
    if (!EMAIL.test(email)) return json(422, { error: 'Register a valid administrator email on the hospital first' }, cors)

    const result = await inviteUser(email, redirectTo)
    if (result.error) return json(502, { error: 'Could not send the invitation email. Check the email (SMTP) settings.' }, cors)
    return json(200, { status: result.existing ? 'existing_user' : 'invited', email }, cors)
  }
}
