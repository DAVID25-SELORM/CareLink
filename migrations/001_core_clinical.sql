-- ============================================
-- CareLink HMS — Migration 001: Core Clinical
-- Encounter-based clinical workflow tables
-- Depends on: database-setup.sql (users, patients, prescriptions, lab_tests, appointments)
-- ============================================

-- ============================================
-- 1. ENCOUNTERS
-- The central spine for every patient visit
-- ============================================

CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  encounter_type TEXT NOT NULL CHECK (encounter_type IN ('outpatient', 'inpatient', 'emergency', 'telemedicine', 'home_visit')),
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'triaged', 'in_progress', 'completed', 'cancelled')),
  chief_complaint TEXT,
  visit_reason TEXT,
  department TEXT,
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'emergency')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  discharge_disposition TEXT CHECK (discharge_disposition IN ('home', 'admitted', 'transferred', 'deceased', 'left_ama', 'referred')),
  follow_up_date DATE,
  follow_up_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_doctor ON encounters(doctor_id);
CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(status);
CREATE INDEX IF NOT EXISTS idx_encounters_type ON encounters(encounter_type);
CREATE INDEX IF NOT EXISTS idx_encounters_created ON encounters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_department ON encounters(department);

COMMENT ON TABLE encounters IS 'Central clinical encounter record — every patient visit creates one';
COMMENT ON COLUMN encounters.encounter_type IS 'Classification: outpatient, inpatient, emergency, telemedicine, home_visit';
COMMENT ON COLUMN encounters.discharge_disposition IS 'Outcome of the encounter for the patient';

-- ============================================
-- 2. DIAGNOSES (ICD-10-GM)
-- ============================================

CREATE TABLE IF NOT EXISTS diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  diagnosed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  icd10_code TEXT NOT NULL,
  icd10_description TEXT NOT NULL,
  diagnosis_type TEXT NOT NULL DEFAULT 'primary' CHECK (diagnosis_type IN ('primary', 'secondary', 'differential', 'rule_out')),
  rank INTEGER DEFAULT 1,
  onset_date DATE,
  resolved_date DATE,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  certainty TEXT DEFAULT 'confirmed' CHECK (certainty IN ('confirmed', 'provisional', 'differential', 'rule_out')),
  notes TEXT,
  is_chronic BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_encounter ON diagnoses(encounter_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_patient ON diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_icd10 ON diagnoses(icd10_code);
CREATE INDEX IF NOT EXISTS idx_diagnoses_type ON diagnoses(diagnosis_type);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created ON diagnoses(created_at DESC);

COMMENT ON TABLE diagnoses IS 'ICD-10-GM coded diagnoses linked to encounters';
COMMENT ON COLUMN diagnoses.rank IS 'Priority ordering — 1 = primary diagnosis';

-- ============================================
-- 3. VITALS
-- ============================================

CREATE TABLE IF NOT EXISTS vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  temperature_c NUMERIC(4, 1),
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  pulse_rate INTEGER,
  respiratory_rate INTEGER,
  spo2 NUMERIC(4, 1),
  weight_kg NUMERIC(5, 1),
  height_cm NUMERIC(5, 1),
  bmi NUMERIC(4, 1),
  pain_scale INTEGER CHECK (pain_scale BETWEEN 0 AND 10),
  blood_glucose NUMERIC(5, 1),
  gcs_score INTEGER CHECK (gcs_score BETWEEN 3 AND 15),
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-calculate BMI
CREATE OR REPLACE FUNCTION calculate_bmi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.weight_kg IS NOT NULL AND NEW.height_cm IS NOT NULL AND NEW.height_cm > 0 THEN
    NEW.bmi := ROUND(NEW.weight_kg / POWER(NEW.height_cm / 100.0, 2), 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_bmi ON vitals;
CREATE TRIGGER trigger_calculate_bmi
  BEFORE INSERT OR UPDATE ON vitals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_bmi();

CREATE INDEX IF NOT EXISTS idx_vitals_encounter ON vitals(encounter_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at ON vitals(recorded_at DESC);

COMMENT ON TABLE vitals IS 'Patient vital signs captured during encounters or ward rounds';

-- ============================================
-- 4. CLINICAL NOTES (SOAP Format)
-- ============================================

CREATE TABLE IF NOT EXISTS clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'soap' CHECK (note_type IN ('soap', 'progress', 'procedure', 'consultation', 'discharge_summary', 'operative', 'nursing')),
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  body TEXT,
  is_addendum BOOLEAN DEFAULT FALSE,
  parent_note_id UUID REFERENCES clinical_notes(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_encounter ON clinical_notes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_author ON clinical_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_type ON clinical_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_created ON clinical_notes(created_at DESC);

COMMENT ON TABLE clinical_notes IS 'SOAP and other clinical notes linked to encounters';
COMMENT ON COLUMN clinical_notes.note_type IS 'soap=SOAP format, progress=free-text, discharge_summary=on discharge';

-- ============================================
-- 5. CLINICAL ORDERS
-- Unified ordering system for labs, radiology, procedures, referrals
-- ============================================

CREATE TABLE IF NOT EXISTS clinical_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  ordered_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('lab', 'radiology', 'procedure', 'referral', 'medication', 'diet', 'nursing')),
  order_category TEXT,
  order_description TEXT NOT NULL,
  order_code TEXT,
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat', 'asap')),
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('draft', 'ordered', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected')),
  clinical_indication TEXT,
  special_instructions TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  result_summary TEXT,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_encounter ON clinical_orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_orders_patient ON clinical_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_by ON clinical_orders(ordered_by);
CREATE INDEX IF NOT EXISTS idx_orders_type ON clinical_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_status ON clinical_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON clinical_orders(priority);
CREATE INDEX IF NOT EXISTS idx_orders_created ON clinical_orders(created_at DESC);

COMMENT ON TABLE clinical_orders IS 'Unified order entry — labs, radiology, procedures, referrals, medications';

-- ============================================
-- 6. PROBLEM LIST
-- Persistent patient-level diagnoses across encounters
-- ============================================

CREATE TABLE IF NOT EXISTS problem_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE SET NULL,
  icd10_code TEXT NOT NULL,
  icd10_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'inactive', 'recurrence')),
  onset_date DATE,
  resolved_date DATE,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_list_patient ON problem_list(patient_id);
CREATE INDEX IF NOT EXISTS idx_problem_list_status ON problem_list(status);
CREATE INDEX IF NOT EXISTS idx_problem_list_icd10 ON problem_list(icd10_code);

COMMENT ON TABLE problem_list IS 'Persistent patient problem list spanning multiple encounters';

-- ============================================
-- 7. ALLERGIES (Structured)
-- ============================================

CREATE TABLE IF NOT EXISTS allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergen_type TEXT NOT NULL CHECK (allergen_type IN ('drug', 'food', 'environment', 'biological', 'other')),
  allergen_name TEXT NOT NULL,
  reaction TEXT,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
  onset_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'resolved', 'refuted')),
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_allergies_type ON allergies(allergen_type);
CREATE INDEX IF NOT EXISTS idx_allergies_status ON allergies(status);

