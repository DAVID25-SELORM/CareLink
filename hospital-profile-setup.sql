-- ============================================
-- CareLink HMS - Hospital Profile Setup
-- Shared CareLink brand with per-hospital identity
-- Author: David Gabion Selorm
-- Date: April 3, 2026
-- ============================================
--
-- PURPOSE:
-- - Keeps CareLink as the umbrella product name
-- - Lets each hospital show its own name in login and dashboard UI
-- - Stores one profile row per deployment
-- ============================================

CREATE TABLE IF NOT EXISTS hospital_profile (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  platform_name TEXT NOT NULL DEFAULT 'CareLink HMS',
  hospital_name TEXT NOT NULL DEFAULT 'Your Hospital Name',
  branch_name TEXT,
  dashboard_label TEXT,
  tagline TEXT NOT NULL DEFAULT 'Powered by CareLink',
  primary_color TEXT,
  secondary_color TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO hospital_profile (singleton_key)
VALUES (TRUE)
ON CONFLICT (singleton_key) DO NOTHING;

CREATE OR REPLACE FUNCTION set_hospital_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hospital_profile_updated_at ON hospital_profile;
CREATE TRIGGER update_hospital_profile_updated_at
  BEFORE UPDATE ON hospital_profile
  FOR EACH ROW
  EXECUTE FUNCTION set_hospital_profile_updated_at();

ALTER TABLE hospital_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospital_profile_select_public ON hospital_profile;
DROP POLICY IF EXISTS hospital_profile_insert_admin ON hospital_profile;
DROP POLICY IF EXISTS hospital_profile_update_admin ON hospital_profile;

CREATE POLICY hospital_profile_select_public
  ON hospital_profile
  FOR SELECT
  USING (TRUE);

CREATE POLICY hospital_profile_insert_admin
  ON hospital_profile
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY hospital_profile_update_admin
  ON hospital_profile
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

SELECT singleton_key, platform_name, hospital_name, branch_name, dashboard_label, tagline
FROM hospital_profile;
