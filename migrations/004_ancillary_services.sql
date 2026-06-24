-- ============================================
-- CareLink HMS — Migration 004: Ancillary Services & Pharmacy Enhancement
-- Radiology, Theatre, Maternity, Mortuary, Dental, Physiotherapy,
-- Lab Enhancement, Pharmacy Enhancement
-- Depends on: 001_core_clinical.sql (encounters, clinical_orders, diagnoses)
-- ============================================

-- ============================================
-- 1. RADIOLOGY
-- ============================================

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
  contrast_type TEXT,
  pregnancy_status TEXT CHECK (pregnancy_status IN ('not_pregnant', 'pregnant', 'unknown', 'not_applicable')),
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
CREATE INDEX IF NOT EXISTS idx_rad_orders_modality ON radiology_orders(modality);
CREATE INDEX IF NOT EXISTS idx_rad_orders_status ON radiology_orders(status);
CREATE INDEX IF NOT EXISTS idx_rad_orders_scheduled ON radiology_orders(scheduled_date);

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
CREATE INDEX IF NOT EXISTS idx_rad_results_status ON radiology_results(report_status);

COMMENT ON TABLE radiology_orders IS 'Radiology examination orders linked to clinical orders';
COMMENT ON TABLE radiology_results IS 'Radiology reports with findings, impressions, and image links';

