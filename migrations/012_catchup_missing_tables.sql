-- ============================================================
-- CareLink HMS — Migration 012: Catch-up for Missing Tables
-- Runs all tables from migrations 001–007 that were not yet
-- applied to the database.
-- Safe to run: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- Run this once in the Supabase SQL Editor.
-- ============================================================


-- ============================================================
-- PREREQUISITES: ensure update_updated_at_column() exists
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- FROM MIGRATION 001: Core Clinical Tables
-- ============================================================

-- 1. ENCOUNTERS (the central clinical spine)

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
  encounter_date DATE DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  discharge_disposition TEXT CHECK (discharge_disposition IN ('home', 'admitted', 'transferred', 'deceased', 'left_ama', 'referred')),
  follow_up_date DATE,
  follow_up_instructions TEXT,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_doctor ON encounters(doctor_id);
CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(status);
CREATE INDEX IF NOT EXISTS idx_encounters_type ON encounters(encounter_type);
CREATE INDEX IF NOT EXISTS idx_encounters_created ON encounters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_hospital ON encounters(hospital_id);
CREATE INDEX IF NOT EXISTS idx_encounters_date ON encounters(encounter_date DESC);

ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view encounters" ON encounters;
CREATE POLICY "Staff view encounters" ON encounters FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Doctors manage encounters" ON encounters;
CREATE POLICY "Doctors manage encounters" ON encounters FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse', 'pharmacist', 'cashier', 'records_officer', 'lab_tech')));

DROP TRIGGER IF EXISTS update_encounters_timestamp ON encounters;
CREATE TRIGGER update_encounters_timestamp BEFORE UPDATE ON encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 2. DIAGNOSES

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
CREATE INDEX IF NOT EXISTS idx_diagnoses_created ON diagnoses(created_at DESC);

ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view diagnoses" ON diagnoses;
CREATE POLICY "Staff view diagnoses" ON diagnoses FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Doctors manage diagnoses" ON diagnoses;
CREATE POLICY "Doctors manage diagnoses" ON diagnoses FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor')));

DROP TRIGGER IF EXISTS update_diagnoses_timestamp ON diagnoses;
CREATE TRIGGER update_diagnoses_timestamp BEFORE UPDATE ON diagnoses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 3. VITALS

