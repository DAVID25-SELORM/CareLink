-- ============================================
-- CareLink HMS — Migration 002: Nursing & Ward Management
-- Full nursing workflow, MAR, fluid balance, transfers
-- Depends on: 001_core_clinical.sql (encounters), advanced-features-setup.sql (wards, beds, admissions)
-- ============================================

-- ============================================
-- 1. MEDICATION ADMINISTRATION RECORDS (MAR)
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_mar_administered_by ON medication_administration_records(administered_by);

COMMENT ON TABLE medication_administration_records IS 'MAR — tracks every scheduled and administered medication dose for inpatients';

-- ============================================
-- 2. FLUID BALANCE CHARTS
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_fluid_balance_type ON fluid_balance_charts(entry_type);

COMMENT ON TABLE fluid_balance_charts IS 'I/O fluid balance tracking for inpatients';

-- View for daily fluid balance totals
CREATE OR REPLACE VIEW fluid_balance_daily AS
SELECT
  admission_id,
  patient_id,
  chart_date,
  SUM(CASE WHEN entry_type = 'intake' THEN volume_ml ELSE 0 END) AS total_intake_ml,
  SUM(CASE WHEN entry_type = 'output' THEN volume_ml ELSE 0 END) AS total_output_ml,
  SUM(CASE WHEN entry_type = 'intake' THEN volume_ml ELSE 0 END)
    - SUM(CASE WHEN entry_type = 'output' THEN volume_ml ELSE 0 END) AS net_balance_ml
FROM fluid_balance_charts
GROUP BY admission_id, patient_id, chart_date;

-- ============================================
-- 3. NURSING ASSESSMENTS
-- Glasgow, Braden, Fall Risk, Pain, Nutritional
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_nursing_assess_admission ON nursing_assessments(admission_id);
CREATE INDEX IF NOT EXISTS idx_nursing_assess_encounter ON nursing_assessments(encounter_id);
CREATE INDEX IF NOT EXISTS idx_nursing_assess_patient ON nursing_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_nursing_assess_type ON nursing_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_nursing_assess_due ON nursing_assessments(next_assessment_due);

COMMENT ON TABLE nursing_assessments IS 'Structured nursing assessments — Glasgow, Braden, fall risk, etc.';
COMMENT ON COLUMN nursing_assessments.scores IS 'JSONB — assessment-specific sub-scores, e.g. {"eye":4, "verbal":5, "motor":6} for Glasgow';

