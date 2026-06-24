import { supabase } from '../supabaseClient'

export const CC_CODE_VALID_DAYS = 1

export function getCcCodeExpiry(baseDate = new Date(), days = CC_CODE_VALID_DAYS) {
  const expiresAt = new Date(baseDate)
  expiresAt.setDate(expiresAt.getDate() + days)
  return expiresAt.toISOString()
}

export function getEncounterCcCode(encounter) {
  return encounter?.nhis_cc_code || null
}

export async function fetchEncounterCcCode(encounterId) {
  if (!encounterId) return null

  const { data, error } = await supabase
    .from('encounters')
    .select('nhis_cc_code')
    .eq('id', encounterId)
    .maybeSingle()

  if (error) {
    console.warn('Could not fetch encounter NHIS CC code:', error)
    return null
  }

  return data?.nhis_cc_code || null
}

export async function findActiveEncounterCcCode(encounterId) {
  if (!encounterId) return null

  const { data, error } = await supabase
    .from('nhis_cc_codes')
    .select('id, cc_code, nhis_member_number, status, expires_at, created_at')
    .eq('encounter_id', encounterId)
    .neq('status', 'voided')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('Could not fetch active NHIS CC code:', error)
    return null
  }

  return data || null
}