CREATE OR REPLACE FUNCTION calculate_bmi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.weight_kg IS NOT NULL AND NEW.height_cm IS NOT NULL AND NEW.height_cm > 0 THEN
    NEW.bmi := ROUND(NEW.weight_kg / POWER(NEW.height_cm / 100.0, 2), 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

DROP TRIGGER IF EXISTS trigger_calculate_bmi ON vitals;
CREATE TRIGGER trigger_calculate_bmi BEFORE INSERT OR UPDATE ON vitals
  FOR EACH ROW EXECUTE FUNCTION calculate_bmi();

CREATE INDEX IF NOT EXISTS idx_vitals_encounter ON vitals(encounter_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at ON vitals(recorded_at DESC);

ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view vitals" ON vitals;
CREATE POLICY "Staff view vitals" ON vitals FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Clinical staff manage vitals" ON vitals;
CREATE POLICY "Clinical staff manage vitals" ON vitals FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse')));

DROP TRIGGER IF EXISTS update_vitals_timestamp ON vitals;
CREATE TRIGGER update_vitals_timestamp BEFORE UPDATE ON vitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4. CLINICAL NOTES (SOAP)

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
CREATE INDEX IF NOT EXISTS idx_clinical_notes_type ON clinical_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_created ON clinical_notes(created_at DESC);

ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view clinical notes" ON clinical_notes;
CREATE POLICY "Staff view clinical notes" ON clinical_notes FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Clinical staff manage notes" ON clinical_notes;
CREATE POLICY "Clinical staff manage notes" ON clinical_notes FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse')));

DROP TRIGGER IF EXISTS update_clinical_notes_timestamp ON clinical_notes;
CREATE TRIGGER update_clinical_notes_timestamp BEFORE UPDATE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 5. CLINICAL ORDERS

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
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  result_summary TEXT,
  result_notes TEXT,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_encounter ON clinical_orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_orders_patient ON clinical_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_type ON clinical_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_status ON clinical_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON clinical_orders(created_at DESC);

ALTER TABLE clinical_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view orders" ON clinical_orders;
CREATE POLICY "Staff view orders" ON clinical_orders FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Doctors manage orders" ON clinical_orders;
CREATE POLICY "Doctors manage orders" ON clinical_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor')));

DROP TRIGGER IF EXISTS update_clinical_orders_timestamp ON clinical_orders;
CREATE TRIGGER update_clinical_orders_timestamp BEFORE UPDATE ON clinical_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 6. PROBLEM LIST

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

ALTER TABLE problem_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view problem list" ON problem_list;
CREATE POLICY "Staff view problem list" ON problem_list FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Doctors manage problem list" ON problem_list;
CREATE POLICY "Doctors manage problem list" ON problem_list FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor')));

DROP TRIGGER IF EXISTS update_problem_list_timestamp ON problem_list;
CREATE TRIGGER update_problem_list_timestamp BEFORE UPDATE ON problem_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 7. ALLERGIES

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
CREATE INDEX IF NOT EXISTS idx_allergies_status ON allergies(status);

ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view allergies" ON allergies;
CREATE POLICY "Staff view allergies" ON allergies FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Clinical staff manage allergies" ON allergies;
CREATE POLICY "Clinical staff manage allergies" ON allergies FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse')));

DROP TRIGGER IF EXISTS update_allergies_timestamp ON allergies;
CREATE TRIGGER update_allergies_timestamp BEFORE UPDATE ON allergies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- FROM MIGRATION 002: Nursing & Ward Tables
-- ============================================================

-- 8. MEDICATION ADMINISTRATION RECORDS (MAR)

CREATE TABLE IF NOT EXISTS medication_administration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prescription_item_id UUID REFERENCES prescription_items(id) ON DELETE SET NULL,
  drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
  drug_name TEXT NOT NULL,
  dose TEXT NOT NULL,
  dose_unit TEXT NOT NULL DEFAULT 'mg',
  route TEXT NOT NULL DEFAULT 'oral' CHECK (route IN ('oral', 'iv', 'im', 'sc', 'topical', 'inhaled', 'rectal', 'sublingual', 'transdermal', 'ophthalmic', 'otic', 'nasal')),
  frequency TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  administered_time TIMESTAMPTZ,
  administered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  witnessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'given', 'held', 'refused', 'omitted', 'self_administered')),
  hold_reason TEXT,
  refusal_reason TEXT,
  omission_reason TEXT,
  site TEXT,
  pain_level_before INTEGER CHECK (pain_level_before BETWEEN 0 AND 10),
  pain_level_after INTEGER CHECK (pain_level_after BETWEEN 0 AND 10),
  adverse_reaction TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mar_admission ON medication_administration_records(admission_id);
CREATE INDEX IF NOT EXISTS idx_mar_patient ON medication_administration_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_mar_scheduled ON medication_administration_records(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_mar_status ON medication_administration_records(status);

ALTER TABLE medication_administration_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinical staff view MAR" ON medication_administration_records;
CREATE POLICY "Clinical staff view MAR" ON medication_administration_records FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Nurses manage MAR" ON medication_administration_records;
CREATE POLICY "Nurses manage MAR" ON medication_administration_records FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse', 'doctor')));

DROP TRIGGER IF EXISTS update_mar_timestamp ON medication_administration_records;
CREATE TRIGGER update_mar_timestamp BEFORE UPDATE ON medication_administration_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 9. FLUID BALANCE CHARTS

CREATE TABLE IF NOT EXISTS fluid_balance_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('intake', 'output')),
  fluid_type TEXT NOT NULL,
  route TEXT CHECK (route IN ('oral', 'iv', 'ng_tube', 'urine', 'drain', 'vomit', 'stool', 'blood_loss', 'insensible', 'other')),
  volume_ml INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fluid_balance_admission ON fluid_balance_charts(admission_id);
CREATE INDEX IF NOT EXISTS idx_fluid_balance_patient ON fluid_balance_charts(patient_id);
CREATE INDEX IF NOT EXISTS idx_fluid_balance_date ON fluid_balance_charts(chart_date);

