import { supabase } from '../supabaseClient'
import { withTimeout } from '../services/queryTimeout'

export async function query(request) {
  const { data, error } = await withTimeout(request, 'Platform request', 15000)
  if (error) {
    if (['42P01', '42703', 'PGRST202', 'PGRST205'].includes(error.code)) {
      throw new Error('Console setup is incomplete. The deployment administrator must apply the approved platform-console migration before this feature can be used.')
    }
    throw new Error(error.message || 'The request could not be completed.')
  }
  return data
}
export const list = (table) => query(supabase.from(table).select('*').order('created_at', { ascending: false }).limit(1000))
export const command = (name, args = {}) => query(supabase.rpc(name, args))
export const save = (table, values, id) => query(id ? supabase.from(table).update(values).eq('id', id).select().single() : supabase.from(table).insert(values).select().single())
export const queueJob = (kind, tenantId, payload, reason, key) => command('platform_request_job', {
  p_kind: kind, p_tenant_id: tenantId || null, p_payload: payload || {}, p_reason: reason, p_request_key: key,
})

export async function fetchAll(table) {
  // Exact totals and reports cannot silently truncate at the API's row limit.
  const rows = []
  for (let page = 0; ; page += 1) {
    const data = await query(supabase.from(table).select('*').order('created_at', { ascending: false }).order('id').range(page * 500, page * 500 + 499))
    rows.push(...data)
    if (data.length < 500) return rows
  }
}
