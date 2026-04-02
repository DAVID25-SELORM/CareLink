export const QUERY_TIMEOUT_MS = 6000

export const withTimeout = (promise, label = 'Request', timeoutMs = QUERY_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`))
      }, timeoutMs)
    }),
  ])

export const isSupabaseFailure = (result) =>
  result?.status === 'rejected' || Boolean(result?.value?.error)

export const getSupabaseCount = (result) => {
  if (isSupabaseFailure(result)) {
    return 0
  }

  return result?.value?.count || 0
}

export const getSupabaseData = (result) => {
  if (isSupabaseFailure(result)) {
    return []
  }

  return Array.isArray(result?.value?.data) ? result.value.data : []
}