CREATE OR REPLACE VIEW fluid_balance_daily AS
SELECT
  admission_id, patient_id, chart_date,
  SUM(CASE WHEN entry_type = 'intake' THEN volume_ml ELSE 0 END) AS total_intake_ml,
  SUM(CASE WHEN entry_type = 'output' THEN volume_ml ELSE 0 END) AS total_output_ml,
  SUM(CASE WHEN entry_type = 'intake' THEN volume_ml ELSE 0 END)
    - SUM(CASE WHEN entry_type = 'output' THEN volume_ml ELSE 0 END) AS net_balance_ml
FROM fluid_balance_charts
GROUP BY admission_id, patient_id, chart_date;

ALTER TABLE fluid_balance_charts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinical staff view fluid balance" ON fluid_balance_charts;
CREATE POLICY "Clinical staff view fluid balance" ON fluid_balance_charts FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Nurses manage fluid balance" ON fluid_balance_charts;
CREATE POLICY "Nurses manage fluid balance" ON fluid_balance_charts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse', 'doctor')));


-- 10. NURSING ASSESSMENTS

CREATE TABLE IF NOT EXISTS nursing_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID REFERENCES admissions(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('glasgow_coma', 'braden_pressure', 'fall_risk', 'pain', 'nutritional', 'skin_integrity', 'mental_status', 'functional', 'wound')),
  total_score NUMERIC(5, 1),
  risk_level TEXT CHECK (risk_level IN ('low', 'moderate', 'high', 'very_high')),
  scores JSONB NOT NULL DEFAULT '{}',
  findings TEXT,
  interventions_required TEXT,
  next_assessment_due TIMESTAMPTZ,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursing_assess_patient ON nursing_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_nursing_assess_type ON nursing_assessments(assessment_type);

ALTER TABLE nursing_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view nursing assessments" ON nursing_assessments;
CREATE POLICY "Staff view nursing assessments" ON nursing_assessments FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Nurses manage assessments" ON nursing_assessments;
CREATE POLICY "Nurses manage assessments" ON nursing_assessments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse')));

DROP TRIGGER IF EXISTS update_nursing_assessments_timestamp ON nursing_assessments;
CREATE TRIGGER update_nursing_assessments_timestamp BEFORE UPDATE ON nursing_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 11. NURSING CARE PLANS

CREATE TABLE IF NOT EXISTS nursing_care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem TEXT NOT NULL,
  nursing_diagnosis TEXT,
  goal TEXT NOT NULL,
  target_date DATE,
  interventions JSONB NOT NULL DEFAULT '[]',
  evaluation TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'not_achieved', 'revised', 'discontinued')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON nursing_care_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON nursing_care_plans(status);

ALTER TABLE nursing_care_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view care plans" ON nursing_care_plans;
CREATE POLICY "Staff view care plans" ON nursing_care_plans FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Nurses manage care plans" ON nursing_care_plans;
CREATE POLICY "Nurses manage care plans" ON nursing_care_plans FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse')));

DROP TRIGGER IF EXISTS update_care_plans_timestamp ON nursing_care_plans;
CREATE TRIGGER update_care_plans_timestamp BEFORE UPDATE ON nursing_care_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 12. WARD ROUNDS

CREATE TABLE IF NOT EXISTS ward_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  round_type TEXT DEFAULT 'routine' CHECK (round_type IN ('routine', 'consultant', 'grand', 'teaching', 'night')),
  observations TEXT,
  clinical_findings TEXT,
  assessment TEXT,
  new_orders TEXT,
  orders TEXT,
  plan TEXT,
  notes TEXT,
  diet_orders TEXT,
  activity_orders TEXT,
  condition_status TEXT CHECK (condition_status IN ('improving', 'stable', 'deteriorating', 'critical')),
  next_round_date DATE,
  attendees JSONB DEFAULT '[]',
  round_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ward_rounds_patient ON ward_rounds(patient_id);
