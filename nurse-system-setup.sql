-- ============================================
-- CareLink HMS - Nurse System Database Setup
-- Patient Vitals and Nurse Notes Tables
-- Author: David Gabion Selorm
-- ============================================

-- ============================================
-- 1. PATIENT VITALS TABLE
-- Stores vital signs recorded by nurses
-- ============================================

CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  nurse_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  nurse_name TEXT NOT NULL,
  
  -- Vital Signs Measurements
  temperature DECIMAL(4,1),              -- In Celsius (e.g., 36.5)
  blood_pressure TEXT,                   -- Format: "120/80"
  heart_rate INTEGER,                    -- Beats per minute
  respiratory_rate INTEGER,              -- Breaths per minute
  oxygen_saturation DECIMAL(5,2),        -- SpO2 percentage (e.g., 98.5)
  weight DECIMAL(5,2),                   -- In kilograms
  height DECIMAL(5,2),                   -- In centimeters
  
  -- Additional Information
  notes TEXT,                            -- Any observations or notes
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient_id ON patient_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_nurse_id ON patient_vitals(nurse_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_at ON patient_vitals(recorded_at DESC);

-- Add comment to table
COMMENT ON TABLE patient_vitals IS 'Stores patient vital signs recorded by nurses';

-- ============================================
-- 2. NURSE NOTES TABLE
-- Stores nursing notes and observations
-- ============================================

CREATE TABLE IF NOT EXISTS nurse_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  nurse_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  nurse_name TEXT NOT NULL,
  nurse_type TEXT,                       -- General Nurse, Midwife
  
  -- Note Details
  note_type TEXT NOT NULL,               -- general, assessment, intervention, observation, care_plan
  content TEXT NOT NULL,                 -- The actual note content
  priority TEXT DEFAULT 'normal',        -- normal, moderate, high
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_nurse_notes_patient_id ON nurse_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_nurse_notes_nurse_id ON nurse_notes(nurse_id);
CREATE INDEX IF NOT EXISTS idx_nurse_notes_created_at ON nurse_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nurse_notes_priority ON nurse_notes(priority);

-- Add comment to table
COMMENT ON TABLE nurse_notes IS 'Stores nursing notes, observations, and care plans';

-- ============================================
-- 3. ROW LEVEL SECURITY POLICIES
-- Enable RLS and create policies
-- ============================================

-- Enable RLS for patient_vitals
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;

-- Nurses can view all vitals
CREATE POLICY "Nurses can view all patient vitals"
  ON patient_vitals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('nurse', 'doctor', 'admin')
    )
  );

-- Nurses can insert vitals
CREATE POLICY "Nurses can insert patient vitals"
  ON patient_vitals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('nurse', 'admin')
    )
  );

-- Nurses can update their own vitals records
CREATE POLICY "Nurses can update their own vitals records"
  ON patient_vitals
  FOR UPDATE
  TO authenticated
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Enable RLS for nurse_notes
ALTER TABLE nurse_notes ENABLE ROW LEVEL SECURITY;

-- Nurses and doctors can view all notes
CREATE POLICY "Nurses and doctors can view all notes"
  ON nurse_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('nurse', 'doctor', 'admin')
    )
  );

-- Nurses can insert notes
CREATE POLICY "Nurses can insert notes"
  ON nurse_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('nurse', 'admin')
    )
  );

-- Nurses can update their own notes
CREATE POLICY "Nurses can update their own notes"
  ON nurse_notes
  FOR UPDATE
  TO authenticated
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Nurses can delete their own notes
CREATE POLICY "Nurses can delete their own notes"
  ON nurse_notes
  FOR DELETE
  TO authenticated
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================
-- 4. TRIGGER FOR UPDATED_AT TIMESTAMP
-- Auto-update timestamp on record modification
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to nurse_notes
DROP TRIGGER IF EXISTS update_nurse_notes_updated_at ON nurse_notes;
CREATE TRIGGER update_nurse_notes_updated_at
  BEFORE UPDATE ON nurse_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. VERIFICATION QUERIES
-- Run these to verify the setup
-- ============================================

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('patient_vitals', 'nurse_notes')
ORDER BY table_name;

-- Check patient_vitals structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patient_vitals'
ORDER BY ordinal_position;

-- Check nurse_notes structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'nurse_notes'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('patient_vitals', 'nurse_notes')
ORDER BY tablename, policyname;

-- ============================================
-- SETUP COMPLETE
-- ============================================

/*
INSTRUCTIONS FOR ADMIN:
1. Copy this entire SQL script
2. Open Supabase Dashboard -> SQL Editor
3. Paste the script and click "Run"
4. Verify success by checking the verification queries output
5. Create test nurse users in User Management
6. Test vitals recording and note creation

NURSE TYPES:
- General Nurse: General patient care, vitals monitoring
- Midwife: Maternal and newborn care

FEATURES ENABLED:
✅ Patient vitals recording (temperature, BP, heart rate, SpO2, etc.)
✅ Nurse notes with priority levels
✅ Multiple note types (assessment, intervention, observation, care plan)
✅ Row Level Security for data protection
✅ Auto-update timestamps
✅ Performance optimized with indexes
*/