-- ============================================
-- 4. NURSING CARE PLANS
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_care_plans_admission ON nursing_care_plans(admission_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON nursing_care_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON nursing_care_plans(status);

COMMENT ON TABLE nursing_care_plans IS 'Goal-oriented nursing care plans with interventions and evaluation';
COMMENT ON COLUMN nursing_care_plans.interventions IS 'JSONB array of intervention objects: [{"action": "...", "frequency": "...", "responsible": "..."}]';

-- ============================================
-- 5. WARD ROUNDS
-- ============================================

CREATE TABLE IF NOT EXISTS ward_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_type TEXT DEFAULT 'routine' CHECK (round_type IN ('routine', 'consultant', 'grand', 'teaching', 'night')),
  observations TEXT,
  assessment TEXT,
  new_orders TEXT,
  plan TEXT,
  diet_orders TEXT,
  activity_orders TEXT,
  condition_status TEXT CHECK (condition_status IN ('improving', 'stable', 'deteriorating', 'critical')),
  next_round_date DATE,
  attendees JSONB DEFAULT '[]',
  round_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ward_rounds_admission ON ward_rounds(admission_id);
CREATE INDEX IF NOT EXISTS idx_ward_rounds_patient ON ward_rounds(patient_id);
CREATE INDEX IF NOT EXISTS idx_ward_rounds_doctor ON ward_rounds(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ward_rounds_time ON ward_rounds(round_time DESC);

COMMENT ON TABLE ward_rounds IS 'Doctor ward round notes per admitted patient';

-- ============================================
-- 6. HANDOVER NOTES (Structured)
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_handover_outgoing ON handover_notes(outgoing_nurse_id);
CREATE INDEX IF NOT EXISTS idx_handover_date ON handover_notes(handover_date DESC);
CREATE INDEX IF NOT EXISTS idx_handover_shift ON handover_notes(shift_type);

COMMENT ON TABLE handover_notes IS 'Structured shift handover replacing free-text notes';
COMMENT ON COLUMN handover_notes.critical_alerts IS 'JSONB array: [{"patient_name": "...", "alert": "...", "priority": "high"}]';
COMMENT ON COLUMN handover_notes.patient_summaries IS 'JSONB array: [{"patient_id": "...", "bed": "...", "summary": "...", "tasks": [...]}]';

-- ============================================
-- 7. PATIENT TRANSFERS
-- ============================================

CREATE TABLE IF NOT EXISTS patient_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  from_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  to_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  from_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  to_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  transfer_type TEXT DEFAULT 'internal' CHECK (transfer_type IN ('internal', 'external', 'step_up', 'step_down')),
  clinical_status_at_transfer TEXT,
  authorized_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  escorted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  transfer_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibility for databases where patient_transfers was created by an
-- earlier/procurement migration with a smaller column set.
ALTER TABLE patient_transfers
  ADD COLUMN IF NOT EXISTS admission_id UUID REFERENCES admissions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS from_ward_id UUID REFERENCES wards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS to_ward_id UUID REFERENCES wards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS from_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_type TEXT DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS clinical_status_at_transfer TEXT,
  ADD COLUMN IF NOT EXISTS authorized_by UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS escorted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patient_transfers'
      AND column_name = 'transfer_date'
  ) THEN
    UPDATE patient_transfers
    SET transfer_time = COALESCE(transfer_time, transfer_date, created_at, NOW())
    WHERE transfer_time IS NULL;
  ELSE
    UPDATE patient_transfers
    SET transfer_time = COALESCE(transfer_time, created_at, NOW())
    WHERE transfer_time IS NULL;
  END IF;
END $$;

ALTER TABLE patient_transfers
  ALTER COLUMN transfer_time SET DEFAULT NOW();

-- Auto-update bed statuses on transfer
CREATE OR REPLACE FUNCTION handle_patient_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Free up the source bed
  IF NEW.from_bed_id IS NOT NULL THEN
    UPDATE beds SET status = 'cleaning', current_patient_id = NULL, assigned_at = NULL
    WHERE id = NEW.from_bed_id;
  END IF;
  -- Assign the destination bed
  IF NEW.to_bed_id IS NOT NULL THEN
    UPDATE beds SET status = 'occupied', current_patient_id = NEW.patient_id, assigned_at = NOW()
    WHERE id = NEW.to_bed_id;
  END IF;
  -- Update the admission record
  UPDATE admissions SET ward_id = NEW.to_ward_id, bed_id = NEW.to_bed_id, updated_at = NOW()
  WHERE id = NEW.admission_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_patient_transfer ON patient_transfers;
CREATE TRIGGER trigger_patient_transfer
  AFTER INSERT ON patient_transfers
  FOR EACH ROW
  EXECUTE FUNCTION handle_patient_transfer();

CREATE INDEX IF NOT EXISTS idx_transfers_admission ON patient_transfers(admission_id);
CREATE INDEX IF NOT EXISTS idx_transfers_patient ON patient_transfers(patient_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_ward ON patient_transfers(from_ward_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_ward ON patient_transfers(to_ward_id);
CREATE INDEX IF NOT EXISTS idx_transfers_time ON patient_transfers(transfer_time DESC);

COMMENT ON TABLE patient_transfers IS 'Tracks all patient ward/bed transfers with auto-bed-status updates';

-- ============================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_mar_timestamp ON medication_administration_records;
CREATE TRIGGER update_mar_timestamp
  BEFORE UPDATE ON medication_administration_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nursing_assessments_timestamp ON nursing_assessments;
CREATE TRIGGER update_nursing_assessments_timestamp
  BEFORE UPDATE ON nursing_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_care_plans_timestamp ON nursing_care_plans;
CREATE TRIGGER update_care_plans_timestamp
  BEFORE UPDATE ON nursing_care_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ward_rounds_timestamp ON ward_rounds;
CREATE TRIGGER update_ward_rounds_timestamp
  BEFORE UPDATE ON ward_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_handover_notes_timestamp ON handover_notes;
CREATE TRIGGER update_handover_notes_timestamp
  BEFORE UPDATE ON handover_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE medication_administration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluid_balance_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nursing_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nursing_care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_transfers ENABLE ROW LEVEL SECURITY;

-- MAR: nurses and doctors
DROP POLICY IF EXISTS "Clinical staff view MAR" ON medication_administration_records;
CREATE POLICY "Clinical staff view MAR"
  ON medication_administration_records FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Nurses manage MAR" ON medication_administration_records;
CREATE POLICY "Nurses manage MAR"
  ON medication_administration_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'nurse', 'doctor')
  ));