CREATE INDEX IF NOT EXISTS idx_ward_rounds_doctor ON ward_rounds(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ward_rounds_time ON ward_rounds(round_time DESC);
CREATE INDEX IF NOT EXISTS idx_ward_rounds_ward ON ward_rounds(ward_id);

ALTER TABLE ward_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view ward rounds" ON ward_rounds;
CREATE POLICY "Staff view ward rounds" ON ward_rounds FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Doctors manage ward rounds" ON ward_rounds;
CREATE POLICY "Doctors manage ward rounds" ON ward_rounds FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor')));

DROP TRIGGER IF EXISTS update_ward_rounds_timestamp ON ward_rounds;
CREATE TRIGGER update_ward_rounds_timestamp BEFORE UPDATE ON ward_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 13. HANDOVER NOTES

CREATE TABLE IF NOT EXISTS handover_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  outgoing_nurse_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incoming_nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night')),
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ward_summary TEXT,
  critical_alerts JSONB DEFAULT '[]',
  pending_tasks JSONB DEFAULT '[]',
  patient_summaries JSONB DEFAULT '[]',
  staffing_issues TEXT,
  equipment_issues TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handover_ward ON handover_notes(ward_id);
CREATE INDEX IF NOT EXISTS idx_handover_date ON handover_notes(handover_date DESC);

ALTER TABLE handover_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Nurses view handover notes" ON handover_notes;
CREATE POLICY "Nurses view handover notes" ON handover_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse', 'doctor')));
DROP POLICY IF EXISTS "Nurses manage handover notes" ON handover_notes;
CREATE POLICY "Nurses manage handover notes" ON handover_notes FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse')));

DROP TRIGGER IF EXISTS update_handover_notes_timestamp ON handover_notes;
CREATE TRIGGER update_handover_notes_timestamp BEFORE UPDATE ON handover_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- FROM MIGRATION 003: Revenue Cycle & NHIA
-- ============================================================

-- 14. NHIA TARIFF CATALOG

CREATE TABLE IF NOT EXISTS nhia_tariff_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gdrg_code TEXT NOT NULL,
  tariff_code TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('consultation', 'investigation', 'procedure', 'surgery', 'medicine', 'consumable', 'bed_day', 'anesthesia', 'physiotherapy', 'dental', 'optical')),
  subcategory TEXT,
  base_price NUMERIC(10, 2) NOT NULL,
  nhia_price NUMERIC(10, 2) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  edition TEXT DEFAULT '2024',
  facility_level TEXT CHECK (facility_level IN ('clinic', 'health_center', 'district', 'regional', 'teaching')),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tariff_gdrg ON nhia_tariff_catalog(gdrg_code);
CREATE INDEX IF NOT EXISTS idx_tariff_active ON nhia_tariff_catalog(is_active) WHERE is_active = TRUE;

ALTER TABLE nhia_tariff_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view tariff catalog" ON nhia_tariff_catalog;
CREATE POLICY "Staff view tariff catalog" ON nhia_tariff_catalog FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin manage tariff catalog" ON nhia_tariff_catalog;
CREATE POLICY "Admin manage tariff catalog" ON nhia_tariff_catalog FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP TRIGGER IF EXISTS update_tariff_timestamp ON nhia_tariff_catalog;
CREATE TRIGGER update_tariff_timestamp BEFORE UPDATE ON nhia_tariff_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 15. FEE SCHEDULES

CREATE TABLE IF NOT EXISTS fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  payer_type TEXT NOT NULL CHECK (payer_type IN ('cash', 'nhis', 'private_insurance', 'corporate')),
  insurance_company TEXT,
  service_code TEXT NOT NULL,
  service_description TEXT NOT NULL,
  category TEXT,
  unit_price NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'GHS',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_schedule_payer ON fee_schedules(payer_type);
CREATE INDEX IF NOT EXISTS idx_fee_schedule_active ON fee_schedules(is_active) WHERE is_active = TRUE;

ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view fee schedules" ON fee_schedules;
CREATE POLICY "Staff view fee schedules" ON fee_schedules FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin manage fee schedules" ON fee_schedules;
CREATE POLICY "Admin manage fee schedules" ON fee_schedules FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP TRIGGER IF EXISTS update_fee_schedules_timestamp ON fee_schedules;
CREATE TRIGGER update_fee_schedules_timestamp BEFORE UPDATE ON fee_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 16. BILLING ITEMS

