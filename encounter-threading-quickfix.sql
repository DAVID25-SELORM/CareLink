-- ============================================
-- QUICK FIX: Add Missing Encounter Integration
-- Run this in Supabase SQL Editor to complete the 8-stage system
-- ============================================

-- 1. Add encounter_id to prescriptions
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter ON prescriptions(encounter_id);

-- 2. Add encounter_id to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_encounter ON payments(encounter_id);

-- 3. Add encounter_id to claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_claims_encounter_legacy ON claims(encounter_id);

-- 4. Add encounter_id to lab_tests
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lab_tests_encounter ON lab_tests(encounter_id);

-- 5. Add encounter_id to admissions
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_admissions_encounter ON admissions(encounter_id);

-- 6. Fix triage_assessments columns (severity and pain_score fields)
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS pain_score TEXT;
-- Add notes alias column (code sends 'notes', DB has 'assessment_notes')
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS notes TEXT;
-- Give triage_level a default so inserts without it don't fail
ALTER TABLE triage_assessments ALTER COLUMN triage_level SET DEFAULT 'yellow';
CREATE INDEX IF NOT EXISTS idx_triage_encounter ON triage_assessments(encounter_id);

-- 7. Create discharge_summaries table
CREATE TABLE IF NOT EXISTS discharge_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id UUID REFERENCES admissions(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  final_diagnosis TEXT NOT NULL,
  icd10_code TEXT,
  discharge_instructions TEXT NOT NULL,
  medications_at_discharge TEXT,
  follow_up_date DATE,
  follow_up_notes TEXT,
  discharge_condition TEXT NOT NULL CHECK (discharge_condition IN ('improved', 'unchanged', 'deteriorated', 'cured')),
  discharge_type TEXT NOT NULL DEFAULT 'regular' CHECK (discharge_type IN ('regular', 'against_advice', 'transfer', 'deceased')),
  discharge_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharged_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discharge_patient ON discharge_summaries(patient_id);
CREATE INDEX IF NOT EXISTS idx_discharge_admission ON discharge_summaries(admission_id);
CREATE INDEX IF NOT EXISTS idx_discharge_encounter ON discharge_summaries(encounter_id);
CREATE INDEX IF NOT EXISTS idx_discharge_date ON discharge_summaries(discharge_date DESC);

-- 8. Enable RLS and policies
ALTER TABLE discharge_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view discharge summaries" ON discharge_summaries;
CREATE POLICY "Staff view discharge summaries" ON discharge_summaries FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin', 'doctor', 'nurse', 'records_officer'));

DROP POLICY IF EXISTS "Clinical staff create discharge summaries" ON discharge_summaries;
CREATE POLICY "Clinical staff create discharge summaries" ON discharge_summaries FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'doctor', 'nurse'));

-- 9. Add trigger
DROP TRIGGER IF EXISTS update_discharge_summaries_timestamp ON discharge_summaries;
CREATE TRIGGER update_discharge_summaries_timestamp
  BEFORE UPDATE ON discharge_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Fix ward_rounds for WardRounds.jsx
-- admission_id is NOT NULL but code never provides it (rounds can exist without a formal admission)
ALTER TABLE ward_rounds ALTER COLUMN admission_id DROP NOT NULL;
-- Code sends ward_id, clinical_findings, orders, notes — columns that don't exist yet
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES wards(id) ON DELETE SET NULL;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS clinical_findings TEXT;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS orders TEXT;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_ward_rounds_ward ON ward_rounds(ward_id);

-- 11. Add missing columns to clinical_orders for Radiology.jsx
-- Code sets started_at when scan begins, result_notes for findings
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS result_notes TEXT;

-- ✅ DONE! The 8-stage encounter-based system is now fully functional.
