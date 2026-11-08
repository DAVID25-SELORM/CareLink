// Immutable request scope. A hospital header selects context; database membership
// and RLS remain the authority. Never mutate a shared client's default headers.
export function createHospitalScope({ hospitalId, userId, getSession, fetchImpl = globalThis.fetch }) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuid.test(hospitalId || '') || !uuid.test(userId || '')) throw new Error('Valid hospital and user IDs required')
  let closed = false
  const requests = new Set()
  const requireSession = async () => {
    if (closed) throw new Error('Hospital session ended')
    const { data, error } = await getSession()
    if (closed || error || data?.session?.user?.id !== userId || !data?.session?.access_token) {
      throw new Error('Hospital session ended')
    }
    return data.session.access_token
  }
  return Object.freeze({
    hospitalId,
    userId,
    accessToken: requireSession,
    async fetch(input, init = {}) {
      await requireSession()
      const controller = new AbortController()
      requests.add(controller)
      const signal = init.signal || (input instanceof Request ? input.signal : null)
      const abort = () => controller.abort()
      if (signal?.aborted) abort()
      signal?.addEventListener('abort', abort, { once: true })
      const headers = new Headers(input instanceof Request ? input.headers : undefined)
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
      headers.set('x-carelink-hospital', hospitalId)
      try {
        const response = await fetchImpl(input, { ...init, headers, signal: controller.signal })
        // Do not deliver responses into a screen after logout/hospital switch.
        await requireSession()
        return response
      } finally {
        requests.delete(controller)
        signal?.removeEventListener('abort', abort)
      }
    },
    dispose() {
      closed = true
      for (const controller of requests) controller.abort()
      requests.clear()
    },
  })
}
