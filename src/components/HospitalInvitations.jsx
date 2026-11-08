import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function HospitalInvitations() {
  const [invitations, setInvitations] = useState([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    supabase.rpc('hospital_pending_invitations').then(({ data, error }) => {
      if (!active) return
      if (error) setMessage(error.message)
      else setInvitations(data || [])
    }).catch(() => { if (active) setMessage('Unable to load invitations.') })
    return () => { active = false }
  }, [])
  const accept = async id => {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('hospital_accept_invitation', { p_id: id })
      if (error) throw error
      setInvitations(items => items.filter(item => item.id !== id))
      setMessage('Invitation accepted. Hospital access becomes available after launch approval. Reload to refresh available hospitals.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  return <section aria-label="Hospital invitations">
    {invitations.map(item => <button key={item.id} disabled={busy} onClick={() => accept(item.id)} className="block border rounded p-3 my-3">Accept administrator invitation: {item.hospital_name}</button>)}
    {message && <p role="status">{message}</p>}
  </section>
}
