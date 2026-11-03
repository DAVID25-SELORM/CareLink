import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import PlatformLayout from '../layouts/PlatformLayout'
import { command, fetchAll, queueJob, save } from '../platform/api'
import { Badge, Confirm, PageHeader, RecordForm, ResourceState, Table, dateLabel } from '../platform/ui'
import { useResource } from '../platform/useResource'

const loadHospitals = () => fetchAll('platform_tenants')
const fields = [
  { name:'hospital_name', label:'Hospital name', required:true }, { name:'owner_email', label:'Administrator email', required:true, type:'email' },
  { name:'region', label:'Region', required:true }, { name:'facility_type', label:'Facility type', default:'hospital', required:true },
]
export default function PlatformHospitals() {
  const [registrationKey, setRegistrationKey] = useState(() => crypto.randomUUID())
  const navigate = useNavigate()
  const resource = useResource(loadHospitals)
  const [query, setQuery] = useState(''); const [showForm, setShowForm] = useState(false); const [selected, setSelected] = useState(null); const [confirm, setConfirm] = useState(null)
  const rows = useMemo(() => (resource.data || []).filter(row => `${row.hospital_name} ${row.owner_email} ${row.region}`.toLowerCase().includes(query.toLowerCase())), [resource.data, query])
  const create = async values => { const id = await command('platform_register_hospital', { p_name: values.hospital_name, p_email: values.owner_email, p_region: values.region, p_request_key: registrationKey }); await save('platform_tenants', { facility_type: values.facility_type }, id); navigate(`/platform/onboarding?hospital=${id}`) }
  const update = async values => { await save('platform_tenants', values, selected.id); await resource.reload() }
  const operation = async (kind, reason) => { await queueJob(kind, selected.id, kind === 'apply_modules' ? { modules: selected.enabled_modules || [] } : {}, reason, crypto.randomUUID()); toast.success('Operation queued for server processing'); setConfirm(null) }
  return <PlatformLayout><PageHeader title="Hospitals" description="Register and manage independent hospital workspaces, administrators and lifecycle requests."><button className="pc-btn pc-primary" onClick={() => { setRegistrationKey(crypto.randomUUID()); setShowForm(true) }}>Register hospital</button></PageHeader>
    <ResourceState resource={resource}><div className="pc-toolbar"><input aria-label="Search hospitals" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search hospitals" /><span className="pc-muted">{rows.length} of {(resource.data || []).length} hospitals</span></div>
      <section className="pc-panel"><Table rows={rows} onRow={setSelected} columns={[{ key:'hospital_name', label:'Hospital' }, { key:'owner_email', label:'Administrator' }, { key:'region', label:'Region' }, { key:'lifecycle_state', label:'Lifecycle', render:r => <Badge>{r.lifecycle_state}</Badge> }, { key:'status', label:'Onboarding', render:r => <Badge>{r.status}</Badge> }, { key:'created_at', label:'Registered', render:r => dateLabel(r.created_at) }]} /></section></ResourceState>
    {showForm && <RecordForm title="Register hospital" fields={fields} onSave={create} onClose={() => setShowForm(false)} submitLabel="Create hospital" notice="Register the hospital once, then continue to its onboarding checklist." />}
    {selected && <RecordForm title={selected.hospital_name} initial={selected} fields={[...fields.filter(field => field.name !== 'owner_email'), { name:'contact_email', label:'Contact email', type:'email' }, { name:'public_url', label:'Workspace URL', type:'url' }, { name:'notes', label:'Internal notes', type:'textarea' }]} onSave={update} onClose={() => setSelected(null)} submitLabel="Save hospital" notice={<span>Lifecycle: <strong>{selected.lifecycle_state}</strong>. <Link to={`/platform/onboarding?hospital=${selected.id}`}>Open onboarding</Link></span>} />}
    {selected && <div className="pc-panel" style={{ padding:20 }}><h2>Operations for {selected.hospital_name}</h2><p className="pc-muted">Every remote operation is queued, idempotent and auditable.</p><div className="pc-actions" style={{ marginTop:12 }}><button onClick={() => setConfirm({ kind:'invite_admin', label:'Invite administrator' })}>Queue administrator invitation</button><button onClick={() => setConfirm({ kind:'provision', label:'Provision workspace' })}>Queue provisioning</button><button className="pc-danger" onClick={() => setConfirm({ kind:'suspend', label:'Request suspension', phrase:'SUSPEND' })}>Request suspension</button></div></div>}
    {confirm && <Confirm title={confirm.label} description="This creates a server-side job. It does not claim that the remote hospital has completed the operation." label="Queue operation" phrase={confirm.phrase} onClose={() => setConfirm(null)} onConfirm={reason => operation(confirm.kind, reason)} />}
  </PlatformLayout>
}
