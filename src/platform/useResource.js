import { useCallback, useEffect, useRef, useState } from 'react'

export function useResource(load) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const revision = useRef(0)
  const reload = useCallback(async () => {
    const request = ++revision.current
    setLoading(true)
    setError('')
    try {
      const value = await load()
      if (request === revision.current) setData(value)
    } catch (err) {
      if (request === revision.current) setError(err.message)
    } finally {
      if (request === revision.current) setLoading(false)
    }
  }, [load])
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) reload() })
    return () => { active = false; revision.current += 1 } // eslint-disable-line react-hooks/exhaustive-deps
  }, [reload])
  return { data, loading, error, reload }
}
