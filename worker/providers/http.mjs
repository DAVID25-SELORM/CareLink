export function safeProviderError(provider, status, body) {
  const error = new Error(`${provider} request failed (${status})`)
  error.status = status
  return error
}

export async function requestJson(base, path, { token, apiKey, method = 'GET', body, timeoutMs = 30000, fetchImpl = fetch } = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${base.replace(/\/$/, '')}${path}`, { method, redirect:'error', signal: controller.signal, headers: { Authorization: `Bearer ${token}`, ...(apiKey ? { apikey:apiKey } : {}), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await response.text(); let parsed = null
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = { message: text } }
    if (!response.ok) {
      const error = safeProviderError(base.includes('supabase') ? 'Supabase' : 'Vercel', response.status, parsed)
      // Only reads may be retried automatically. A failed write may have succeeded remotely.
      error.retryable = method === 'GET' && (response.status === 429 || response.status >= 500)
      throw error
    }
    return parsed
  } catch (error) {
    if (error.status) throw error
    const failure = new Error(method === 'GET' ? 'Provider read unavailable' : 'Provider write outcome unknown; reconcile before retry')
    failure.retryable = method === 'GET'
    throw failure
  } finally { clearTimeout(timer) }
}
