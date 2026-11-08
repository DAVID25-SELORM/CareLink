import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { useAuth } from '../hooks/useAuth'

const roles = ['admin', 'doctor', 'pharmacist', 'nurse', 'cashier', 'records_officer']

export default function HospitalStaff() {
  const { hospital } = useAuth()
  const [staff, setStaff] = useState([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const { data, error: failure } = await hospital.database.rpc('hospital_staff')
    if (failure) throw failure
    setStaff(data || [])
  }, [hospital])
  useEffect(() => {
    const timer = setTimeout(() => { load().catch(failure => setError(failure.message)) }, 0)
    return () => clearTimeout(timer)
  }, [load])
  const save = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error: failure } = await hospital.database.rpc('hospital_set_member', {
        p_tenant_id: hospital.hospitalId, p_user_id: editing.id,
        p_role: editing.role, p_status: editing.status, p_reason: reason,
      })
      if (failure) throw failure
      setEditing(null)
      setReason('')
      await load()
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <DashboardLayout><section className="p-6">
    <h1 className="text-2xl font-bold">Hospital staff</h1>
    <p className="my-3">Roles and access below apply only to {hospital.name}.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <table className="w-full text-left"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{staff.map(member => <tr key={member.id}>
        <td>{member.full_name}</td><td>{member.email}</td><td>{member.role}</td><td>{member.status}</td>
        <td>{hospital.role === 'admin' && <button onClick={() => { setEditing({ ...member }); setReason('') }} className="underline">Edit access</button>}</td>
      </tr>)}</tbody></table>
    {editing && <form onSubmit={save} className="border rounded p-4 mt-6">
      <h2>Edit access for {editing.full_name}</h2>
      <label className="block my-3">Role <select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}>{roles.map(role => <option key={role}>{role}</option>)}</select></label>
      <label className="block my-3">Status <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}><option>active</option><option>suspended</option></select></label>
      <label className="block my-3">Reason <input required minLength={5} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button disabled={busy} type="submit">{busy ? 'Saving…' : 'Save access'}</button>
      <button disabled={busy} type="button" onClick={() => setEditing(null)} className="ml-4">Cancel</button>
    </form>}
  </section></DashboardLayout>
}