CREATE OR REPLACE FUNCTION calculate_billing_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.discount_amount := COALESCE(NEW.unit_price * NEW.quantity * COALESCE(NEW.discount_percent, 0) / 100, 0);
  NEW.total_amount := (NEW.unit_price * NEW.quantity) - NEW.discount_amount + COALESCE(NEW.tax_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  order_id UUID REFERENCES clinical_orders(id) ON DELETE SET NULL,
  prescription_item_id UUID REFERENCES prescription_items(id) ON DELETE SET NULL,
  tariff_id UUID REFERENCES nhia_tariff_catalog(id) ON DELETE SET NULL,
  fee_schedule_id UUID REFERENCES fee_schedules(id) ON DELETE SET NULL,
  service_code TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  discount_percent NUMERIC(5, 2) DEFAULT 0,
  discount_amount NUMERIC(10, 2) DEFAULT 0,
  tax_amount NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  billing_status TEXT DEFAULT 'unbilled' CHECK (billing_status IN ('unbilled', 'billed', 'paid', 'waived', 'written_off')),
  billed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  billed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_billing_total ON billing_items;
CREATE TRIGGER trigger_billing_total BEFORE INSERT OR UPDATE ON billing_items
  FOR EACH ROW EXECUTE FUNCTION calculate_billing_total();

CREATE INDEX IF NOT EXISTS idx_billing_items_encounter ON billing_items(encounter_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_patient ON billing_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_status ON billing_items(billing_status);

ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view billing items" ON billing_items;
CREATE POLICY "Staff view billing items" ON billing_items FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin cashier manage billing items" ON billing_items;
CREATE POLICY "Admin cashier manage billing items" ON billing_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier', 'doctor')));

DROP TRIGGER IF EXISTS update_billing_items_timestamp ON billing_items;
CREATE TRIGGER update_billing_items_timestamp BEFORE UPDATE ON billing_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 17. CLAIM BATCHES (must come before claim_items to avoid circular)

CREATE TABLE IF NOT EXISTS claim_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_claims INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  approved_amount NUMERIC(12, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scrubbed', 'submitted', 'acknowledged', 'processing', 'partially_paid', 'paid', 'rejected')),
  scrubbed_at TIMESTAMPTZ,
  scrubbed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  scrub_errors JSONB DEFAULT '[]',
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledgment_id TEXT,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_status ON claim_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_number ON claim_batches(batch_number);

ALTER TABLE claim_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin view claim batches" ON claim_batches;
CREATE POLICY "Admin view claim batches" ON claim_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP TRIGGER IF EXISTS update_claim_batches_timestamp ON claim_batches;
CREATE TRIGGER update_claim_batches_timestamp BEFORE UPDATE ON claim_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link claims to batches and encounters
ALTER TABLE claims ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES claim_batches(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(10, 2);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_claims_batch ON claims(batch_id);
CREATE INDEX IF NOT EXISTS idx_claims_encounter ON claims(encounter_id);


-- 18. CLAIM ITEMS

CREATE TABLE IF NOT EXISTS claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  billing_item_id UUID REFERENCES billing_items(id) ON DELETE SET NULL,
  tariff_id UUID REFERENCES nhia_tariff_catalog(id) ON DELETE SET NULL,
  diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE SET NULL,
  service_code TEXT,
  gdrg_code TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  claimed_amount NUMERIC(10, 2) NOT NULL,
  approved_amount NUMERIC(10, 2),
  rejection_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'partially_approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_items_claim ON claim_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_items_status ON claim_items(status);

ALTER TABLE claim_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin view claim items" ON claim_items;
CREATE POLICY "Admin view claim items" ON claim_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP TRIGGER IF EXISTS update_claim_items_timestamp ON claim_items;
CREATE TRIGGER update_claim_items_timestamp BEFORE UPDATE ON claim_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 19. NHIA SUBMISSIONS

CREATE TABLE IF NOT EXISTS nhia_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES claim_batches(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('initial', 'resubmission', 'appeal', 'query_response')),
  submission_method TEXT DEFAULT 'api' CHECK (submission_method IN ('api', 'portal', 'manual')),
  request_payload JSONB,
  response_payload JSONB,
  http_status INTEGER,
  nhia_reference_id TEXT,
  acknowledgment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'accepted', 'rejected', 'error')),
  error_message TEXT,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nhia_sub_batch ON nhia_submissions(batch_id);
CREATE INDEX IF NOT EXISTS idx_nhia_sub_status ON nhia_submissions(status);

ALTER TABLE nhia_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin view nhia submissions" ON nhia_submissions;
CREATE POLICY "Admin view nhia submissions" ON nhia_submissions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


-- 20. PAYMENT ALLOCATIONS

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  billing_item_id UUID NOT NULL REFERENCES billing_items(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(10, 2) NOT NULL,
  allocation_type TEXT DEFAULT 'patient' CHECK (allocation_type IN ('patient', 'insurance', 'nhis', 'corporate', 'write_off')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pay_alloc_payment ON payment_allocations(payment_id);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin cashier view payment allocations" ON payment_allocations;
CREATE POLICY "Admin cashier view payment allocations" ON payment_allocations FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')));


-- ============================================================
-- FROM MIGRATION 004: Radiology & Theatre
-- ============================================================

-- 21. RADIOLOGY ORDERS

CREATE TABLE IF NOT EXISTS radiology_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES clinical_orders(id) ON DELETE SET NULL,
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  ordered_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  modality TEXT NOT NULL CHECK (modality IN ('xray', 'ct', 'mri', 'ultrasound', 'fluoroscopy', 'mammography', 'dexa')),
  body_part TEXT NOT NULL,
  laterality TEXT CHECK (laterality IN ('left', 'right', 'bilateral', 'not_applicable')),
  clinical_indication TEXT NOT NULL,
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
  contrast_required BOOLEAN DEFAULT FALSE,
  special_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_date DATE,
  scheduled_time TIME,
  performed_at TIMESTAMPTZ,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rad_orders_encounter ON radiology_orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_rad_orders_patient ON radiology_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_rad_orders_status ON radiology_orders(status);

ALTER TABLE radiology_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view radiology orders" ON radiology_orders;
CREATE POLICY "Staff view radiology orders" ON radiology_orders FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Doctors manage radiology orders" ON radiology_orders;
CREATE POLICY "Doctors manage radiology orders" ON radiology_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'lab_tech')));

DROP TRIGGER IF EXISTS update_rad_orders_timestamp ON radiology_orders;
CREATE TRIGGER update_rad_orders_timestamp BEFORE UPDATE ON radiology_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 22. RADIOLOGY RESULTS

CREATE TABLE IF NOT EXISTS radiology_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radiology_order_id UUID NOT NULL REFERENCES radiology_orders(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  radiologist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  findings TEXT NOT NULL,
  impression TEXT NOT NULL,
  recommendation TEXT,
  critical_finding BOOLEAN DEFAULT FALSE,
  critical_finding_communicated_to UUID REFERENCES users(id) ON DELETE SET NULL,
  critical_finding_communicated_at TIMESTAMPTZ,
  report_url TEXT,
  image_urls JSONB DEFAULT '[]',
  dicom_study_uid TEXT,
  report_status TEXT NOT NULL DEFAULT 'preliminary' CHECK (report_status IN ('preliminary', 'final', 'addendum', 'corrected')),
  signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rad_results_order ON radiology_results(radiology_order_id);
CREATE INDEX IF NOT EXISTS idx_rad_results_patient ON radiology_results(patient_id);

ALTER TABLE radiology_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view radiology results" ON radiology_results;
CREATE POLICY "Staff view radiology results" ON radiology_results FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Radiographers manage results" ON radiology_results;
CREATE POLICY "Radiographers manage results" ON radiology_results FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'lab_tech')));

