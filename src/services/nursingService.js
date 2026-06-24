import { supabase } from '../supabaseClient'
import { logAuditEvent } from './auditLog'

// ─── MEDICATION ADMINISTRATION RECORDS (MAR) ─────────────

export const recordMedAdmin = async (marData) => {
  const { data, error } = await supabase
    .from('medication_administration_records')
    .insert(marData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'medication_administered', tableName: 'medication_administration_records', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getPatientMAR = async (patientId, { date } = {}) => {
  let query = supabase
    .from('medication_administration_records')
    .select('*, administered_by_user:administered_by ( full_name )')
    .eq('patient_id', patientId)
    .order('scheduled_time', { ascending: true })

  if (date) {
    query = query.gte('scheduled_time', `${date}T00:00:00`).lte('scheduled_time', `${date}T23:59:59`)
  }
  return query
}

export const updateMARStatus = async (marId, status, notes) => {
  const updates = { status, administered_time: status === 'given' ? new Date().toISOString() : null }
  if (notes) updates.notes = notes
  return supabase
    .from('medication_administration_records')
    .update(updates)
    .eq('id', marId)
    .select()
    .single()
}

// ─── FLUID BALANCE ───────────────────────────────────────

export const recordFluidEntry = async (fluidData) => {
  const { data, error } = await supabase
    .from('fluid_balance_charts')
    .insert(fluidData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'fluid_entry_recorded', tableName: 'fluid_balance_charts', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getPatientFluidBalance = async (patientId, date) => {
  let query = supabase
    .from('fluid_balance_charts')
    .select('*, recorded_by_user:recorded_by ( full_name )')
    .eq('patient_id', patientId)
    .order('recorded_at', { ascending: true })

  if (date) {
    query = query.gte('recorded_at', `${date}T00:00:00`).lte('recorded_at', `${date}T23:59:59`)
  }
  return query
}

export const getDailyFluidBalance = async (patientId, date) => {
  return supabase
    .from('fluid_balance_daily')
    .select('*')
    .eq('patient_id', patientId)
    .eq('balance_date', date)
}

// ─── NURSING ASSESSMENTS ─────────────────────────────────

export const createNursingAssessment = async (assessmentData) => {
  const { data, error } = await supabase
    .from('nursing_assessments')
    .insert(assessmentData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'nursing_assessment_created', tableName: 'nursing_assessments', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getPatientAssessments = async (patientId, { type } = {}) => {
  let query = supabase
    .from('nursing_assessments')
    .select('*, assessed_by_user:assessed_by ( full_name )')
    .eq('patient_id', patientId)
    .order('assessed_at', { ascending: false })

  if (type) query = query.eq('assessment_type', type)
  return query
}

// ─── CARE PLANS ──────────────────────────────────────────

export const createCarePlan = async (planData) => {
  const { data, error } = await supabase
    .from('nursing_care_plans')
    .insert(planData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'care_plan_created', tableName: 'nursing_care_plans', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getPatientCarePlans = async (patientId) => {
  return supabase
    .from('nursing_care_plans')
    .select('*, created_by_user:created_by ( full_name )')
    .eq('patient_id', patientId)
    .in('status', ['active', 'on_hold'])
    .order('created_at', { ascending: false })
}

export const updateCarePlan = async (planId, updates) => {
  return supabase
    .from('nursing_care_plans')
    .update(updates)
    .eq('id', planId)
    .select()
    .single()
}

// ─── WARD ROUNDS ─────────────────────────────────────────

export const createWardRound = async (roundData) => {
  const { data, error } = await supabase
    .from('ward_rounds')
    .insert(roundData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'ward_round_recorded', tableName: 'ward_rounds', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getPatientWardRounds = async (patientId, { limit = 10 } = {}) => {
  return supabase
    .from('ward_rounds')
    .select('*, doctor:doctor_id ( full_name, specialty )')
    .eq('patient_id', patientId)
    .order('round_date', { ascending: false })
    .limit(limit)
}

export const getWardRoundsForDate = async (wardId, date) => {
  return supabase
    .from('ward_rounds')
    .select(`
      *,
      patients:patient_id ( id, name, patient_id ),
      doctor:doctor_id ( full_name, specialty )
    `)
    .eq('ward_id', wardId)
    .gte('round_date', `${date}T00:00:00`)
    .lte('round_date', `${date}T23:59:59`)
    .order('round_date', { ascending: true })
}

// ─── HANDOVER NOTES ──────────────────────────────────────

export const createHandoverNote = async (handoverData) => {
  const { data, error } = await supabase
    .from('handover_notes')
    .insert(handoverData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'handover_created', tableName: 'handover_notes', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getWardHandovers = async (wardId, { shift, date } = {}) => {
  let query = supabase
    .from('handover_notes')
    .select(`
      *,
      outgoing:outgoing_nurse_id ( full_name ),
      incoming:incoming_nurse_id ( full_name ),
      patients:patient_id ( id, name, patient_id )
    `)
    .eq('ward_id', wardId)
    .order('handover_time', { ascending: false })

  if (shift) query = query.eq('shift', shift)
  if (date) {
    query = query.gte('handover_time', `${date}T00:00:00`).lte('handover_time', `${date}T23:59:59`)
  }
  return query
}

// ─── PATIENT TRANSFERS ───────────────────────────────────

export const createTransfer = async (transferData) => {
  const { data, error } = await supabase
    .from('patient_transfers')
    .insert(transferData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'patient_transferred', tableName: 'patient_transfers', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const acceptTransfer = async (transferId, receivingNurseId) => {
  return supabase
    .from('patient_transfers')
    .update({
      status: 'completed',
      receiving_nurse_id: receivingNurseId,
      actual_transfer_time: new Date().toISOString(),
    })
    .eq('id', transferId)
    .select()
    .single()
}

export const getPendingTransfers = async (wardId) => {
  return supabase
    .from('patient_transfers')
    .select(`
      *,
      patients:patient_id ( id, name, patient_id ),
      initiating_nurse:initiating_nurse_id ( full_name )
    `)
    .eq('to_ward_id', wardId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
}
