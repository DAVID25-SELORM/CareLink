-- ============================================================
-- Migration 015: NHIS CC Code on Encounters
-- Adds nhis_cc_code column to encounters and a dedicated
-- nhis_cc_codes tracking table for audit and reuse.
-- ============================================================

-- 1. Add CC code columns to encounters
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS nhis_cc_code TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS nhis_member_number TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS nhis_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS nhis_verified_at TIMESTAMPTZ;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS insurance_type TEXT DEFAULT 'cash'
  CHECK (insurance_type IN ('cash', 'nhis', 'private_insurance', 'corporate', 'other'));

-- 2. Index for CC code lookups
CREATE INDEX IF NOT EXISTS idx_encounters_nhis_cc ON encounters(nhis_cc_code) WHERE nhis_cc_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_encounters_insurance ON encounters(insurance_type);

-- 3. NHIS CC Code log — every CC code generated, verified, or manually entered
CREATE TABLE IF NOT EXISTS nhis_cc_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  cc_code TEXT NOT NULL,
  nhis_member_number TEXT NOT NULL,
  patient_name TEXT,
  scheme_code TEXT,
  verification_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (verification_method IN ('manual', 'healthflow', 'api', 'card_swipe')),
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_response JSONB,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nhis_cc_encounter ON nhis_cc_codes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_nhis_cc_patient ON nhis_cc_codes(patient_id);
CREATE INDEX IF NOT EXISTS idx_nhis_cc_code ON nhis_cc_codes(cc_code);

ALTER TABLE nhis_cc_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view cc codes" ON nhis_cc_codes;
CREATE POLICY "Staff view cc codes" ON nhis_cc_codes FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Staff manage cc codes" ON nhis_cc_codes;
CREATE POLICY "Staff manage cc codes" ON nhis_cc_codes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse', 'cashier', 'records_officer')
  ));

-- 4. Propagate CC code to prescriptions and lab_tests for easy claim linking
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS nhis_cc_code TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS nhis_cc_code TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS nhis_cc_code TEXT;

CREATE INDEX IF NOT EXISTS idx_prescriptions_nhis_cc ON prescriptions(nhis_cc_code) WHERE nhis_cc_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lab_tests_nhis_cc ON lab_tests(nhis_cc_code) WHERE nhis_cc_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claims_nhis_cc ON claims(nhis_cc_code) WHERE nhis_cc_code IS NOT NULL;

-- ============================================================
-- MIGRATION 015 COMPLETE
-- ============================================================
