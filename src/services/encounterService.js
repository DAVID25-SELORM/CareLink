import { supabase } from '../supabaseClient'
import { logAuditEvent } from './auditLog'

// ─── ENCOUNTERS ───────────────────────────────────────────

export const createEncounter = async ({ patientId, doctorId, encounterType = 'outpatient', department, chiefComplaint, priority = 'routine' }) => {
  const { data, error } = await supabase
    .from('encounters')
    .insert({
      patient_id: patientId,
      doctor_id: doctorId,
      encounter_type: encounterType,
      department,
      chief_complaint: chiefComplaint,
      priority,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'encounter_created', tableName: 'encounters', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getEncounter = async (encounterId) => {
  return supabase
    .from('encounters')
    .select(`
      *,
      patients:patient_id ( id, name, patient_id, gender, age, blood_group, nhis_number, phone ),
      doctor:doctor_id ( id, full_name, specialty )
    `)
    .eq('id', encounterId)
    .single()
}

export const getPatientEncounters = async (patientId, { limit = 20, offset = 0 } = {}) => {
  return supabase
    .from('encounters')
    .select(`
      *,
      doctor:doctor_id ( id, full_name, specialty )
    `)
    .eq('patient_id', patientId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)
}

export const getActiveEncounters = async (doctorId) => {
  return supabase
    .from('encounters')
    .select(`
      *,
      patients:patient_id ( id, name, patient_id, gender, age, phone )
    `)
    .eq('doctor_id', doctorId)
    .in('status', ['registered', 'in_progress'])
    .order('started_at', { ascending: false })
}

export const updateEncounterStatus = async (encounterId, status) => {
  const updates = { status }
  if (status === 'completed' || status === 'discharged') {
    updates.ended_at = new Date().toISOString()
  }
  const { data, error } = await supabase
    .from('encounters')
    .update(updates)
    .eq('id', encounterId)
    .select()
    .single()

  if (!error) {
    logAuditEvent({ action: `encounter_${status}`, tableName: 'encounters', recordId: encounterId, newValues: updates })
  }
  return { data, error }
}

// ─── VITALS ───────────────────────────────────────────────

export const recordVitals = async (vitalsData) => {
  const { data, error } = await supabase
    .from('vitals')
    .insert(vitalsData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'vitals_recorded', tableName: 'vitals', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getEncounterVitals = async (encounterId) => {
  return supabase
    .from('vitals')
    .select('*, recorded_by_user:recorded_by ( full_name )')
    .eq('encounter_id', encounterId)
    .order('recorded_at', { ascending: false })
}

export const getPatientVitals = async (patientId, { limit = 10 } = {}) => {
  return supabase
    .from('vitals')
    .select('*')
    .eq('patient_id', patientId)
    .order('recorded_at', { ascending: false })
    .limit(limit)
}

// ─── DIAGNOSES ────────────────────────────────────────────

export const addDiagnosis = async (diagnosisData) => {
  const { data, error } = await supabase
    .from('diagnoses')
    .insert(diagnosisData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'diagnosis_added', tableName: 'diagnoses', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getEncounterDiagnoses = async (encounterId) => {
  return supabase
    .from('diagnoses')
    .select('*, diagnosed_by_user:diagnosed_by ( full_name )')
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: true })
}

export const updateDiagnosis = async (diagnosisId, updates) => {
  return supabase
    .from('diagnoses')
    .update(updates)
    .eq('id', diagnosisId)
    .select()
    .single()
}

export const deleteDiagnosis = async (diagnosisId) => {
  logAuditEvent({ action: 'diagnosis_deleted', tableName: 'diagnoses', recordId: diagnosisId })
  return supabase.from('diagnoses').delete().eq('id', diagnosisId)
}

// ─── CLINICAL NOTES (SOAP) ───────────────────────────────

export const saveClinicalNote = async (noteData) => {
  const { data, error } = await supabase
    .from('clinical_notes')
    .upsert(noteData, { onConflict: 'id' })
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'clinical_note_saved', tableName: 'clinical_notes', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getEncounterNotes = async (encounterId) => {
  return supabase
    .from('clinical_notes')
    .select('*, author:author_id ( full_name )')
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: false })
}

// ─── CLINICAL ORDERS ─────────────────────────────────────

export const createOrder = async (orderData) => {
  const { data, error } = await supabase
    .from('clinical_orders')
    .insert(orderData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'order_created', tableName: 'clinical_orders', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const getEncounterOrders = async (encounterId) => {
  return supabase
    .from('clinical_orders')
    .select('*, ordered_by_user:ordered_by ( full_name )')
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: false })
}

export const updateOrderStatus = async (orderId, status) => {
  return supabase
    .from('clinical_orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single()
}

// ─── PROBLEM LIST ────────────────────────────────────────

export const getPatientProblemList = async (patientId) => {
  return supabase
    .from('problem_list')
    .select('*')
    .eq('patient_id', patientId)
    .is('resolved_date', null)
    .order('onset_date', { ascending: false })
}

export const addProblem = async (problemData) => {
  const { data, error } = await supabase
    .from('problem_list')
    .insert(problemData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'problem_added', tableName: 'problem_list', recordId: data.id, newValues: data })
  }
  return { data, error }
}

export const resolveProblem = async (problemId) => {
  return supabase
    .from('problem_list')
    .update({ status: 'resolved', resolved_date: new Date().toISOString().split('T')[0] })
    .eq('id', problemId)
    .select()
    .single()
}

// ─── ALLERGIES ───────────────────────────────────────────

export const getPatientAllergies = async (patientId) => {
  return supabase
    .from('allergies')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
}

export const addAllergy = async (allergyData) => {
  const { data, error } = await supabase
    .from('allergies')
    .insert(allergyData)
    .select()
    .single()

  if (!error && data) {
    logAuditEvent({ action: 'allergy_added', tableName: 'allergies', recordId: data.id, newValues: data })
  }
  return { data, error }
}
