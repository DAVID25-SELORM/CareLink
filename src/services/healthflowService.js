import { supabase } from '../supabaseClient'

// ─── HealthFlow Pharmacy Integration Service ──────────────────────────────────
// Bridges CareLink HMS with the HealthFlow Pharmacy POS (local branch server).
//
// Configuration is stored in integration_endpoints where:
//   endpoint_type = 'healthflow'
//   base_url      = http://server-pc:9090   (or whatever the server address is)
//   auth_config   = { token: "hf_local_..." }  (the x-branch-token)
//
// All functions return { success, ... } and never throw — callers get a
// graceful degradation message if HealthFlow is offline or not configured.

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getHealthFlowConfig() {
  try {
    const { data } = await supabase
      .from('integration_endpoints')
      .select('*')
      .eq('endpoint_type', 'healthflow')
      .eq('enabled', true)
      .single()
    return data || null
  } catch {
    return null
  }
}

async function hfFetch(baseUrl, token, path, options = {}) {
  const url = `${String(baseUrl).replace(/\/$/, '')}${path}`
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { 'x-branch-token': token } : {}),
    ...(options.headers || {}),
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const text = await res.text()
    let body = {}
    try { body = JSON.parse(text) } catch (_) { /* non-JSON */ }

    if (!res.ok) {
      throw new Error(body.error || body.message || `HTTP ${res.status}`)
    }
    return body
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ping HealthFlow to see if it's reachable.
 * Returns { reachable: true/false, mode, reason? }
 */
export async function pingHealthFlow() {
  const config = await getHealthFlowConfig()
  if (!config) {
    return { reachable: false, reason: 'HealthFlow integration not configured' }
  }
  try {
    const token = config.auth_config?.token
    const body = await hfFetch(config.base_url, token, '/health')
    // Update health status
    await supabase
      .from('integration_endpoints')
      .update({ health_status: 'healthy', last_health_check: new Date().toISOString(), last_error: null })
      .eq('id', config.id)
    return { reachable: true, mode: body.mode || 'local-branch-server', baseUrl: config.base_url }
  } catch (err) {
    await supabase
      .from('integration_endpoints')
      .update({ health_status: 'down', last_health_check: new Date().toISOString(), last_error: err.message })
      .eq('id', config.id)
      .catch(() => {})
    return { reachable: false, reason: err.message }
  }
}

/**
 * Look up an NHIS member via HealthFlow's CLAIM-it bridge.
 * This is the key call — it uses the already-working Westpoint CLAIM-it credentials.
 *
 * @param {string} nhisNumber  e.g. "P/NHF/12345/25"
 * @param {string} cardType    defaults to 'nhis'
 * @returns {object} { success, ccCode, memberName, memberNumber, schemeCode, ... }
 */
export async function lookupNhisMemberViaHealthFlow(nhisNumber, cardType = 'nhis') {
  const config = await getHealthFlowConfig()
  if (!config) {
    return {
      success: false,
      localOnly: true,
      message: 'HealthFlow integration not configured. Add it under Settings → Integrations.',
    }
  }
  try {
    const token = config.auth_config?.token
    const body = await hfFetch(config.base_url, token, '/api/nhia/member-lookup', {
      method: 'POST',
      body: JSON.stringify({ memberNumber: nhisNumber, cardType }),
    })
    return { success: true, ...(body.data || body) }
  } catch (err) {
    return { success: false, message: `NHIS lookup failed: ${err.message}` }
  }
}

/**
 * Search HealthFlow POS inventory for a drug name.
 * Shows real in-pharmacy stock so doctors don't prescribe out-of-stock items.
 *
 * @param {string} term  drug name search term
 * @returns {Array}      [{ id, name, stock, price, nhiaCode, unit, ... }]
 */
export async function searchHealthFlowInventory(term) {
  const config = await getHealthFlowConfig()
  if (!config) return []
  try {
    const token = config.auth_config?.token
    const body = await hfFetch(
      config.base_url,
      token,
      `/api/inventory/search?q=${encodeURIComponent(term || '')}&limit=20`,
    )
    return body.data || []
  } catch {
    return []
  }
}

/**
 * Submit a hospital NHIS claim through HealthFlow's CLAIM-it bridge.
 * HealthFlow auto-generates the CC code using Westpoint's credentials.
 *
 * @param {object} claimData
 *   Required: patientName, memberNumber, dispensingDate, medicines[]
 *   Optional: hin, diagnosis, services[], schemeCode, gender, dateOfBirth,
 *             referralFacility, claimPeriod, claimsOfficerName, ccCode
 *
 * medicines items: { name, nhiaCode, quantity, unitPrice, totalPrice }
 * services  items: { name, code, quantity, unitPrice, totalAmount }
 *
 * @returns {{ success, claimId, ccCode, message, rawData? }}
 */
export async function submitNhisClaimViaHealthFlow(claimData) {
  const config = await getHealthFlowConfig()
  if (!config) {
    return {
      success: false,
      localOnly: true,
      message: 'HealthFlow integration not configured. Configure it under Settings → Integrations.',
    }
  }
  try {
    const token = config.auth_config?.token
    const body = await hfFetch(config.base_url, token, '/api/nhis/pharmacy-claim', {
      method: 'POST',
      body: JSON.stringify({ ...claimData, organizationType: 'hospital' }),
    })
    const d = body.data || body
    return {
      success: true,
      claimId: d.id || d.claimId || null,
      ccCode: d.ccCode || d.cc_code || null,
      message: 'NHIS claim submitted via HealthFlow successfully',
      rawData: d,
    }
  } catch (err) {
    return { success: false, message: `HealthFlow claim submission failed: ${err.message}` }
  }
}

/**
 * Get the configured HealthFlow base URL (for display / deep-linking).
 * Returns null if not configured.
 */
export async function getHealthFlowBaseUrl() {
  const config = await getHealthFlowConfig()
  return config?.base_url || null
}
