import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'
import { daysToExpiry } from '../lib/drugAlerts'
import { earliestBatchExpiry } from '../lib/drugBatches'

const emptyForm = { drug_id: '', batch_number: '', expiry_date: '', quantity: '', cost_per_unit: '', opening_expiry: '' }
const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * Batch stock for the pharmacy: receive a delivery as a batch, see every batch with its
 * expiry, and quarantine or recall a batch. Dispensing takes from the earliest expiry first.
 * drugs.stock stays the running total; drugs.expiry_date is kept as the earliest live batch expiry.
 */
const DrugBatches = ({ drugs, user, onChanged }) => {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const loadBatches = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('drug_batches')
      .select('id, drug_id, batch_number, expiry_date, quantity_received, quantity_remaining, status, received_date, drugs:drug_id(name, unit)')
      .neq('status', 'depleted')
      .order('expiry_date', { ascending: true })
      .limit(500)
    if (error) {
      toast.error('Could not load batches')
      setBatches([])
    } else {
      setBatches(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadBatches() }, [loadBatches])

  const selectedDrug = drugs.find((d) => d.id === form.drug_id)
  const drugBatches = batches.filter((b) => b.drug_id === form.drug_id)
  const needsOpening = Boolean(selectedDrug) && drugBatches.length === 0 && Number(selectedDrug.stock) > 0

  // Keep the drug's own expiry in step with its live batches so existing alerts keep working.
  const syncDrug = async (drugId, stock) => {
    const { data, error } = await supabase
      .from('drug_batches')
      .select('expiry_date, quantity_remaining, status')
      .eq('drug_id', drugId)
    if (error) throw error
    const update = { expiry_date: earliestBatchExpiry(data) }
    if (stock != null) update.stock = stock
    const { error: drugError } = await supabase.from('drugs').update(update).eq('id', drugId)
    if (drugError) throw drugError
  }

  const receive = async (event) => {
    event.preventDefault()
    const quantity = Number(form.quantity)
    if (!selectedDrug || !form.batch_number.trim() || !form.expiry_date || !(quantity > 0)) {
      toast.error('Choose a drug and enter batch number, expiry date and quantity')
      return
    }
    if (daysToExpiry(form.expiry_date) < 0) {
      toast.error('This batch is already expired and cannot be received')
      return
    }
    const openingExpiry = form.opening_expiry || selectedDrug.expiry_date
    if (needsOpening && !openingExpiry) {
      toast.error('Enter the expiry date of the stock already on the shelf')
      return
    }

    setSaving(true)
    const created = []
    try {
      if (needsOpening) {
        const { data: opening, error } = await supabase
          .from('drug_batches')
          .insert([{
            drug_id: selectedDrug.id,
            batch_number: `OPENING-${todayIso()}`,
            expiry_date: openingExpiry,
            quantity_received: Number(selectedDrug.stock),
            quantity_remaining: Number(selectedDrug.stock),
            received_by: user?.id || null,
            notes: 'Opening balance when batch tracking started',
          }])
          .select('id')
          .single()
        if (error) throw error
        created.push(opening.id)
      }

      const { data: batch, error: batchError } = await supabase
        .from('drug_batches')
        .insert([{
          drug_id: selectedDrug.id,
          batch_number: form.batch_number.trim(),
          expiry_date: form.expiry_date,
          quantity_received: quantity,
          quantity_remaining: quantity,
          cost_per_unit: form.cost_per_unit === '' ? null : Number(form.cost_per_unit),
          total_cost: form.cost_per_unit === '' ? null : Number(form.cost_per_unit) * quantity,
          received_by: user?.id || null,
        }])
        .select('id')
        .single()
      if (batchError) {
        if (batchError.code === '23505') throw new Error('That batch number is already recorded for this drug')
        throw batchError
      }
      created.push(batch.id)

      await syncDrug(selectedDrug.id, Number(selectedDrug.stock) + quantity)
      await logAuditEvent({
        user,
        action: 'receive_drug_batch',
        tableName: 'drug_batches',
        recordId: batch.id,
        newValues: { drug: selectedDrug.name, batch_number: form.batch_number.trim(), expiry_date: form.expiry_date, quantity },
      })
      toast.success(`Received ${quantity} x ${selectedDrug.name}`)
      setForm(emptyForm)
      await loadBatches()
      onChanged?.()
    } catch (error) {
      if (created.length > 0) await supabase.from('drug_batches').delete().in('id', created)
      toast.error(error.message || 'Could not receive stock')
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (batch, status) => {
    const verb = status === 'active' ? 'Release' : status === 'quarantined' ? 'Quarantine' : 'Recall'
    if (!window.confirm(`${verb} batch ${batch.batch_number} of ${batch.drugs?.name}? ${status === 'recalled' ? 'Recalled stock will never be dispensed.' : ''}`)) return
    try {
      const { error } = await supabase.from('drug_batches').update({ status }).eq('id', batch.id)
      if (error) throw error
      await syncDrug(batch.drug_id, null)
      await logAuditEvent({
        user,
        action: `batch_${status}`,
        tableName: 'drug_batches',
        recordId: batch.id,
        oldValues: { status: batch.status },
        newValues: { status, batch_number: batch.batch_number },
      })
      toast.success(`${verb}d batch ${batch.batch_number}`.replace('Releaseed', 'Released'))
      await loadBatches()
      onChanged?.()
    } catch (error) {
      toast.error(error.message || 'Could not update batch')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={receive} className="card space-y-4">
        <h3 className="text-lg font-semibold">Receive stock as a batch</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <select value={form.drug_id} onChange={(e) => setForm({ ...form, drug_id: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg" required>
            <option value="">Select drug *</option>
            {drugs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input placeholder="Batch / lot number *" value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg" required />
          <input type="date" aria-label="Expiry date" value={form.expiry_date} min={todayIso()} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg" required />
          <input type="number" min="1" placeholder="Quantity received *" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg" required />
          <input type="number" min="0" step="0.01" placeholder="Cost per unit (optional)" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg" />
        </div>
        {needsOpening && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
            <p>
              {selectedDrug.name} has {selectedDrug.stock} units already on the shelf with no batch. They will be saved as an
              opening batch so they stay available.
            </p>
            {!selectedDrug.expiry_date && (
              <label className="block">
                Expiry date of the stock already on the shelf *
                <input type="date" value={form.opening_expiry} onChange={(e) => setForm({ ...form, opening_expiry: e.target.value })} className="ml-2 px-2 py-1 border border-gray-300 rounded" />
              </label>
            )}
          </div>
        )}
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving...' : 'Receive batch'}</button>
      </form>

      <div className="card overflow-x-auto">
        <h3 className="text-lg font-semibold mb-4">Batches in stock ({batches.length})</h3>
        {loading ? <p className="text-sm text-gray-500">Loading...</p> : batches.length === 0 ? (
          <p className="text-sm text-gray-500">No batches recorded yet. Drugs without batches are dispensed using the drug-level expiry.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2">Drug</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">Remaining</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.map((b) => {
                const days = daysToExpiry(b.expiry_date)
                const expired = days !== null && days < 0
                return (
                  <tr key={b.id} className={expired ? 'bg-red-50' : days !== null && days <= 30 ? 'bg-yellow-50' : ''}>
                    <td className="px-3 py-2">{b.drugs?.name}</td>
                    <td className="px-3 py-2 font-mono">{b.batch_number}</td>
                    <td className="px-3 py-2">{b.expiry_date}{expired ? ' (expired)' : days !== null && days <= 30 ? ` (${days}d)` : ''}</td>
                    <td className="px-3 py-2">{b.quantity_remaining} / {b.quantity_received}</td>
                    <td className="px-3 py-2">{expired ? 'expired' : b.status}</td>
                    <td className="px-3 py-2 space-x-2">
                      {b.status === 'active' && <button type="button" className="text-amber-700 underline" onClick={() => setStatus(b, 'quarantined')}>Quarantine</button>}
                      {b.status === 'quarantined' && <button type="button" className="text-blue-700 underline" onClick={() => setStatus(b, 'active')}>Release</button>}
                      {b.status !== 'recalled' && <button type="button" className="text-red-700 underline" onClick={() => setStatus(b, 'recalled')}>Recall</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default DrugBatches
