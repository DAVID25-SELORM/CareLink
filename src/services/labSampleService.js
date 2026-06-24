import { supabase } from '../supabaseClient'
import { logAuditEvent } from './auditLog'

// ─── Lab Sample Tracking Service ─────────────────────────────────────
// Adds barcode/accession numbers, specimen tracking, collection workflow

// ─── Generate Accession Number ───────────────────────────────────────

export function generateAccessionNumber(prefix = 'LAB') {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
  return `${prefix}-${datePart}-${seq}`
}

// ─── Create Lab Order with Sample ────────────────────────────────────

export async function createLabOrder({ patientId, orderedBy, tests, clinicalNotes, priority = 'routine' }) {
  const accessionNumber = generateAccessionNumber()

  const { data: order, error } = await supabase
    .from('lab_tests')
    .insert({
      patient_id: patientId,
      requested_by: orderedBy,   // maps to existing FK column (was: ordered_by)
      test_type: tests.join(', '),
      accession_number: accessionNumber,
      priority,
      clinical_notes: clinicalNotes,
      status: 'ordered',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (!error && order) {
    await logAuditEvent({ action: 'lab_order_created', tableName: 'lab_tests', recordId: order.id })
  }

  return { data: order, error, accessionNumber }
}

// ─── Collect Sample ──────────────────────────────────────────────────

export async function collectSample(labTestId, { collectedBy, specimenType, collectionNotes }) {
  const { data, error } = await supabase
    .from('lab_tests')
    .update({
      status: 'collected',
      specimen_type: specimenType,
      collected_by: collectedBy,
      collected_at: new Date().toISOString(),
      collection_notes: collectionNotes,
    })
    .eq('id', labTestId)
    .select()
    .single()

  if (!error && data) {
    await logAuditEvent({ action: 'sample_collected', tableName: 'lab_tests', recordId: labTestId })
  }

  return { data, error }
}

// ─── Mark Sample In Processing ───────────────────────────────────────

export async function startProcessing(labTestId, technicianId) {
  const { data, error } = await supabase
    .from('lab_tests')
    .update({
      status: 'processing',
      processed_by: technicianId,
      processing_started_at: new Date().toISOString(),
    })
    .eq('id', labTestId)
    .select()
    .single()

  if (!error && data) {
    await logAuditEvent({ action: 'lab_processing_started', tableName: 'lab_tests', recordId: labTestId })
  }

  return { data, error }
}

// ─── Enter Results ───────────────────────────────────────────────────

export async function enterResults(labTestId, { result, resultDetails, technicianId, isAbnormal = false }) {
  const { data, error } = await supabase
    .from('lab_tests')
    .update({
      status: 'completed',
      result,
      result_details: resultDetails,
      is_abnormal: isAbnormal,
      completed_by: technicianId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', labTestId)
    .select()
    .single()

  if (!error && data) {
    await logAuditEvent({ action: 'lab_result_entered', tableName: 'lab_tests', recordId: labTestId })
  }

  return { data, error }
}

// ─── Get Sample Tracking Timeline ────────────────────────────────────

export async function getSampleTimeline(labTestId) {
  const { data, error } = await supabase
    .from('lab_tests')
    .select('*')
    .eq('id', labTestId)
    .single()

  if (error || !data) return { data: null, error }

  const timeline = []

  timeline.push({
    step: 'ordered',
    timestamp: data.created_at,
    label: 'Order Placed',
    completed: true,
  })

  timeline.push({
    step: 'collected',
    timestamp: data.collected_at,
    label: 'Sample Collected',
    completed: !!data.collected_at,
    details: data.specimen_type ? `Specimen: ${data.specimen_type}` : null,
  })

  timeline.push({
    step: 'processing',
    timestamp: data.processing_started_at,
    label: 'Processing',
    completed: !!data.processing_started_at,
  })

  timeline.push({
    step: 'completed',
    timestamp: data.completed_at,
    label: 'Results Ready',
    completed: !!data.completed_at,
    details: data.is_abnormal ? '⚠ Abnormal result flagged' : null,
  })

  return { data: { ...data, timeline }, error: null }
}

// ─── Get Pending Samples (Worklist) ──────────────────────────────────

export async function getLabWorklist(status = 'ordered') {
  const { data, error } = await supabase
    .from('lab_tests')
    .select('*, patients:patient_id ( name, patient_id, gender, age )')
    .eq('status', status)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(100)

  return { data, error }
}

// ─── Get Turnaround Times ────────────────────────────────────────────

export async function getLabTAT(days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('lab_tests')
    .select('created_at, collected_at, processing_started_at, completed_at, test_type')
    .eq('status', 'completed')
    .gte('completed_at', since.toISOString())

  if (error || !data) return { data: null, error }

  const stats = data.map(t => {
    const ordered = new Date(t.created_at)
    const completed = new Date(t.completed_at)
    const tatMinutes = (completed - ordered) / (1000 * 60)
    return { test_type: t.test_type, tatMinutes }
  })

  const avgTAT = stats.length > 0
    ? Math.round(stats.reduce((s, t) => s + t.tatMinutes, 0) / stats.length)
    : 0

  return {
    data: {
      totalCompleted: stats.length,
      avgTATMinutes: avgTAT,
      avgTATFormatted: `${Math.floor(avgTAT / 60)}h ${avgTAT % 60}m`,
    },
    error: null,
  }
}
