-- ============================================
-- CareLink HMS - Hospital Onboarding Hub Setup
-- Internal pipeline tracking for new client hospitals
-- Author: David Gabion Selorm
-- Date: April 3, 2026
-- ============================================
--
-- IMPORTANT:
-- - Run this only in your CareLink owner/admin instance
-- - This tracks hospital onboarding operations
-- - It does not make CareLink multi-tenant by itself
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_name TEXT NOT NULL,
  branch_location TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  owner_full_name TEXT,
  owner_email TEXT NOT NULL,
  owner_phone TEXT,
  public_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'intake', 'provisioning', 'training', 'ready_for_go_live', 'live', 'paused')),
  go_live_date DATE,
  enabled_modules TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospital_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('intake', 'technical', 'database', 'accounts', 'branding', 'go_live', 'security', 'handover')),
  task_name TEXT NOT NULL,
  task_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_status ON hospitals(status);
CREATE INDEX IF NOT EXISTS idx_hospitals_go_live_date ON hospitals(go_live_date);
CREATE INDEX IF NOT EXISTS idx_hospitals_created_at ON hospitals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hospital_onboarding_tasks_hospital_id ON hospital_onboarding_tasks(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_onboarding_tasks_status ON hospital_onboarding_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hospital_onboarding_tasks_phase ON hospital_onboarding_tasks(phase);
CREATE INDEX IF NOT EXISTS idx_hospital_onboarding_tasks_sort_order ON hospital_onboarding_tasks(sort_order);

COMMENT ON TABLE hospitals IS 'Internal CareLink implementation tracker for client hospitals';
COMMENT ON TABLE hospital_onboarding_tasks IS 'Checklist items for each hospital onboarding rollout';

CREATE OR REPLACE FUNCTION set_hospital_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hospitals_updated_at ON hospitals;
CREATE TRIGGER update_hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW
  EXECUTE FUNCTION set_hospital_onboarding_updated_at();

DROP TRIGGER IF EXISTS update_hospital_onboarding_tasks_updated_at ON hospital_onboarding_tasks;
CREATE TRIGGER update_hospital_onboarding_tasks_updated_at
  BEFORE UPDATE ON hospital_onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_hospital_onboarding_updated_at();

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_onboarding_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospitals_select_admin ON hospitals;
DROP POLICY IF EXISTS hospitals_insert_admin ON hospitals;
DROP POLICY IF EXISTS hospitals_update_admin ON hospitals;
DROP POLICY IF EXISTS hospital_onboarding_tasks_select_admin ON hospital_onboarding_tasks;
DROP POLICY IF EXISTS hospital_onboarding_tasks_insert_admin ON hospital_onboarding_tasks;
DROP POLICY IF EXISTS hospital_onboarding_tasks_update_admin ON hospital_onboarding_tasks;

CREATE POLICY hospitals_select_admin
  ON hospitals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY hospitals_insert_admin
  ON hospitals
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

CREATE POLICY hospitals_update_admin
  ON hospitals
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

CREATE POLICY hospital_onboarding_tasks_select_admin
  ON hospital_onboarding_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY hospital_onboarding_tasks_insert_admin
  ON hospital_onboarding_tasks
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

CREATE POLICY hospital_onboarding_tasks_update_admin
  ON hospital_onboarding_tasks
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

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('hospitals', 'hospital_onboarding_tasks')
ORDER BY table_name;

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('hospitals', 'hospital_onboarding_tasks')
ORDER BY tablename, policyname;
