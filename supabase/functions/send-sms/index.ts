// Deploy: supabase functions deploy send-sms
// Secrets: SITE_URL, SMS_API_KEY, SMS_SENDER_ID (and optional SMS_PROVIDER). Needs migration 029 (consent_sms).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createHandler } from './handler.mjs'
import { makeSendSms } from '../_shared/provider.ts'

const url = Deno.env.get('SUPABASE_URL')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')!
const siteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '')

type Ctx = { token: string; hospital: string }
// Every database call runs as the signed-in caller, so row-level security and the hospital boundary apply.
const asCaller = ({ token, hospital }: Ctx) =>
  createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}`, ...(hospital ? { 'x-carelink-hospital': hospital } : {}) } },
    auth: { persistSession: false },
  })

Deno.serve(createHandler({
  allowedOrigins: [siteUrl],
  getUser: async (token: string) => (await asCaller({ token, hospital: '' }).auth.getUser(token)).data.user,
  getRole: async (ctx: Ctx) => (await asCaller(ctx).rpc('get_carelink_access')).data?.role,
  getPatient: async (ctx: Ctx, id: string) => {
    const { data, error } = await asCaller(ctx).from('patients').select('id, name, phone, consent_sms').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  sendSms: makeSendSms(),
}))
