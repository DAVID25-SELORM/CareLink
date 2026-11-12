import { supabase, sharedHospitalMode } from '../supabaseClient'

// Realtime channels are denied in shared hospital mode (the hospital-scoped client has no
// realtime path), and supabase.channel() throws there. Fall back to polling so pages that
// want live data keep working. Returns an unsubscribe function.
export const POLL_INTERVAL_MS = 20000

export function subscribeToTable({ channel, table, filter, event = '*', onChange, refresh }) {
  if (sharedHospitalMode) {
    const timer = setInterval(() => { Promise.resolve(refresh?.()).catch(() => {}) }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }
  const subscription = supabase.channel(channel)
    .on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, onChange)
    .subscribe()
  return () => subscription.unsubscribe()
}
