export function safeProviderError(provider, status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body || {})
  return new Error(`${provider} request failed (${status}): ${text.replace(/(token|secret|password|key|authorization)[^,}]*[,:][^,}]*/gi, '$1=[redacted]').slice(0, 500)}`)
}

export async function requestJson(base, path, { token, method = 'GET', body, timeoutMs = 30000, fetchImpl = fetch } = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${base.replace(/\/$/, '')}${path}`, { method, signal: controller.signal, headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await response.text(); let parsed = null
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = { message: text } }
    if (!response.ok) throw safeProviderError(base.includes('supabase') ? 'Supabase' : 'Vercel', response.status, parsed)
    return parsed
  } finally { clearTimeout(timer) }
}
