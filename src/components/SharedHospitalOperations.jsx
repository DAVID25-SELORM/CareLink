import { useState } from 'react'
import { command } from '../platform/api'
import { supabase } from '../supabaseClient'
import { can } from '../platform/domain'

export default function SharedHospitalOperations({ tenant, role }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const invite = async () => {
    setBusy(true)
    try {
      const readiness = await command('platform_readiness', { p_tenant_id: tenant.id })
      await command('platform_invite_shared_administrator', { p_tenant_id: tenant.id, p_revision: readiness?.revision })
      // The invitation row only authorises acceptance; the login itself is created/invited server-side
      // (Edge Function with the service key) and emailed to the registered owner address.
      const { data, error } = await supabase.functions.invoke('invite-hospital-admin', { body: { tenant_id: tenant.id } })
      if (error) throw new Error(`Invitation registered, but the login email could not be sent (${error.message}). Check the invite-hospital-admin function and email settings, then try again.`)
      setMessage(data?.status === 'existing_user'
        ? `Invitation registered for ${data.email}. That address already has a login: the administrator signs in and accepts the hospital invitation.`
        : `Invitation email sent to ${data?.email}. The administrator opens the link, sets a password, then accepts the hospital invitation.`)
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  const prepare = async () => {
    setBusy(true)
    setMessage('')
    try {
      const readiness = await command('platform_readiness', { p_tenant_id: tenant.id })
      if (!readiness?.revision) throw new Error('Save the hospital requirements before preparing its workspace.')
      await command('platform_prepare_shared_hospital', { p_tenant_id: tenant.id, p_revision: readiness.revision })
      setMessage('Hospital configuration prepared. Administrator access, verification and owner approval are still required before launch.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  return <section className="pc-panel" style={{ padding: 20 }}>
    <h2>Shared workspace for {tenant.hospital_name}</h2>
    <p>This hospital uses the existing CareLink database and deployment.</p>
    <button disabled={busy || !can(role, 'onboarding.write')} onClick={prepare}>{busy ? 'Preparing…' : 'Prepare hospital configuration'}</button>
    {role === 'platform_owner' && <button disabled={busy} onClick={invite} className="ml-4">Create administrator login and send invitation</button>}
    {message && <p role="status">{message}</p>}
  </section>
}