-- Fluid Balance: nurses and doctors
DROP POLICY IF EXISTS "Clinical staff view fluid balance" ON fluid_balance_charts;
CREATE POLICY "Clinical staff view fluid balance"
  ON fluid_balance_charts FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Nurses manage fluid balance" ON fluid_balance_charts;
CREATE POLICY "Nurses manage fluid balance"
  ON fluid_balance_charts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'nurse', 'doctor')
  ));

-- Nursing Assessments: nurses and doctors
DROP POLICY IF EXISTS "Staff view nursing assessments" ON nursing_assessments;
CREATE POLICY "Staff view nursing assessments"
  ON nursing_assessments FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Nurses manage assessments" ON nursing_assessments;
CREATE POLICY "Nurses manage assessments"
  ON nursing_assessments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'nurse')
  ));

-- Care Plans: nurses
DROP POLICY IF EXISTS "Staff view care plans" ON nursing_care_plans;
CREATE POLICY "Staff view care plans"
  ON nursing_care_plans FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Nurses manage care plans" ON nursing_care_plans;
CREATE POLICY "Nurses manage care plans"
  ON nursing_care_plans FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'nurse')
  ));

-- Ward Rounds: doctors
DROP POLICY IF EXISTS "Staff view ward rounds" ON ward_rounds;
CREATE POLICY "Staff view ward rounds"
  ON ward_rounds FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Doctors manage ward rounds" ON ward_rounds;
CREATE POLICY "Doctors manage ward rounds"
  ON ward_rounds FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

-- Handover Notes: nurses
DROP POLICY IF EXISTS "Nurses view handover notes" ON handover_notes;
CREATE POLICY "Nurses view handover notes"
  ON handover_notes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'nurse', 'doctor')
  ));

DROP POLICY IF EXISTS "Nurses manage handover notes" ON handover_notes;
CREATE POLICY "Nurses manage handover notes"
  ON handover_notes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'nurse')
  ));

-- Patient Transfers: admin, doctors, nurses
DROP POLICY IF EXISTS "Staff view transfers" ON patient_transfers;
CREATE POLICY "Staff view transfers"
  ON patient_transfers FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Clinical staff manage transfers" ON patient_transfers;
CREATE POLICY "Clinical staff manage transfers"
  ON patient_transfers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

-- ============================================
-- MIGRATION 002 COMPLETE
-- Tables created: medication_administration_records, fluid_balance_charts,
--                 nursing_assessments, nursing_care_plans, ward_rounds,
--                 handover_notes, patient_transfers
-- Views created:  fluid_balance_daily
-- Triggers:       handle_patient_transfer (auto-updates beds on transfer)
-- ============================================
