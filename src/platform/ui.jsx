import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'

export const titleCase = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
export const dateLabel = value => value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : 'Not set'
export function Badge({ children }) { return <span className={`pc-badge pc-${String(children).replaceAll(' ', '_')}`}>{titleCase(children)}</span> }
export function PageHeader({ eyebrow = 'PLATFORM ADMINISTRATION', title, description, children }) {
  return <div className="pc-page-heading"><div><p className="pc-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="pc-muted">{description}</p></div><div className="pc-actions">{children}</div></div>
}
export function Empty({ title = 'Nothing here yet', children }) { return <div className="pc-empty"><span aria-hidden="true">◇</span><h3>{title}</h3><p>{children || 'Records will appear here as your platform grows.'}</p></div> }
export function ResourceState({ resource, children }) {
  if (resource.loading) return <div role="status" aria-label="Loading records" className="pc-skeletons">{[1,2,3].map(n => <div key={n} className="pc-skeleton" />)}</div>
  if (resource.error) return <div role="alert" className="pc-error"><h3>Unable to load this view</h3><p>{resource.error}</p><button onClick={resource.reload}>Try again</button></div>
  return children
}
export function Table({ columns, rows, onRow }) {
  if (!rows.length) return <Empty />
  return <div className="pc-table-wrap"><table><thead><tr>{columns.map(c => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map((c, index) => <td key={c.key}>{index === 0 && onRow ? <button className="pc-link" onClick={() => onRow(row)}>{c.render ? c.render(row) : row[c.key]}</button> : c.render ? c.render(row) : String(row[c.key] ?? '—')}</td>)}</tr>)}</tbody></table></div>
}
export function Modal({ title, children, onClose }) {
  const dialog = useRef(null)
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close() }, [])
  return <dialog ref={dialog} className="pc-modal" aria-labelledby="pc-dialog-title" onCancel={onClose}>
    <div className="pc-modal-heading"><h2 id="pc-dialog-title">{title}</h2><button aria-label="Close dialog" onClick={onClose}>×</button></div>{children}
  </dialog>
}
export function RecordForm({ title, fields, initial = {}, onSave, onClose, submitLabel = 'Save changes', notice }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.name, initial[f.name] ?? f.default ?? ''])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await onSave(values); toast.success('Changes saved'); onClose() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <Modal title={title} onClose={() => { if (!busy) onClose() }}><form onSubmit={submit} className="pc-form">
    {notice && <p className="pc-notice">{notice}</p>}
    {fields.map(field => <label key={field.name}>{field.label}<span className="pc-required">{field.required ? ' *' : ''}</span>
      {field.options ? <select value={values[field.name]} required={field.required} onChange={e => setValues({ ...values, [field.name]: e.target.value })}><option value="">Select…</option>{field.options.map(o => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? titleCase(o) : o.label}</option>)}</select>
        : field.type === 'textarea' ? <textarea rows={4} required={field.required} maxLength={field.maxLength || 4000} value={values[field.name]} onChange={e => setValues({ ...values, [field.name]: e.target.value })} />
          : <input type={field.type || 'text'} required={field.required} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength || 250} value={values[field.name]} onChange={e => setValues({ ...values, [field.name]: e.target.value })} />}
      {field.help && <small className="pc-muted">{field.help}</small>}
    </label>)}
    {error && <p role="alert" className="pc-error">{error}</p>}
    <div className="pc-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="pc-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></div>
  </form></Modal>
}
export function Confirm({ title, description, onConfirm, onClose, label = 'Confirm action', phrase }) {
  return <RecordForm title={title} onClose={onClose} submitLabel={label} notice={description}
    fields={[{ name: 'reason', label: 'Reason for this action', required: true, type: 'textarea' }, ...(phrase ? [{ name: 'confirmation', label: `Type ${phrase} to confirm`, required: true }] : [])]}
    onSave={async values => { if (phrase && values.confirmation !== phrase) throw new Error('Confirmation text does not match.'); await onConfirm(values.reason) }} />
}