-- ============================================
-- 2. THEATRE / SURGICAL PROCEDURES
-- ============================================

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
  circulating_nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  estimated_duration_min INTEGER,
  anesthesia_type TEXT CHECK (anesthesia_type IN ('general', 'spinal', 'epidural', 'local', 'regional', 'sedation', 'none')),
  pre_op_diagnosis TEXT,
  consent_signed BOOLEAN DEFAULT FALSE,
  consent_signed_at TIMESTAMPTZ,
  npo_status TEXT CHECK (npo_status IN ('compliant', 'non_compliant', 'not_required')),
  blood_units_reserved INTEGER DEFAULT 0,
  special_equipment TEXT,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'in_prep', 'in_progress', 'in_recovery', 'completed', 'cancelled', 'postponed')),
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theatre_encounter ON theatre_bookings(encounter_id);
CREATE INDEX IF NOT EXISTS idx_theatre_patient ON theatre_bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_theatre_surgeon ON theatre_bookings(lead_surgeon_id);
CREATE INDEX IF NOT EXISTS idx_theatre_scheduled ON theatre_bookings(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_theatre_status ON theatre_bookings(status);
CREATE INDEX IF NOT EXISTS idx_theatre_room ON theatre_bookings(theatre_room);

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
  drain_details JSONB DEFAULT '[]',
  post_op_instructions TEXT,
  post_op_destination TEXT CHECK (post_op_destination IN ('ward', 'icu', 'hdu', 'day_ward', 'home')),
  wound_classification TEXT CHECK (wound_classification IN ('clean', 'clean_contaminated', 'contaminated', 'dirty')),
  ssi_risk_score NUMERIC(3, 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surgical_booking ON surgical_procedures(booking_id);
CREATE INDEX IF NOT EXISTS idx_surgical_patient ON surgical_procedures(patient_id);

COMMENT ON TABLE theatre_bookings IS 'Theatre scheduling with full surgical team and equipment tracking';
COMMENT ON TABLE surgical_procedures IS 'Intra-operative documentation with times, findings, specimens';

-- ============================================
-- 3. MATERNITY / ANC
-- ============================================

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anc_reg_patient ON anc_registrations(patient_id);
CREATE INDEX IF NOT EXISTS idx_anc_reg_edd ON anc_registrations(edd);
CREATE INDEX IF NOT EXISTS idx_anc_reg_status ON anc_registrations(status);

CREATE TABLE IF NOT EXISTS anc_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anc_registration_id UUID NOT NULL REFERENCES anc_registrations(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_number INTEGER NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  gestational_age_weeks INTEGER NOT NULL,
  weight_kg NUMERIC(5, 1),
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  fundal_height_cm NUMERIC(4, 1),
  fetal_heart_rate INTEGER,
  fetal_presentation TEXT CHECK (fetal_presentation IN ('cephalic', 'breech', 'transverse', 'oblique', 'not_applicable')),
  fetal_lie TEXT CHECK (fetal_lie IN ('longitudinal', 'transverse', 'oblique', 'not_applicable')),
  urine_protein TEXT CHECK (urine_protein IN ('negative', 'trace', '+', '++', '+++', '++++')),
  urine_glucose TEXT CHECK (urine_glucose IN ('negative', 'trace', '+', '++', '+++', '++++')),
  hemoglobin NUMERIC(4, 1),
  edema TEXT CHECK (edema IN ('none', 'mild', 'moderate', 'severe')),
  ipt_dose INTEGER,
  tt_dose INTEGER,
  iron_folate_given BOOLEAN DEFAULT FALSE,
  complications TEXT,
  interventions TEXT,
  next_visit_date DATE,
  seen_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anc_visits_reg ON anc_visits(anc_registration_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_patient ON anc_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_date ON anc_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_anc_visits_gest_age ON anc_visits(gestational_age_weeks);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anc_registration_id UUID REFERENCES anc_registrations(id) ON DELETE SET NULL,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  delivery_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gestational_age_weeks INTEGER,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('svd', 'cs_elective', 'cs_emergency', 'vacuum', 'forceps', 'breech')),
  delivery_outcome TEXT NOT NULL CHECK (delivery_outcome IN ('live_birth', 'stillbirth', 'neonatal_death', 'multiple_births')),
  number_of_babies INTEGER DEFAULT 1,
  baby_gender TEXT CHECK (baby_gender IN ('male', 'female', 'ambiguous')),
  baby_weight_kg NUMERIC(3, 2),
  apgar_1min INTEGER CHECK (apgar_1min BETWEEN 0 AND 10),
  apgar_5min INTEGER CHECK (apgar_5min BETWEEN 0 AND 10),
  apgar_10min INTEGER CHECK (apgar_10min BETWEEN 0 AND 10),
  resuscitation_required BOOLEAN DEFAULT FALSE,
  resuscitation_details TEXT,
  placenta_delivery TEXT CHECK (placenta_delivery IN ('complete', 'incomplete', 'manual_removal', 'retained')),
  blood_loss_ml INTEGER,
  perineal_status TEXT CHECK (perineal_status IN ('intact', 'first_degree', 'second_degree', 'third_degree', 'fourth_degree', 'episiotomy')),
  cord_blood_collected BOOLEAN DEFAULT FALSE,
  breastfeeding_initiated BOOLEAN DEFAULT FALSE,
  breastfeeding_time_min INTEGER,
  maternal_complications TEXT,
  neonatal_complications TEXT,
  delivered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assisted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_patient ON deliveries(patient_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_anc ON deliveries(anc_registration_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_type ON deliveries(delivery_type);

CREATE TABLE IF NOT EXISTS postnatal_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  visit_number INTEGER NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  days_postpartum INTEGER NOT NULL,
  maternal_bp_systolic INTEGER,
  maternal_bp_diastolic INTEGER,
  maternal_temperature NUMERIC(4, 1),
  uterine_involution TEXT CHECK (uterine_involution IN ('well_contracted', 'subinvolution', 'normal')),
  lochia TEXT CHECK (lochia IN ('rubra', 'serosa', 'alba', 'abnormal')),
  wound_healing TEXT CHECK (wound_healing IN ('good', 'infected', 'dehiscence', 'not_applicable')),
  breastfeeding_status TEXT CHECK (breastfeeding_status IN ('exclusive', 'mixed', 'formula', 'not_breastfeeding')),
  baby_weight_kg NUMERIC(3, 2),
  baby_feeding_well BOOLEAN DEFAULT TRUE,
  baby_jaundice BOOLEAN DEFAULT FALSE,
  baby_cord_status TEXT CHECK (baby_cord_status IN ('attached', 'separated', 'infected')),
  immunizations_given TEXT,
  family_planning_counseling BOOLEAN DEFAULT FALSE,
  family_planning_method TEXT,
  complications TEXT,
  seen_by UUID REFERENCES users(id) ON DELETE SET NULL,
  next_visit_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_postnatal_delivery ON postnatal_visits(delivery_id);
CREATE INDEX IF NOT EXISTS idx_postnatal_patient ON postnatal_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_postnatal_date ON postnatal_visits(visit_date);

COMMENT ON TABLE anc_registrations IS 'ANC registration with obstetric history and risk assessment';
COMMENT ON TABLE anc_visits IS 'Antenatal care visit tracking per pregnancy';
COMMENT ON TABLE deliveries IS 'Delivery records with outcome, APGAR, complications';
COMMENT ON TABLE postnatal_visits IS 'Postnatal follow-up for mother and baby';

-- ============================================
-- 4. MORTUARY
-- ============================================

CREATE TABLE IF NOT EXISTS mortuary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  deceased_name TEXT NOT NULL,
  deceased_age INTEGER,
  deceased_gender TEXT CHECK (deceased_gender IN ('male', 'female', 'other')),
  cause_of_death TEXT,
  secondary_cause TEXT,
  manner_of_death TEXT CHECK (manner_of_death IN ('natural', 'accident', 'homicide', 'suicide', 'undetermined', 'pending')),
  time_of_death TIMESTAMPTZ,
  date_of_death DATE NOT NULL,
  place_of_death TEXT DEFAULT 'hospital' CHECK (place_of_death IN ('hospital', 'brought_in_dead', 'home', 'other')),
  body_tag_number TEXT NOT NULL UNIQUE,
  storage_unit TEXT NOT NULL,
  storage_status TEXT DEFAULT 'stored' CHECK (storage_status IN ('stored', 'released', 'awaiting_autopsy', 'autopsy_complete', 'unclaimed')),
  admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  autopsy_required BOOLEAN DEFAULT FALSE,
  autopsy_date DATE,
  autopsy_findings TEXT,
  death_certificate_number TEXT,
  death_certificate_issued BOOLEAN DEFAULT FALSE,
  embalmed BOOLEAN DEFAULT FALSE,
  embalmed_date DATE,
  released_to TEXT,
  released_to_relationship TEXT,
  released_to_id_number TEXT,
  release_date TIMESTAMPTZ,
  released_by UUID REFERENCES users(id) ON DELETE SET NULL,
  attending_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mortuary_patient ON mortuary_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_mortuary_tag ON mortuary_records(body_tag_number);
CREATE INDEX IF NOT EXISTS idx_mortuary_status ON mortuary_records(storage_status);
CREATE INDEX IF NOT EXISTS idx_mortuary_admission ON mortuary_records(admission_date DESC);

COMMENT ON TABLE mortuary_records IS 'Mortuary management — body storage, autopsy, release tracking';

-- ============================================
-- 5. DENTAL
-- ============================================

CREATE TABLE IF NOT EXISTS dental_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dentist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tooth_number INTEGER CHECK (tooth_number BETWEEN 1 AND 32),
  tooth_surface TEXT,
  quadrant TEXT CHECK (quadrant IN ('upper_right', 'upper_left', 'lower_right', 'lower_left')),
  condition TEXT NOT NULL CHECK (condition IN ('caries', 'fractured', 'missing', 'impacted', 'periodontal', 'abscess', 'healthy', 'restored', 'crown', 'bridge', 'implant')),
  procedure_performed TEXT,
  procedure_code TEXT,
  material_used TEXT,
  anesthesia_used BOOLEAN DEFAULT FALSE,
  anesthesia_type TEXT,
  xray_taken BOOLEAN DEFAULT FALSE,
  xray_findings TEXT,
  treatment_plan TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dental_encounter ON dental_records(encounter_id);
CREATE INDEX IF NOT EXISTS idx_dental_patient ON dental_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_dental_tooth ON dental_records(tooth_number);

COMMENT ON TABLE dental_records IS 'Dental charting and procedure records per encounter';

-- ============================================
-- 6. PHYSIOTHERAPY
-- ============================================

CREATE TABLE IF NOT EXISTS physiotherapy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  order_id UUID REFERENCES clinical_orders(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_diagnosis TEXT NOT NULL,
  assessment TEXT,
  treatment_goals JSONB DEFAULT '[]',
  treatment_plan TEXT,
  exercises JSONB DEFAULT '[]',
  modalities_used JSONB DEFAULT '[]',
  session_number INTEGER NOT NULL DEFAULT 1,
  total_sessions_planned INTEGER,
  pain_before INTEGER CHECK (pain_before BETWEEN 0 AND 10),
  pain_after INTEGER CHECK (pain_after BETWEEN 0 AND 10),
  rom_measurements JSONB,
  strength_measurements JSONB,
  functional_assessment TEXT,
  progress_notes TEXT,
  patient_compliance TEXT CHECK (patient_compliance IN ('excellent', 'good', 'fair', 'poor')),
  home_exercise_program TEXT,
  next_session_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discharged', 'discontinued', 'on_hold')),
  discharge_summary TEXT,
  session_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_physio_patient ON physiotherapy_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_physio_therapist ON physiotherapy_sessions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_physio_encounter ON physiotherapy_sessions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_physio_status ON physiotherapy_sessions(status);
CREATE INDEX IF NOT EXISTS idx_physio_date ON physiotherapy_sessions(session_date DESC);

COMMENT ON TABLE physiotherapy_sessions IS 'Physical therapy sessions with exercises, ROM, strength tracking';
COMMENT ON COLUMN physiotherapy_sessions.exercises IS 'JSONB: [{"name": "...", "sets": 3, "reps": 10, "notes": "..."}]';
COMMENT ON COLUMN physiotherapy_sessions.modalities_used IS 'JSONB: [{"type": "ultrasound", "duration_min": 10, "area": "..."}]';

-- ============================================
-- 7. LAB TEST CATALOG & SPECIMENS
-- Enhancement to existing lab_tests
-- ============================================

CREATE TABLE IF NOT EXISTS lab_test_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code TEXT NOT NULL UNIQUE,
  loinc_code TEXT,
  test_name TEXT NOT NULL,
  test_category TEXT NOT NULL CHECK (test_category IN ('hematology', 'biochemistry', 'microbiology', 'immunology', 'parasitology', 'urinalysis', 'serology', 'histopathology', 'cytology', 'blood_bank')),
  specimen_type TEXT NOT NULL CHECK (specimen_type IN ('blood', 'urine', 'stool', 'csf', 'sputum', 'swab', 'tissue', 'aspirate', 'other')),
  container_type TEXT,
  sample_volume_ml NUMERIC(5, 1),
  department TEXT DEFAULT 'laboratory',
  turnaround_time_hours INTEGER,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  reference_ranges JSONB DEFAULT '{}',
  critical_values JSONB DEFAULT '{}',
  instructions TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_catalog_code ON lab_test_catalog(test_code);
CREATE INDEX IF NOT EXISTS idx_lab_catalog_loinc ON lab_test_catalog(loinc_code);
CREATE INDEX IF NOT EXISTS idx_lab_catalog_category ON lab_test_catalog(test_category);
CREATE INDEX IF NOT EXISTS idx_lab_catalog_active ON lab_test_catalog(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS lab_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_code TEXT NOT NULL UNIQUE,
  panel_name TEXT NOT NULL,
  description TEXT,
  tests JSONB NOT NULL DEFAULT '[]',
  price NUMERIC(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lab_panels IS 'Lab test panels grouping related tests (CBC, LFT, RFT, etc.)';
COMMENT ON COLUMN lab_panels.tests IS 'JSONB: array of lab_test_catalog IDs in this panel';

CREATE TABLE IF NOT EXISTS lab_specimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specimen_barcode TEXT NOT NULL UNIQUE,
  lab_test_id UUID NOT NULL REFERENCES lab_tests(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  specimen_type TEXT NOT NULL,
  collection_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition TEXT DEFAULT 'adequate' CHECK (condition IN ('adequate', 'hemolyzed', 'lipemic', 'icteric', 'clotted', 'insufficient', 'contaminated')),
  received_time TIMESTAMPTZ,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  processing_status TEXT DEFAULT 'collected' CHECK (processing_status IN ('collected', 'received', 'processing', 'analyzed', 'stored', 'disposed', 'rejected')),
  rejection_reason TEXT,
  storage_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_specimens_barcode ON lab_specimens(specimen_barcode);
CREATE INDEX IF NOT EXISTS idx_specimens_lab_test ON lab_specimens(lab_test_id);
CREATE INDEX IF NOT EXISTS idx_specimens_patient ON lab_specimens(patient_id);
CREATE INDEX IF NOT EXISTS idx_specimens_status ON lab_specimens(processing_status);

COMMENT ON TABLE lab_specimens IS 'Specimen tracking with barcode identification';

-- Enhance existing lab_tests with structured results
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES lab_test_catalog(id) ON DELETE SET NULL;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS numeric_value NUMERIC(10, 3);

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS unit TEXT;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS reference_range TEXT;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS result_flag TEXT CHECK (result_flag IN ('normal', 'low', 'high', 'critical_low', 'critical_high'));

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS panel_id UUID REFERENCES lab_panels(id) ON DELETE SET NULL;

-- ============================================
-- 8. PHARMACY ENHANCEMENT
-- Batch tracking, suppliers, purchase orders, controlled substances
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  license_number TEXT,
  tax_id TEXT,
  payment_terms TEXT DEFAULT 'net_30' CHECK (payment_terms IN ('cod', 'net_15', 'net_30', 'net_60', 'net_90')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  order_items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'GHS',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'ordered', 'partially_received', 'received', 'cancelled')),
  ordered_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  expected_delivery_date DATE,
  received_date DATE,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invoice_number TEXT,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);

CREATE TABLE IF NOT EXISTS drug_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  cost_per_unit NUMERIC(10, 2),
  total_cost NUMERIC(12, 2),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired', 'recalled', 'quarantined')),
  storage_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(drug_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_drug_batches_drug ON drug_batches(drug_id);
CREATE INDEX IF NOT EXISTS idx_drug_batches_expiry ON drug_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_drug_batches_status ON drug_batches(status);

-- Enhance existing drugs table
ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS is_controlled BOOLEAN DEFAULT FALSE;

ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS schedule TEXT CHECK (schedule IN ('1', '2', '3', '4', '5'));

ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS generic_name TEXT;

ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS brand_name TEXT;

ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS dosage_form TEXT CHECK (dosage_form IN ('tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'suppository', 'patch', 'powder', 'suspension', 'solution', 'other'));

CREATE TABLE IF NOT EXISTS controlled_substance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  drug_batch_id UUID REFERENCES drug_batches(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('received', 'dispensed', 'wasted', 'returned', 'adjustment')),
  quantity INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  dispensed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  witnessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  witness_signature_confirmed BOOLEAN DEFAULT FALSE,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controlled_drug ON controlled_substance_log(drug_id);
CREATE INDEX IF NOT EXISTS idx_controlled_patient ON controlled_substance_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_controlled_type ON controlled_substance_log(transaction_type);
CREATE INDEX IF NOT EXISTS idx_controlled_created ON controlled_substance_log(created_at DESC);

COMMENT ON TABLE controlled_substance_log IS 'DEA-style controlled substance tracking with witness verification';

-- Drug interactions reference table
CREATE TABLE IF NOT EXISTS drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a_name TEXT NOT NULL,
  drug_b_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major', 'contraindicated')),
  interaction_type TEXT CHECK (interaction_type IN ('pharmacokinetic', 'pharmacodynamic', 'additive', 'synergistic', 'antagonistic')),
  description TEXT NOT NULL,
  clinical_significance TEXT,
  management TEXT,
  source TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(drug_a_name, drug_b_name)
);

CREATE INDEX IF NOT EXISTS idx_interactions_drug_a ON drug_interactions(drug_a_name);
CREATE INDEX IF NOT EXISTS idx_interactions_drug_b ON drug_interactions(drug_b_name);
CREATE INDEX IF NOT EXISTS idx_interactions_severity ON drug_interactions(severity);

COMMENT ON TABLE drug_interactions IS 'Drug-drug interaction reference for prescription safety checking';

-- ============================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_rad_orders_timestamp ON radiology_orders;
CREATE TRIGGER update_rad_orders_timestamp
  BEFORE UPDATE ON radiology_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rad_results_timestamp ON radiology_results;
CREATE TRIGGER update_rad_results_timestamp
  BEFORE UPDATE ON radiology_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_theatre_timestamp ON theatre_bookings;
CREATE TRIGGER update_theatre_timestamp
  BEFORE UPDATE ON theatre_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_surgical_timestamp ON surgical_procedures;
CREATE TRIGGER update_surgical_timestamp
  BEFORE UPDATE ON surgical_procedures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_anc_reg_timestamp ON anc_registrations;
CREATE TRIGGER update_anc_reg_timestamp
  BEFORE UPDATE ON anc_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_anc_visits_timestamp ON anc_visits;
CREATE TRIGGER update_anc_visits_timestamp
  BEFORE UPDATE ON anc_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_timestamp ON deliveries;
CREATE TRIGGER update_deliveries_timestamp
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_postnatal_timestamp ON postnatal_visits;
CREATE TRIGGER update_postnatal_timestamp
  BEFORE UPDATE ON postnatal_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mortuary_timestamp ON mortuary_records;
CREATE TRIGGER update_mortuary_timestamp
  BEFORE UPDATE ON mortuary_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dental_timestamp ON dental_records;
CREATE TRIGGER update_dental_timestamp
  BEFORE UPDATE ON dental_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_physio_timestamp ON physiotherapy_sessions;
CREATE TRIGGER update_physio_timestamp
  BEFORE UPDATE ON physiotherapy_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lab_catalog_timestamp ON lab_test_catalog;
CREATE TRIGGER update_lab_catalog_timestamp
  BEFORE UPDATE ON lab_test_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lab_panels_timestamp ON lab_panels;
CREATE TRIGGER update_lab_panels_timestamp
  BEFORE UPDATE ON lab_panels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_specimens_timestamp ON lab_specimens;
CREATE TRIGGER update_specimens_timestamp
  BEFORE UPDATE ON lab_specimens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_timestamp ON suppliers;
CREATE TRIGGER update_suppliers_timestamp
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_po_timestamp ON purchase_orders;
CREATE TRIGGER update_po_timestamp
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drug_batches_timestamp ON drug_batches;
CREATE TRIGGER update_drug_batches_timestamp
  BEFORE UPDATE ON drug_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE radiology_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgical_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE anc_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE anc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE postnatal_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE mortuary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE physiotherapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_test_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_specimens ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlled_substance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;

-- Authenticated staff can view all ancillary tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'radiology_orders', 'radiology_results', 'theatre_bookings', 'surgical_procedures',
      'anc_registrations', 'anc_visits', 'deliveries', 'postnatal_visits',
      'mortuary_records', 'dental_records', 'physiotherapy_sessions',
      'lab_test_catalog', 'lab_panels', 'lab_specimens',
      'suppliers', 'purchase_orders', 'drug_batches',
      'controlled_substance_log', 'drug_interactions'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated staff view %I" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Authenticated staff view %I" ON %I FOR SELECT TO authenticated USING (TRUE)', tbl, tbl);
  END LOOP;
END $$;

-- Department-specific write policies
DROP POLICY IF EXISTS "Clinical staff manage radiology orders" ON radiology_orders;
CREATE POLICY "Clinical staff manage radiology orders"
  ON radiology_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

DROP POLICY IF EXISTS "Radiologists manage results" ON radiology_results;
CREATE POLICY "Radiologists manage results"
  ON radiology_results FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

DROP POLICY IF EXISTS "Surgical staff manage theatre" ON theatre_bookings;
CREATE POLICY "Surgical staff manage theatre"
  ON theatre_bookings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

DROP POLICY IF EXISTS "Surgical staff manage procedures" ON surgical_procedures;
CREATE POLICY "Surgical staff manage procedures"
  ON surgical_procedures FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

DROP POLICY IF EXISTS "Maternity staff manage ANC" ON anc_registrations;
CREATE POLICY "Maternity staff manage ANC"
  ON anc_registrations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

DROP POLICY IF EXISTS "Maternity staff manage ANC visits" ON anc_visits;
CREATE POLICY "Maternity staff manage ANC visits"
  ON anc_visits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

DROP POLICY IF EXISTS "Maternity staff manage deliveries" ON deliveries;
CREATE POLICY "Maternity staff manage deliveries"
  ON deliveries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

DROP POLICY IF EXISTS "Maternity staff manage postnatal" ON postnatal_visits;
CREATE POLICY "Maternity staff manage postnatal"
  ON postnatal_visits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

DROP POLICY IF EXISTS "Admin manage mortuary" ON mortuary_records;
CREATE POLICY "Admin manage mortuary"
  ON mortuary_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

DROP POLICY IF EXISTS "Dental staff manage records" ON dental_records;
CREATE POLICY "Dental staff manage records"
  ON dental_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  ));

DROP POLICY IF EXISTS "Therapists manage physio" ON physiotherapy_sessions;
CREATE POLICY "Therapists manage physio"
  ON physiotherapy_sessions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

DROP POLICY IF EXISTS "Lab staff manage catalog" ON lab_test_catalog;
CREATE POLICY "Lab staff manage catalog"
  ON lab_test_catalog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "Lab staff manage panels" ON lab_panels;
CREATE POLICY "Lab staff manage panels"
  ON lab_panels FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "Lab staff manage specimens" ON lab_specimens;
CREATE POLICY "Lab staff manage specimens"
  ON lab_specimens FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor', 'nurse')
  ));

DROP POLICY IF EXISTS "Pharmacy staff manage suppliers" ON suppliers;
CREATE POLICY "Pharmacy staff manage suppliers"
  ON suppliers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'pharmacist')
  ));

DROP POLICY IF EXISTS "Pharmacy staff manage POs" ON purchase_orders;
CREATE POLICY "Pharmacy staff manage POs"
  ON purchase_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'pharmacist')
  ));

