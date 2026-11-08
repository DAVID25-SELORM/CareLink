-- ============================================
-- CareLink HMS - Nurse System Database Setup
-- Supports vitals, nurse notes, care tasks,
-- and shift handovers
-- Author: David Gabion Selorm
-- ============================================

-- ============================================
-- 1. PATIENT VITALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
  nurse_name TEXT NOT NULL,
  temperature NUMERIC(4,1),
  blood_pressure TEXT,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  oxygen_saturation NUMERIC(5,2),
  weight NUMERIC(5,2),
  height NUMERIC(5,2),
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE patient_vitals
  ALTER COLUMN nurse_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient_id ON patient_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_nurse_id ON patient_vitals(nurse_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_at ON patient_vitals(recorded_at DESC);

COMMENT ON TABLE patient_vitals IS 'Stores patient vital signs recorded by nurses';

-- ============================================
-- 2. NURSE NOTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS nurse_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
  nurse_name TEXT NOT NULL,
  nurse_type TEXT,
  note_type TEXT NOT NULL CHECK (note_type IN ('general', 'assessment', 'intervention', 'observation', 'care_plan')),
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'moderate', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nurse_notes
  ALTER COLUMN nurse_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nurse_notes_patient_id ON nurse_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_nurse_notes_nurse_id ON nurse_notes(nurse_id);
CREATE INDEX IF NOT EXISTS idx_nurse_notes_created_at ON nurse_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nurse_notes_priority ON nurse_notes(priority);

COMMENT ON TABLE nurse_notes IS 'Stores nursing notes, observations, and care plans';

-- ============================================
-- 3. NURSE TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS nurse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
  nurse_name TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('medication', 'vitals', 'observation', 'wound_care', 'patient_education', 'other')),
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'moderate', 'high')),
  due_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nurse_tasks_patient_id ON nurse_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_nurse_tasks_nurse_id ON nurse_tasks(nurse_id);
CREATE INDEX IF NOT EXISTS idx_nurse_tasks_status ON nurse_tasks(status);
CREATE INDEX IF NOT EXISTS idx_nurse_tasks_due_time ON nurse_tasks(due_time);

COMMENT ON TABLE nurse_tasks IS 'Stores nurse-assigned bedside care tasks';

-- ============================================
-- 4. SHIFT HANDOVERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS shift_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
  nurse_name TEXT NOT NULL,
  nurse_type TEXT,
  shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
  summary TEXT NOT NULL,
  concerns TEXT,
  pending_tasks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_handovers_nurse_id ON shift_handovers(nurse_id);
CREATE INDEX IF NOT EXISTS idx_shift_handovers_shift ON shift_handovers(shift);
CREATE INDEX IF NOT EXISTS idx_shift_handovers_created_at ON shift_handovers(created_at DESC);

COMMENT ON TABLE shift_handovers IS 'Stores nursing shift handover summaries';

-- ============================================
-- 5. UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_nurse_notes_updated_at ON nurse_notes;
CREATE TRIGGER update_nurse_notes_updated_at
  BEFORE UPDATE ON nurse_notes
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS update_nurse_tasks_updated_at ON nurse_tasks;
CREATE TRIGGER update_nurse_tasks_updated_at
  BEFORE UPDATE ON nurse_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS update_shift_handovers_updated_at ON shift_handovers;
CREATE TRIGGER update_shift_handovers_updated_at
  BEFORE UPDATE ON shift_handovers
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurse_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurse_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_vitals_select ON patient_vitals;
DROP POLICY IF EXISTS patient_vitals_insert ON patient_vitals;
DROP POLICY IF EXISTS patient_vitals_update ON patient_vitals;

CREATE POLICY patient_vitals_select
  ON patient_vitals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('nurse', 'doctor', 'admin')
    )
  );

CREATE POLICY patient_vitals_insert
  ON patient_vitals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      nurse_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
          AND users.role = 'nurse'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY patient_vitals_update
  ON patient_vitals
  FOR UPDATE
  TO authenticated
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS nurse_notes_select ON nurse_notes;
DROP POLICY IF EXISTS nurse_notes_insert ON nurse_notes;
DROP POLICY IF EXISTS nurse_notes_update ON nurse_notes;
DROP POLICY IF EXISTS nurse_notes_delete ON nurse_notes;

CREATE POLICY nurse_notes_select
  ON nurse_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('nurse', 'doctor', 'admin')
    )
  );

CREATE POLICY nurse_notes_insert
  ON nurse_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      nurse_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
          AND users.role = 'nurse'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY nurse_notes_update
  ON nurse_notes
  FOR UPDATE
  TO authenticated
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY nurse_notes_delete
  ON nurse_notes
  FOR DELETE
  TO authenticated
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS nurse_tasks_select ON nurse_tasks;
DROP POLICY IF EXISTS nurse_tasks_insert ON nurse_tasks;
DROP POLICY IF EXISTS nurse_tasks_update ON nurse_tasks;

CREATE POLICY nurse_tasks_select
  ON nurse_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('nurse', 'doctor', 'admin')
    )
  );

CREATE POLICY nurse_tasks_insert
  ON nurse_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      nurse_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
          AND users.role = 'nurse'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY nurse_tasks_update
  ON nurse_tasks
  FOR UPDATE
  TO authenticated
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS shift_handovers_select ON shift_handovers;
DROP POLICY IF EXISTS shift_handovers_insert ON shift_handovers;
DROP POLICY IF EXISTS shift_handovers_update ON shift_handovers;

CREATE POLICY shift_handovers_select
  ON shift_handovers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('nurse', 'doctor', 'admin')
    )
  );

CREATE POLICY shift_handovers_insert
  ON shift_handovers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      nurse_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
          AND users.role = 'nurse'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY shift_handovers_update
  ON shift_handovers
  FOR UPDATE
  TO authenticated
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- ============================================
-- 7. VERIFICATION QUERIES
-- ============================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('patient_vitals', 'nurse_notes', 'nurse_tasks', 'shift_handovers')
ORDER BY table_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'nurse_tasks'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shift_handovers'
ORDER BY ordinal_position;

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('patient_vitals', 'nurse_notes', 'nurse_tasks', 'shift_handovers')
ORDER BY tablename, policyname;

-- ============================================
-- SETUP COMPLETE
-- ============================================

/*
INSTRUCTIONS FOR ADMIN:
1. Copy this entire SQL script.
2. Open Supabase Dashboard -> SQL Editor.
3. Paste the script and run it.
4. Confirm the verification queries show all four tables.
5. Create nurse users from User Management.
6. Test vitals, notes, tasks, and handover flows.

FEATURES ENABLED:
- Patient vital sign recording
- Nurse notes and care-plan entries
- Nurse task tracking
- Shift handover summaries
- RLS for protected access
- Updated-at triggers
- Performance indexes
*/