DROP TRIGGER IF EXISTS update_rad_results_timestamp ON radiology_results;
CREATE TRIGGER update_rad_results_timestamp BEFORE UPDATE ON radiology_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 23. THEATRE BOOKINGS (formal theatre scheduling linked to encounters)

CREATE TABLE IF NOT EXISTS theatre_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  order_id UUID REFERENCES clinical_orders(id) ON DELETE SET NULL,
  procedure_name TEXT NOT NULL,
  procedure_code TEXT,
  surgery_type TEXT NOT NULL CHECK (surgery_type IN ('elective', 'emergency', 'day_case')),
  asa_class TEXT CHECK (asa_class IN ('I', 'II', 'III', 'IV', 'V', 'VI')),
  theatre_room TEXT NOT NULL,
  lead_surgeon_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assistant_surgeon_id UUID REFERENCES users(id) ON DELETE SET NULL,
  anesthetist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scrub_nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  estimated_duration_min INTEGER,
  anesthesia_type TEXT CHECK (anesthesia_type IN ('general', 'spinal', 'epidural', 'local', 'regional', 'sedation', 'none')),
  pre_op_diagnosis TEXT,
  consent_signed BOOLEAN DEFAULT FALSE,
  npo_status TEXT CHECK (npo_status IN ('compliant', 'non_compliant', 'not_required')),
  blood_units_reserved INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'in_prep', 'in_progress', 'in_recovery', 'completed', 'cancelled', 'postponed')),
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theatre_bookings_patient ON theatre_bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_theatre_bookings_scheduled ON theatre_bookings(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_theatre_bookings_status ON theatre_bookings(status);

ALTER TABLE theatre_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view theatre bookings" ON theatre_bookings;
CREATE POLICY "Staff view theatre bookings" ON theatre_bookings FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Doctors manage theatre bookings" ON theatre_bookings;
CREATE POLICY "Doctors manage theatre bookings" ON theatre_bookings FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse')));

DROP TRIGGER IF EXISTS update_theatre_bookings_timestamp ON theatre_bookings;
CREATE TRIGGER update_theatre_bookings_timestamp BEFORE UPDATE ON theatre_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 24. SURGICAL PROCEDURES

CREATE TABLE IF NOT EXISTS surgical_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES theatre_bookings(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  procedure_code TEXT,
  procedure_name TEXT NOT NULL,
  laterality TEXT CHECK (laterality IN ('left', 'right', 'bilateral', 'not_applicable')),
  anesthesia_start TIMESTAMPTZ,
  incision_time TIMESTAMPTZ,
  closure_time TIMESTAMPTZ,
  anesthesia_end TIMESTAMPTZ,
  patient_in_recovery TIMESTAMPTZ,
  actual_duration_min INTEGER,
  blood_loss_ml INTEGER,
  blood_transfused_units INTEGER DEFAULT 0,
  post_op_diagnosis TEXT,
  operative_findings TEXT,
  procedure_details TEXT,
  complications TEXT,
  specimens JSONB DEFAULT '[]',
  implants JSONB DEFAULT '[]',
  post_op_instructions TEXT,
  post_op_destination TEXT CHECK (post_op_destination IN ('ward', 'icu', 'hdu', 'day_ward', 'home')),
  wound_classification TEXT CHECK (wound_classification IN ('clean', 'clean_contaminated', 'contaminated', 'dirty')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surgical_booking ON surgical_procedures(booking_id);
CREATE INDEX IF NOT EXISTS idx_surgical_patient ON surgical_procedures(patient_id);

ALTER TABLE surgical_procedures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view surgical procedures" ON surgical_procedures;
CREATE POLICY "Staff view surgical procedures" ON surgical_procedures FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Doctors manage surgical procedures" ON surgical_procedures;
CREATE POLICY "Doctors manage surgical procedures" ON surgical_procedures FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor')));

DROP TRIGGER IF EXISTS update_surgical_procedures_timestamp ON surgical_procedures;
CREATE TRIGGER update_surgical_procedures_timestamp BEFORE UPDATE ON surgical_procedures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- FROM MIGRATION 007: Discharge Summaries + Encounter Threading
-- ============================================================

-- 25. DISCHARGE SUMMARIES

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
CREATE INDEX IF NOT EXISTS idx_discharge_date ON discharge_summaries(discharge_date DESC);

ALTER TABLE discharge_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view discharge summaries" ON discharge_summaries;
CREATE POLICY "Staff view discharge summaries" ON discharge_summaries FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Clinical staff manage discharge summaries" ON discharge_summaries;
CREATE POLICY "Clinical staff manage discharge summaries" ON discharge_summaries FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse', 'records_officer')));

DROP TRIGGER IF EXISTS update_discharge_summaries_timestamp ON discharge_summaries;
CREATE TRIGGER update_discharge_summaries_timestamp BEFORE UPDATE ON discharge_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 26. ENCOUNTER THREADING — add encounter_id to existing tables

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

-- Fix triage_assessments column mismatches
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS pain_score TEXT;
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE triage_assessments ALTER COLUMN triage_level SET DEFAULT 'yellow';

-- Fix ward_rounds columns
ALTER TABLE ward_rounds ALTER COLUMN admission_id DROP NOT NULL;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES wards(id) ON DELETE SET NULL;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS clinical_findings TEXT;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS orders TEXT;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS notes TEXT;

-- Fix clinical_orders columns
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS result_notes TEXT;

-- ============================================================
-- ANC REGISTRATIONS (from migration 004)
-- ============================================================

-- 27. ANC REGISTRATIONS

CREATE TABLE IF NOT EXISTS anc_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lmp_date DATE NOT NULL,
  edd DATE NOT NULL,
  gravida INTEGER NOT NULL DEFAULT 1,
  parity INTEGER NOT NULL DEFAULT 0,
  previous_cs INTEGER DEFAULT 0,
  previous_complications TEXT,
  blood_group TEXT,
  rhesus TEXT CHECK (rhesus IN ('positive', 'negative', 'unknown')),
  hiv_status TEXT CHECK (hiv_status IN ('positive', 'negative', 'unknown', 'declined')),
  hepatitis_b TEXT CHECK (hepatitis_b IN ('positive', 'negative', 'unknown')),
  sickling_status TEXT CHECK (sickling_status IN ('positive', 'negative', 'trait', 'unknown')),
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'moderate', 'high')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'delivered', 'referred', 'lost_to_followup', 'miscarriage')),
  registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anc_reg_patient ON anc_registrations(patient_id);