DROP POLICY IF EXISTS "Pharmacy staff manage batches" ON drug_batches;
CREATE POLICY "Pharmacy staff manage batches"
  ON drug_batches FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'pharmacist')
  ));

DROP POLICY IF EXISTS "Pharmacy staff manage controlled log" ON controlled_substance_log;
CREATE POLICY "Pharmacy staff manage controlled log"
  ON controlled_substance_log FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'pharmacist')
  ));

DROP POLICY IF EXISTS "Admin manage drug interactions" ON drug_interactions;
CREATE POLICY "Admin manage drug interactions"
  ON drug_interactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- ============================================
-- MIGRATION 004 COMPLETE
-- Tables created: radiology_orders, radiology_results, theatre_bookings,
--                 surgical_procedures, anc_registrations, anc_visits,
--                 deliveries, postnatal_visits, mortuary_records,
--                 dental_records, physiotherapy_sessions, lab_test_catalog,
--                 lab_panels, lab_specimens, suppliers, purchase_orders,
--                 drug_batches, controlled_substance_log, drug_interactions
-- Tables modified: lab_tests (+catalog_id, +numeric_value, +unit, +reference_range, +result_flag, +panel_id)
--                  drugs (+is_controlled, +schedule, +generic_name, +brand_name, +dosage_form)
-- ============================================
