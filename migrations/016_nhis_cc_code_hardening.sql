-- ============================================================
-- Migration 016: NHIS CC Code Hardening
-- Adds validity/audit fields and prevents conflicting active
-- CC codes for a single encounter.
-- ============================================================

ALTER TABLE nhis_cc_codes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'expired', 'voided'));
ALTER TABLE nhis_cc_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE nhis_cc_codes ADD COLUMN IF NOT EXISTS source_page TEXT DEFAULT 'nhis_cc_code';
ALTER TABLE nhis_cc_codes ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE nhis_cc_codes ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE nhis_cc_codes ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE nhis_cc_codes ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE nhis_cc_codes ADD COLUMN IF NOT EXISTS void_reason TEXT;

UPDATE nhis_cc_codes
SET
  status = COALESCE(status, 'active'),
  expires_at = COALESCE(expires_at, created_at + INTERVAL '1 day')
WHERE status IS NULL OR expires_at IS NULL;

WITH ranked_codes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY encounter_id
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM nhis_cc_codes
  WHERE status = 'active'
)
UPDATE nhis_cc_codes
SET
  status = 'voided',
  voided_at = NOW(),
  void_reason = 'Auto-voided by migration 016: older duplicate active CC code for encounter'
WHERE id IN (
  SELECT id FROM ranked_codes WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nhis_cc_one_active_per_encounter
  ON nhis_cc_codes(encounter_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_nhis_cc_status ON nhis_cc_codes(status);
CREATE INDEX IF NOT EXISTS idx_nhis_cc_expires ON nhis_cc_codes(expires_at);

-- Keep active records fresh if existing rows were inserted before migration 016.
UPDATE nhis_cc_codes
SET status = 'expired'
WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

-- ============================================================
-- MIGRATION 016 COMPLETE
-- ============================================================