CREATE INDEX IF NOT EXISTS idx_anc_reg_edd ON anc_registrations(edd);
CREATE INDEX IF NOT EXISTS idx_anc_reg_status ON anc_registrations(status);

ALTER TABLE anc_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view anc registrations" ON anc_registrations;
CREATE POLICY "Staff view anc registrations" ON anc_registrations FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Clinical staff manage anc registrations" ON anc_registrations;
CREATE POLICY "Clinical staff manage anc registrations" ON anc_registrations FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse')));

DROP TRIGGER IF EXISTS update_anc_reg_timestamp ON anc_registrations;
CREATE TRIGGER update_anc_reg_timestamp BEFORE UPDATE ON anc_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- FINAL INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter ON prescriptions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_payments_encounter ON payments(encounter_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_encounter ON lab_tests(encounter_id);
CREATE INDEX IF NOT EXISTS idx_admissions_encounter ON admissions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_triage_encounter ON triage_assessments(encounter_id);
CREATE INDEX IF NOT EXISTS idx_ward_rounds_ward ON ward_rounds(ward_id);

-- ============================================================
-- MIGRATION 012 COMPLETE
-- Tables created: encounters, diagnoses, vitals, clinical_notes,
--   clinical_orders, problem_list, allergies,
--   medication_administration_records, fluid_balance_charts,
--   nursing_assessments, nursing_care_plans, ward_rounds, handover_notes,
--   nhia_tariff_catalog, fee_schedules, billing_items, claim_batches,
--   claim_items, nhia_submissions, payment_allocations,
--   radiology_orders, radiology_results,
--   theatre_bookings, surgical_procedures,
--   discharge_summaries, anc_registrations
-- Tables altered: prescriptions, payments, claims, lab_tests,
--   admissions, triage_assessments, ward_rounds, clinical_orders
-- ============================================================
