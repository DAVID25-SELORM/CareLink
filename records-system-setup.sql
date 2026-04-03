-- ============================================
-- CareLink HMS - Records System Database Setup
-- Supports medical records and record access requests
-- Author: David Gabion Selorm
-- ============================================

-- ============================================
-- 1. MEDICAL RECORDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  officer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  officer_name TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('consultation', 'lab_result', 'imaging', 'prescription', 'discharge_summary', 'admission', 'surgery', 'other')),
  document_name TEXT NOT NULL,
  description TEXT NOT NULL,
  record_date DATE NOT NULL,
  file_number TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('medical', 'administrative', 'billing', 'laboratory')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_by UUID REFERENCES users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  restored_by UUID REFERENCES users(id) ON DELETE SET NULL,
  restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_file_number ON medical_records(file_number);
CREATE INDEX IF NOT EXISTS idx_medical_records_status ON medical_records(status);
CREATE INDEX IF NOT EXISTS idx_medical_records_category ON medical_records(category);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_at ON medical_records(created_at DESC);

COMMENT ON TABLE medical_records IS 'Stores indexed medical and administrative patient records';

-- ============================================
-- 2. RECORD REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS record_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('view', 'copy', 'transfer', 'audit', 'other')),
  purpose TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'emergency')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_by_name TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_record_requests_patient_id ON record_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_record_requests_status ON record_requests(status);
CREATE INDEX IF NOT EXISTS idx_record_requests_urgency ON record_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_record_requests_created_at ON record_requests(created_at DESC);

COMMENT ON TABLE record_requests IS 'Stores requests to view, copy, or transfer patient records';

-- ============================================
-- 3. UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION set_records_row_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_medical_records_updated_at ON medical_records;
CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON medical_records
  FOR EACH ROW
  EXECUTE FUNCTION set_records_row_updated_at();

DROP TRIGGER IF EXISTS update_record_requests_updated_at ON record_requests;
CREATE TRIGGER update_record_requests_updated_at
  BEFORE UPDATE ON record_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_records_row_updated_at();

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_records_select ON medical_records;
DROP POLICY IF EXISTS medical_records_insert ON medical_records;
DROP POLICY IF EXISTS medical_records_update ON medical_records;

CREATE POLICY medical_records_select
  ON medical_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('records_officer', 'doctor', 'nurse', 'admin')
    )
  );

CREATE POLICY medical_records_insert
  ON medical_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      officer_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
          AND users.role = 'records_officer'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY medical_records_update
  ON medical_records
  FOR UPDATE
  TO authenticated
  USING (
    officer_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    officer_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS record_requests_select ON record_requests;
DROP POLICY IF EXISTS record_requests_insert ON record_requests;
DROP POLICY IF EXISTS record_requests_update ON record_requests;

CREATE POLICY record_requests_select
  ON record_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('records_officer', 'doctor', 'admin')
    )
  );

CREATE POLICY record_requests_insert
  ON record_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('records_officer', 'doctor', 'admin')
    )
  );

CREATE POLICY record_requests_update
  ON record_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('records_officer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('records_officer', 'admin')
    )
  );

-- ============================================
-- 5. VERIFICATION QUERIES
-- ============================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('medical_records', 'record_requests')
ORDER BY table_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'medical_records'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'record_requests'
ORDER BY ordinal_position;

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('medical_records', 'record_requests')
ORDER BY tablename, policyname;

-- ============================================
-- SETUP COMPLETE
-- ============================================

/*
INSTRUCTIONS FOR ADMIN:
1. Copy this script into Supabase SQL Editor.
2. Run it after the core CareLink setup.
3. Create a user with role records_officer in User Management.
4. Test adding, archiving, and restoring records from the Records dashboard.

FEATURES ENABLED:
- Medical records registry
- File-number indexing
- Record access request tracking
- Archive and restore flow
- RLS and audit-friendly processing fields
*/
