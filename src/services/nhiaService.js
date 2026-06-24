import { supabase } from '../supabaseClient'

// ─── NHIA eClaims Service ─────────────────────────────────────────────────────
// Submits claims to the NHIA eClaims portal when an endpoint is configured in
// integration_endpoints (endpoint_type = 'nhia_eclaims').
// Falls back to local-only if no endpoint is configured.

async function getNhiaEndpoint() {
  const { data } = await supabase
    .from('integration_endpoints')
    .select('*')
    .eq('endpoint_type', 'nhia_eclaims')
    .eq('enabled', true)
    .single()
  return data || null
}

function buildClaimPayload(claim) {
  return {
    claimNumber: claim.claim_number || claim.id,
    providerCode: claim.provider_code || '',
    patientNhisId: claim.patients?.nhis_number || '',
    patientName: claim.patients?.name || '',
    serviceDate: claim.service_date || claim.created_at?.split('T')[0],
    diagnosisCode: claim.diagnosis_code || '',
    totalAmount: parseFloat(claim.amount || 0),
    items: claim.claim_items || [],
    insuranceType: claim.insurance_type || 'nhis',
    submittedAt: new Date().toISOString(),
  }
}

export async function submitClaimToNhia(claim) {
  const endpoint = await getNhiaEndpoint()

  if (!endpoint) {
    return {
      success: false,
      localOnly: true,
      message: 'No NHIA eClaims endpoint configured. Claim marked submitted locally.',
    }
  }

  const payload = buildClaimPayload(claim)

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (endpoint.auth_type === 'api_key' && endpoint.auth_config?.api_key) {
    headers['X-API-Key'] = endpoint.auth_config.api_key
  } else if (endpoint.auth_type === 'bearer' && endpoint.auth_config?.token) {
    headers['Authorization'] = `Bearer ${endpoint.auth_config.token}`
  } else if (endpoint.auth_type === 'basic' && endpoint.auth_config?.username) {
    const b64 = btoa(`${endpoint.auth_config.username}:${endpoint.auth_config.password}`)
    headers['Authorization'] = `Basic ${b64}`
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout_ms || 30000)

    const response = await fetch(`${endpoint.base_url}/claims/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()
    let responseData = {}
    try { responseData = JSON.parse(responseText) } catch (_) { /* non-JSON response */ }

    if (response.ok) {
      // Update endpoint health status
      await supabase
        .from('integration_endpoints')
        .update({ health_status: 'healthy', last_health_check: new Date().toISOString(), last_error: null })
        .eq('id', endpoint.id)

      return {
        success: true,
        reference: responseData.referenceNumber || responseData.claimId || responseData.reference || null,
        message: responseData.message || 'Claim submitted to NHIA successfully',
        rawResponse: responseData,
      }
    } else {
      const errMsg = responseData.message || responseData.error || `HTTP ${response.status}`
      await supabase
        .from('integration_endpoints')
        .update({ health_status: 'degraded', last_health_check: new Date().toISOString(), last_error: errMsg })
        .eq('id', endpoint.id)

      return { success: false, message: errMsg }
    }
  } catch (err) {
    const errMsg = err.name === 'AbortError' ? 'NHIA API request timed out' : (err.message || 'Network error')

    await supabase
      .from('integration_endpoints')
      .update({ health_status: 'down', last_health_check: new Date().toISOString(), last_error: errMsg })
      .eq('id', endpoint.id)

    return { success: false, message: errMsg }
  }
}
