import { useEffect, useState } from 'react'

// Metadata only: a missing row or a matching payload cannot establish whether
// an earlier request committed. Do not offer a blind retry or discard action.
export default function HospitalQueueReview({ cache }) {
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    cache.heldMutations().then(rows => {
      if (active) { setEntries(rows); setError('') }
    }).catch(() => { if (active) setError('Unable to read held operations for this hospital.') })
    return () => { active = false }
  }, [cache, refresh])
  return <details className="border rounded bg-white p-3 m-2">
    <summary className="cursor-pointer font-medium">Held operations ({entries.length})</summary>
    <p className="text-sm my-2">These writes were dispatched but not confirmed. Check the clinical record and contact your administrator before entering the change again.</p>
    <button className="underline text-sm" onClick={() => setRefresh(value => value + 1)}>Refresh held operations</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!error && !entries.length && <p className="my-2 text-sm">No held operations found.</p>}
    <ul>{entries.map(entry => <li key={entry.id} className="border-t mt-2 pt-2 text-sm break-all">
      <p>{entry.table} · {entry.type}</p>
      <p>Record: {entry.recordId}</p>
      <p>Operation: {entry.id}</p>
      <p>Queued: {entry.created_at}</p>
    </li>)}</ul>
  </details>
}
