-- ============================================================
-- CareLink HMS — Migration 009: Production Patches
-- Adds columns needed by the HealthFlow integration and
-- NHIA claim submission workflow.
-- All statements are safe to re-run (IF NOT EXISTS / DO NOTHING).
-- ============================================================

-- ── patients: date_of_birth ──────────────────────────────────
-- Required for NHIA pharmacy-claim API (dateOfBirth field).
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Back-fill where age is known but DOB is missing:
-- (approximate — sets DOB to Jan 1 of the birth year so claims
--  can proceed; staff should correct these during next patient visit)
UPDATE patients
SET date_of_birth = (CURRENT_DATE - (age || ' years')::INTERVAL)::DATE
WHERE date_of_birth IS NULL AND age IS NOT NULL AND age > 0;

-- ── prescriptions: NHIA claim tracking columns ───────────────
-- Written by Pharmacy.jsx after submitting via HealthFlow.
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS nhis_claim_id TEXT,
  ADD COLUMN IF NOT EXISTS nhis_cc_code  TEXT;

CREATE INDEX IF NOT EXISTS idx_prescriptions_nhis_claim ON prescriptions(nhis_claim_id)
  WHERE nhis_claim_id IS NOT NULL;

-- ── drugs: NHIA formulary code ───────────────────────────────
-- Used when building the medicines[] array for NHIA claim submission.
ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS nhia_code TEXT;

CREATE INDEX IF NOT EXISTS idx_drugs_nhia_code ON drugs(nhia_code)
  WHERE nhia_code IS NOT NULL;

-- ── integration_endpoints: ensure healthflow type is valid ───
-- The integration_endpoints table from migration 003 may have a
-- CHECK constraint on endpoint_type. If it does, we need to allow 'healthflow'.
-- This is safe to run even if the constraint doesn't exist.
DO $$
BEGIN
  -- Drop and recreate the check constraint if it exists and doesn't include 'healthflow'
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'integration_endpoints'
      AND constraint_name = 'integration_endpoints_endpoint_type_check'
  ) THEN
    -- Only alter if 'healthflow' is not already included
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'integration_endpoints_endpoint_type_check'
        AND check_clause LIKE '%healthflow%'
    ) THEN
      ALTER TABLE integration_endpoints
        DROP CONSTRAINT integration_endpoints_endpoint_type_check;
      ALTER TABLE integration_endpoints
        ADD CONSTRAINT integration_endpoints_endpoint_type_check
        CHECK (endpoint_type IN (
          'nhia_eclaims', 'dhims2', 'fhir_server', 'momo_mtn',
          'momo_telecel', 'momo_airteltigo', 'sms_gateway',
          'healthflow', 'other'
        ));
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- Migration 009 complete
-- Altered:  patients (+date_of_birth)
--           prescriptions (+nhis_claim_id, +nhis_cc_code)
--           drugs (+nhia_code)
--           integration_endpoints (healthflow type allowed)
-- ============================================================
