// Deploy: supabase functions deploy invite-hospital-admin
// Secret to set (Supabase dashboard -> Edge Functions -> Secrets): SITE_URL, e.g. https://care-link-l6u9.vercel.app
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createHandler } from './handler.mjs'

const url = Deno.env.get('SUPABASE_URL')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')!
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const siteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
const asCaller = (token: string) => createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

const handler = createHandler({
  allowedOrigins: [siteUrl],
  redirectTo: `${siteUrl}/reset-password`,
  getUser: async (token: string) => (await asCaller(token).auth.getUser(token)).data.user,
  isPlatformOwner: async (token: string) => (await asCaller(token).rpc('is_platform_owner')).data === true,
  getTenant: async (token: string, id: string) =>
    (await asCaller(token).from('platform_tenants').select('owner_email,lifecycle_state').eq('id', id).maybeSingle()).data,
  inviteUser: async (email: string, redirectTo: string) => {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    if (!error) return { existing: false }
    if (/already|registered|exists/i.test(error.message)) return { existing: true }
    return { error }
  },
})
Deno.serve(handler)
