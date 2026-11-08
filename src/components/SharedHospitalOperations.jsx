import { useState } from 'react'
import { command } from '../platform/api'
import { can } from '../platform/domain'

export default function SharedHospitalOperations({ tenant, role }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const invite = async () => {
    setBusy(true)
    try {
      const readiness = await command('platform_readiness', { p_tenant_id: tenant.id })
      await command('platform_invite_shared_administrator', { p_tenant_id: tenant.id, p_revision: readiness?.revision })
      setMessage(`Invitation registered for ${tenant.owner_email}. No email was sent. The administrator must sign in with that verified email address to accept it.`)
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
    {role === 'platform_owner' && <button disabled={busy} onClick={invite} className="ml-4">Register administrator invitation</button>}
    {message && <p role="status">{message}</p>}
  </section>
}