COMMENT ON TABLE allergies IS 'Structured allergy records for drug interaction checking and clinical safety';

-- ============================================
-- 8. BACKWARD COMPATIBILITY: Add encounter_id to existing tables
-- ============================================

-- Add encounter_id to prescriptions (nullable for existing records)
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter ON prescriptions(encounter_id);

-- Add encounter_id to lab_tests (nullable for existing records)
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES clinical_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_tests_encounter ON lab_tests(encounter_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_order ON lab_tests(order_id);

-- Add encounter_id to triage_assessments (nullable for existing records)
ALTER TABLE triage_assessments
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_triage_encounter ON triage_assessments(encounter_id);

-- ============================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_encounters_timestamp ON encounters;
CREATE TRIGGER update_encounters_timestamp
  BEFORE UPDATE ON encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_diagnoses_timestamp ON diagnoses;
CREATE TRIGGER update_diagnoses_timestamp
  BEFORE UPDATE ON diagnoses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vitals_timestamp ON vitals;
CREATE TRIGGER update_vitals_timestamp
  BEFORE UPDATE ON vitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clinical_notes_timestamp ON clinical_notes;
CREATE TRIGGER update_clinical_notes_timestamp
  BEFORE UPDATE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clinical_orders_timestamp ON clinical_orders;
CREATE TRIGGER update_clinical_orders_timestamp
  BEFORE UPDATE ON clinical_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_problem_list_timestamp ON problem_list;
CREATE TRIGGER update_problem_list_timestamp
  BEFORE UPDATE ON problem_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_allergies_timestamp ON allergies;
CREATE TRIGGER update_allergies_timestamp
  BEFORE UPDATE ON allergies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;

-- Encounters: all authenticated staff can view, doctors create/update
DROP POLICY IF EXISTS "Staff view encounters" ON encounters;
CREATE POLICY "Staff view encounters"
  ON encounters FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Doctors manage encounters" ON encounters;
CREATE POLICY "Doctors manage encounters"
  ON encounters FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

-- Diagnoses: doctors and admin
DROP POLICY IF EXISTS "Staff view diagnoses" ON diagnoses;
CREATE POLICY "Staff view diagnoses"
  ON diagnoses FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Doctors manage diagnoses" ON diagnoses;
CREATE POLICY "Doctors manage diagnoses"
  ON diagnoses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

-- Vitals: nurses and doctors can record
DROP POLICY IF EXISTS "Staff view vitals" ON vitals;
CREATE POLICY "Staff view vitals"
  ON vitals FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Clinical staff manage vitals" ON vitals;
CREATE POLICY "Clinical staff manage vitals"
  ON vitals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

-- Clinical Notes: all staff view, clinical staff write
DROP POLICY IF EXISTS "Staff view clinical notes" ON clinical_notes;
CREATE POLICY "Staff view clinical notes"
  ON clinical_notes FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Clinical staff manage notes" ON clinical_notes;
CREATE POLICY "Clinical staff manage notes"
  ON clinical_notes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

-- Clinical Orders: doctors order, all staff view
DROP POLICY IF EXISTS "Staff view orders" ON clinical_orders;
CREATE POLICY "Staff view orders"
  ON clinical_orders FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Doctors manage orders" ON clinical_orders;
CREATE POLICY "Doctors manage orders"
  ON clinical_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

-- Problem List: all staff view, doctors manage
DROP POLICY IF EXISTS "Staff view problem list" ON problem_list;
CREATE POLICY "Staff view problem list"
  ON problem_list FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Doctors manage problem list" ON problem_list;
CREATE POLICY "Doctors manage problem list"
  ON problem_list FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

-- Allergies: all staff view, clinical staff manage
DROP POLICY IF EXISTS "Staff view allergies" ON allergies;
CREATE POLICY "Staff view allergies"
  ON allergies FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Clinical staff manage allergies" ON allergies;
CREATE POLICY "Clinical staff manage allergies"
  ON allergies FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

-- ============================================
-- MIGRATION 001 COMPLETE
-- Tables created: encounters, diagnoses, vitals, clinical_notes,
--                 clinical_orders, problem_list, allergies
-- Tables modified: prescriptions (+encounter_id), lab_tests (+encounter_id, +order_id),
--                  triage_assessments (+encounter_id)
-- ============================================
