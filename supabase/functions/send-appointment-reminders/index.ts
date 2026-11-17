// Deploy: supabase functions deploy send-appointment-reminders
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   SITE_URL        e.g. https://care-link-l6u9.vercel.app
//   SMS_API_KEY     your SMS provider key (never put it in the database or the browser)
//   SMS_SENDER_ID   approved sender name, 11 characters or fewer
//   SMS_PROVIDER    optional, defaults to "arkesel"
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by the platform. Needs migration 030.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createHandler } from './handler.mjs'

const url = Deno.env.get('SUPABASE_URL')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')!
const siteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
const apiKey = Deno.env.get('SMS_API_KEY') || ''
const senderId = Deno.env.get('SMS_SENDER_ID') || ''
const provider = (Deno.env.get('SMS_PROVIDER') || 'arkesel').toLowerCase()

type Ctx = { token: string; hospital: string }
// Every database call runs as the signed-in caller, so row-level security and the hospital boundary apply.
const asCaller = ({ token, hospital }: Ctx) =>
  createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}`, ...(hospital ? { 'x-carelink-hospital': hospital } : {}) } },
    auth: { persistSession: false },
  })

// Arkesel v2 adapter. Check the request shape against the provider's current API docs before going live.
async function sendSms(phone: string, message: string): Promise<boolean> {
  if (provider !== 'arkesel' || !apiKey || !senderId) return false
  const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: senderId, message, recipients: [phone] }),
  })
  const result = await response.json().catch(() => ({}))
  return response.ok && result?.status === 'success'
}

const handler = createHandler({
  allowedOrigins: [siteUrl],
  getUser: async (token: string) => (await asCaller({ token, hospital: '' }).auth.getUser(token)).data.user,
  getRole: async (ctx: Ctx) => (await asCaller(ctx).rpc('get_carelink_access')).data?.role,
  getHospitalName: async (ctx: Ctx) =>
    (await asCaller(ctx).from('hospital_profile').select('hospital_name').limit(1).maybeSingle()).data?.hospital_name || '',
  listAppointments: async (ctx: Ctx, date: string) => {
    const { data, error } = await asCaller(ctx)
      .from('appointments')
      .select('id, appointment_date, appointment_time, status, reminder_sent_at, patients(name, phone, consent_sms)')
      .eq('appointment_date', date)
    if (error) throw error
    return data
  },
  markReminded: async (ctx: Ctx, id: string, at: string) => {
    const { error } = await asCaller(ctx).from('appointments').update({ reminder_sent_at: at }).eq('id', id)
    if (error) throw error
  },
  sendSms,
})
Deno.serve(handler)
