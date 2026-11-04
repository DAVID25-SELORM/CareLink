import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { command, query } from './api'
import { supabase } from '../supabaseClient'
import { MODULES } from './domain'
import { useResource } from './useResource'
import { ResourceState, titleCase } from './ui'

const steps = ['Registration', 'Requirements', 'Commercial approval', 'Provisioning', 'Configuration', 'Verification', 'Training', 'Go-live review']
export default function OnboardingWizard({ hospital, editable }) {
  const load = useCallback(() => query(supabase.from('platform_onboarding_drafts').select('*').eq('tenant_id', hospital.id).maybeSingle()), [hospital.id])
  const resource = useResource(load)
  return <section className="pc-panel pc-panel-body"><h2>Onboarding workspace</h2><ResourceState resource={resource}>
    {!resource.loading && !resource.error && <DraftEditor key={`${hospital.id}:${resource.data?.revision || 0}`} hospital={hospital} draft={resource.data} editable={editable} reload={resource.reload} />}
  </ResourceState></section>
}
function DraftEditor({ hospital, draft, editable, reload }) {
  const [step, setStep] = useState(draft?.step || 0)
  const [values, setValues] = useState(draft?.requirements || {})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const change = (key, value) => { setValues(v => ({ ...v, [key]: value })); setDirty(true) }
  const move = value => { setStep(value); setDirty(true); setMessage('') }
  const save = async () => {
    setBusy(true); setMessage('')
    try { await command('platform_save_onboarding_draft', { p_tenant_id: hospital.id, p_revision: draft?.revision || 0, p_step: step, p_requirements: values }); await reload() }
    catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  const field = (name, label, type='text') => <label>{label}{type === 'textarea' ? <textarea maxLength={4000} disabled={!editable || busy} value={values[name] || ''} onChange={e => change(name,e.target.value)} /> : <input type={type} disabled={!editable || busy} value={values[name] || ''} onChange={e => change(name,e.target.value)} />}</label>
  return <div className="pc-form" style={{ marginTop:16 }}>
    <p className="pc-muted">Save your draft before leaving this hospital. These notes describe requested setup; they do not activate modules or approve launch.</p>
    <nav className="pc-actions" aria-label="Onboarding steps">{steps.map((label,index) => <button key={label} disabled={busy} aria-current={index===step ? 'step' : undefined} className={index===step ? 'pc-primary' : ''} onClick={() => move(index)}>{index+1}. {label}</button>)}</nav>
    <h3>Step {step+1} of 8: {steps[step]}</h3>
    {step===0 && <><p><strong>{hospital.hospital_name}</strong> · {hospital.owner_email}</p><p>Region: {hospital.region || 'Not set'} · Facility: {hospital.facility_type}</p>{field('location','Branch or location')}{field('contact_phone','Contact telephone','tel')}<Link to="/platform/hospitals">Manage hospital identity</Link></>}
    {step===1 && <>{field('primary_color','Primary brand color')}{field('secondary_color','Secondary brand color')}{field('target_date','Target go-live date','date')}<fieldset><legend>Requested modules</legend><div className="pc-checks">{MODULES.map(module => <label key={module}><input type="checkbox" disabled={!editable || busy} checked={(values.modules || []).includes(module)} onChange={e => change('modules',e.target.checked ? [...(values.modules || []),module] : values.modules.filter(m => m!==module))} />{titleCase(module)}</label>)}</div></fieldset>{field('notes','Requirements and implementation notes','textarea')}</>}
    {step===2 && <><p>Commercial approval requires an authorized subscription assignment. Saving this draft does not create a subscription.</p><Link to="/platform/subscriptions">View subscriptions</Link></>}
    {step===3 && <><p>{hospital.provisioned_at ? 'Provisioning completion is recorded. Verify the deployment before launch.' : 'Blocked: no confirmed workspace provisioning has been recorded.'}</p><p>A configured provisioning worker is required to execute queued operations.</p><Link to="/platform/hospitals">View hospital operations</Link></>}
    {step===4 && <><p>{hospital.admin_user_id ? 'Administrator account reference is recorded; invitation acceptance still requires verification.' : 'Blocked: administrator setup has not been confirmed.'}</p><p>Confirmed modules: {(hospital.enabled_modules || []).join(', ') || 'None recorded'}. Requested modules are saved separately.</p></>}
    {step===5 && <>{field('verification_notes','Verification results and evidence references','textarea')}<p>Record isolation checks, clinical workflow testing, backup and restore results. Notes alone do not pass a launch gate.</p></>}
    {step===6 && <>{field('training_notes','Training completion, responsible person and evidence references','textarea')}<p>Update the training checklist below after verifying completion.</p></>}
    {step===7 && <><p>Operational status: <strong>{titleCase(hospital.lifecycle_state)}</strong></p><p>Go-live remains blocked until provisioning, administrator readiness, subscription, verification and training are checked and an authorized launch approval is recorded. This draft cannot approve launch.</p></>}
    {message && <p role="alert" className="pc-error">{message} Your edits remain in this form. <button type="button" disabled={busy} onClick={reload}>Discard edits and reload saved draft</button></p>}
    <p role="status" className="pc-muted">{dirty ? 'Unsaved changes' : draft ? `Saved draft · revision ${draft.revision}` : 'No draft saved yet'}</p>
    <div className="pc-actions"><button disabled={step===0 || busy} onClick={() => move(step-1)}>Previous</button><button disabled={step===7 || busy} onClick={() => move(step+1)}>Next step</button>{editable && <button className="pc-primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save draft'}</button>}</div>
  </div>
}
