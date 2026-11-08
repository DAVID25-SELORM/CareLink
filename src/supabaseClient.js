import { createClient } from '@supabase/supabase-js'
import { createHospitalScope } from './services/hospitalScope.mjs'

/**
 * Supabase Client Configuration
 * 
 * Setup Instructions:
 * 1. Go to https://supabase.com
 * 2. Create a new project
 * 3. Copy your project URL and anon key
 * 4. Create .env file (copy from .env.example)
 * 5. Add your credentials
 * 
 * Author: David Gabion Selorm
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables! Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const sharedHospitalMode = import.meta.env.VITE_TENANCY_MODE === 'shared'
// Shared natural-key constraints include tenant_id; defaults supply the verified
// current hospital on insert. The profile is one row per hospital.
export const hospitalConflict = columns => !sharedHospitalMode ? columns
  : columns === 'singleton_key' ? 'tenant_id' : `tenant_id,${columns}`
export const authClient = createClient(supabaseUrl || '', supabaseAnonKey || '')
let hospitalDatabase = null
export function setHospitalDatabase(database) {
  hospitalDatabase = database
}
// Capture the immutable hospital client when a query is built. Old in-flight
// queries retain their disposed scope instead of following a later selection.
export const supabase = new Proxy(authClient, {
  get(target, key) {
    if (sharedHospitalMode && ['storage','channel','schema'].includes(key)) throw new Error('This access path requires hospital-specific authorization')
    if (sharedHospitalMode && (key === 'from' || key === 'rpc')) return (name, ...args) => {
      if (name.startsWith('platform_') || ['get_carelink_access', 'hospital_choices', 'hospital_pending_invitations', 'hospital_accept_invitation'].includes(name)) return target[key](name, ...args)
      if (!hospitalDatabase) throw new Error('Select a hospital before accessing clinical data')
      return hospitalDatabase[key](key === 'from' && name === 'users' ? 'hospital_users' : name, ...args)
    }
    const value = target[key]
    return typeof value === 'function' ? value.bind(target) : value
  },
})

// Prepared for the atomic shared-tenancy rollout. Existing screens keep their
// legacy client until database policies and hospital selection are converted.
// Only database methods are exposed: authentication stays with the main client,
// and realtime/offline access requires its own hospital isolation implementation.
export function createHospitalDatabase(hospitalId, userId) {
  const scope = createHospitalScope({ hospitalId, userId, getSession: () => authClient.auth.getSession() })
  const client = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    accessToken: scope.accessToken,
    global: { fetch: scope.fetch },
  })
  return Object.freeze({
    hospitalId, userId,
    from: client.from.bind(client),
    rpc: client.rpc.bind(client),
    dispose: scope.dispose,
  })
}

// Staff signup must not replace the administrator's authenticated session.
export const createStaffSignupClient = () => createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
