-- CareLink HMS full schema bundle
-- Apply in Supabase SQL Editor against an empty/new project.
-- Generated from repo SQL files in dependency order.



-- ============================================================
-- BEGIN: database-setup.sql
-- ============================================================

-- ============================================
-- CareLink HMS - Core Database Setup
-- Run this file in Supabase SQL Editor
-- Author: David Gabion Selorm
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. CORE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'pharmacist', 'nurse', 'cashier', 'records_officer')),
  specialty TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_specialty ON users(specialty);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT UNIQUE NOT NULL DEFAULT ('PT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10))),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  nhis_number TEXT,
  insurance_type TEXT CHECK (insurance_type IN ('nhis', 'private', 'none')),
  insurance_name TEXT,
  insurance_number TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  blood_group TEXT,
  allergies TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_nhis ON patients(nhis_number);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

CREATE TABLE IF NOT EXISTS drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'tablets',
  reorder_level INTEGER DEFAULT 10,
  manufacturer TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drugs_name ON drugs(name);
CREATE INDEX IF NOT EXISTS idx_drugs_category ON drugs(category);
CREATE INDEX IF NOT EXISTS idx_drugs_stock ON drugs(stock);

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name TEXT,
  diagnosis TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);

CREATE TABLE IF NOT EXISTS prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  drug_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_drug ON prescription_items(drug_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'momo', 'insurance', 'card')),
  momo_provider TEXT CHECK (momo_provider IN ('mtn', 'telecel', 'airteltigo')),
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  insurance_type TEXT NOT NULL CHECK (insurance_type IN ('nhis', 'private')),
  insurance_name TEXT,
  claim_number TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'paid')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_insurance_type ON claims(insurance_type);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims(created_at DESC);

CREATE TABLE IF NOT EXISTS lab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_type TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  result TEXT,
  result_file_url TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_status ON lab_tests(status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_requested_by ON lab_tests(requested_by);
CREATE INDEX IF NOT EXISTS idx_lab_tests_created_at ON lab_tests(created_at DESC);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

COMMENT ON TABLE users IS 'Stores CareLink staff accounts and role metadata';
COMMENT ON COLUMN users.specialty IS 'Doctor specialty or nurse type when applicable';
COMMENT ON TABLE patients IS 'Stores registered patient records';
COMMENT ON TABLE drugs IS 'Stores drug inventory and pricing';
COMMENT ON TABLE prescriptions IS 'Stores doctor prescriptions';
COMMENT ON TABLE prescription_items IS 'Stores prescription drug line items';
COMMENT ON TABLE payments IS 'Stores billing and payment records';
COMMENT ON TABLE claims IS 'Stores NHIS and private insurance claims';
COMMENT ON TABLE lab_tests IS 'Stores laboratory test requests and results';
COMMENT ON TABLE appointments IS 'Stores patient appointments';
COMMENT ON TABLE audit_log IS 'Stores audit events for key application actions';

-- ============================================
-- 2. COMPATIBILITY MIGRATIONS
-- ============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS specialty TEXT;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'doctor', 'pharmacist', 'nurse', 'cashier', 'records_officer'));

DO $$
DECLARE
  phone_constraint RECORD;
  phone_index RECORD;
BEGIN
  FOR phone_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel
      ON rel.oid = con.conrelid
    JOIN pg_namespace nsp
      ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'users'
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) ILIKE '%(phone)%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', phone_constraint.conname);
  END LOOP;

  FOR phone_index IN
    SELECT idx.indexname
    FROM pg_indexes idx
    WHERE idx.schemaname = 'public'
      AND idx.tablename = 'users'
      AND idx.indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND idx.indexdef ILIKE '%(phone)%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', phone_index.indexname);
  END LOOP;
END $$;

-- Add patient_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patients' AND column_name = 'patient_id'
  ) THEN
    ALTER TABLE patients 
      ADD COLUMN patient_id TEXT DEFAULT ('PT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)));
  END IF;
END $$;

-- Add insurance_number column if it doesn't exist
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS insurance_number TEXT;

-- Update any NULL patient_id values
UPDATE patients
SET patient_id = ('PT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)))
WHERE patient_id IS NULL;

-- Add unique constraint on patient_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'patients' 
    AND constraint_name = 'patients_patient_id_key'
  ) THEN
    ALTER TABLE patients ADD CONSTRAINT patients_patient_id_key UNIQUE (patient_id);
  END IF;
END $$;

-- Set patient_id to NOT NULL if it isn't already
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patients' 
    AND column_name = 'patient_id' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE patients ALTER COLUMN patient_id SET NOT NULL;
  END IF;
END $$;

-- Create indexes for columns added via compatibility migrations
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_insurance_number ON patients(insurance_number);

-- Add comments for compatibility-migrated columns
COMMENT ON COLUMN patients.patient_id IS 'Human-friendly CareLink patient identifier used in records and search';
COMMENT ON COLUMN patients.insurance_number IS 'Policy or membership number for private health insurance companies';

-- ============================================
-- 3. UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drugs_updated_at ON drugs;
CREATE TRIGGER update_drugs_updated_at
  BEFORE UPDATE ON drugs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claims_updated_at ON claims;
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lab_tests_updated_at ON lab_tests;
CREATE TRIGGER update_lab_tests_updated_at
  BEFORE UPDATE ON lab_tests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_authenticated ON users;
DROP POLICY IF EXISTS users_insert_authenticated ON users;
DROP POLICY IF EXISTS users_update_authenticated ON users;

CREATE POLICY users_select_authenticated
  ON users
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY users_insert_authenticated
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY users_update_authenticated
  ON users
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS patients_select_authenticated ON patients;
DROP POLICY IF EXISTS patients_insert_authenticated ON patients;
DROP POLICY IF EXISTS patients_update_authenticated ON patients;

CREATE POLICY patients_select_authenticated
  ON patients
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY patients_insert_authenticated
  ON patients
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY patients_update_authenticated
  ON patients
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS drugs_select_authenticated ON drugs;
DROP POLICY IF EXISTS drugs_insert_authenticated ON drugs;
DROP POLICY IF EXISTS drugs_update_authenticated ON drugs;

CREATE POLICY drugs_select_authenticated
  ON drugs
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY drugs_insert_authenticated
  ON drugs
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY drugs_update_authenticated
  ON drugs
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS prescriptions_select_authenticated ON prescriptions;
DROP POLICY IF EXISTS prescriptions_insert_authenticated ON prescriptions;
DROP POLICY IF EXISTS prescriptions_update_authenticated ON prescriptions;
DROP POLICY IF EXISTS prescriptions_delete_authenticated ON prescriptions;

CREATE POLICY prescriptions_select_authenticated
  ON prescriptions
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY prescriptions_insert_authenticated
  ON prescriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY prescriptions_update_authenticated
  ON prescriptions
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY prescriptions_delete_authenticated
  ON prescriptions
  FOR DELETE
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS prescription_items_select_authenticated ON prescription_items;
DROP POLICY IF EXISTS prescription_items_insert_authenticated ON prescription_items;

CREATE POLICY prescription_items_select_authenticated
  ON prescription_items
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY prescription_items_insert_authenticated
  ON prescription_items
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS payments_select_authenticated ON payments;
DROP POLICY IF EXISTS payments_insert_authenticated ON payments;
DROP POLICY IF EXISTS payments_update_authenticated ON payments;

CREATE POLICY payments_select_authenticated
  ON payments
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY payments_insert_authenticated
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY payments_update_authenticated
  ON payments
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS claims_select_authenticated ON claims;
DROP POLICY IF EXISTS claims_insert_authenticated ON claims;
DROP POLICY IF EXISTS claims_update_authenticated ON claims;

CREATE POLICY claims_select_authenticated
  ON claims
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY claims_insert_authenticated
  ON claims
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY claims_update_authenticated
  ON claims
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS lab_tests_select_authenticated ON lab_tests;
DROP POLICY IF EXISTS lab_tests_insert_authenticated ON lab_tests;
DROP POLICY IF EXISTS lab_tests_update_authenticated ON lab_tests;

CREATE POLICY lab_tests_select_authenticated
  ON lab_tests
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY lab_tests_insert_authenticated
  ON lab_tests
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY lab_tests_update_authenticated
  ON lab_tests
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS appointments_select_authenticated ON appointments;
DROP POLICY IF EXISTS appointments_insert_authenticated ON appointments;
DROP POLICY IF EXISTS appointments_update_authenticated ON appointments;

CREATE POLICY appointments_select_authenticated
  ON appointments
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY appointments_insert_authenticated
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY appointments_update_authenticated
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS audit_log_select_authenticated ON audit_log;
DROP POLICY IF EXISTS audit_log_insert_authenticated ON audit_log;

CREATE POLICY audit_log_select_authenticated
  ON audit_log
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY audit_log_insert_authenticated
  ON audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- ============================================
-- 5. VERIFICATION
-- ============================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'appointments',
    'audit_log',
    'claims',
    'drugs',
    'lab_tests',
    'patients',
    'payments',
    'prescription_items',
    'prescriptions',
    'users'
  )
ORDER BY table_name;

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'appointments',
  'audit_log',
  'claims',
  'drugs',
  'lab_tests',
  'patients',
  'payments',
  'prescription_items',
  'prescriptions',
  'users'
)
ORDER BY tablename, policyname;

-- ============================================
-- 6. NEXT STEPS
-- ============================================

-- After this script succeeds, run any optional modules you need:
-- 1. nurse-system-setup.sql
-- 2. records-system-setup.sql
-- 3. referrals-setup.sql
-- 4. add-insurance-number-column.sql is no longer needed on fresh setups,
--    because insurance_number is included here already.

-- ============================================================
-- END: database-setup.sql
-- ============================================================


-- ============================================================
-- BEGIN: advanced-features-setup.sql
-- ============================================================

-- ============================================
-- CareLink HMS - Advanced Features Database Setup
-- Comprehensive schema for all new features
-- Author: David Gabion Selorm
-- Email: gabiondavidselorm@gmail.com
-- Date: April 4, 2026
-- ============================================

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Create New Query
-- 4. Copy and paste this entire script
-- 5. Click "Run" or press Ctrl+Enter

-- ============================================
-- 1. NOTIFICATION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('appointment_reminder', 'lab_result', 'prescription_ready', 'low_stock_alert', 'pending_claim', 'urgent_referral', 'shift_handover', 'new_prescription')),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'sms', 'email')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- ============================================
-- 2. QUEUE MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS queue_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  department TEXT NOT NULL CHECK (department IN ('opd', 'emergency', 'pharmacy', 'laboratory', 'radiology', 'billing', 'records')),
  queue_number INTEGER NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'emergency')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'cancelled', 'no_show')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_wait_time INTEGER,
  served_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_patient_id ON queue_management(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_department ON queue_management(department);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_management(status);
CREATE INDEX IF NOT EXISTS idx_queue_created_at ON queue_management(created_at DESC);

-- ============================================
-- 3. TELEMEDICINE/VIRTUAL CONSULTATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS virtual_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show')),
  meeting_platform TEXT DEFAULT 'zoom' CHECK (meeting_platform IN ('zoom', 'google_meet', 'microsoft_teams', 'custom')),
  meeting_link TEXT,
  meeting_id TEXT,
  meeting_password TEXT,
  consultation_notes TEXT,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_virtual_consultations_patient ON virtual_consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_virtual_consultations_doctor ON virtual_consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_virtual_consultations_status ON virtual_consultations(status);
CREATE INDEX IF NOT EXISTS idx_virtual_consultations_scheduled ON virtual_consultations(scheduled_time);

-- ============================================
-- 4. WARDS AND BEDS MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  floor TEXT,
  ward_type TEXT NOT NULL CHECK (ward_type IN ('general', 'private', 'icu', 'maternity', 'pediatric', 'isolation')),
  total_beds INTEGER NOT NULL DEFAULT 0,
  available_beds INTEGER NOT NULL DEFAULT 0,
  nurse_in_charge UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  bed_type TEXT NOT NULL DEFAULT 'standard' CHECK (bed_type IN ('standard', 'icu', 'isolation', 'private')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'under_maintenance', 'cleaning')),
  current_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ward_id, bed_number)
);

CREATE INDEX IF NOT EXISTS idx_beds_ward_id ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_current_patient ON beds(current_patient_id);

CREATE TABLE IF NOT EXISTS admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  admitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diagnosis TEXT NOT NULL,
  admission_type TEXT NOT NULL CHECK (admission_type IN ('emergency', 'planned', 'transfer')),
  admission_notes TEXT,
  expected_discharge_date DATE,
  discharge_date TIMESTAMPTZ,
  discharge_type TEXT CHECK (discharge_type IN ('cured', 'transferred', 'deceased', 'lama', 'absconded')),
  discharge_summary TEXT,
  discharged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'discharged', 'transferred')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admissions_patient_id ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_bed_id ON admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_admission_date ON admissions(admission_date DESC);

-- ============================================
-- 5. INVENTORY MANAGEMENT (NON-DRUG SUPPLIES)
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'pieces',
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  supplier TEXT,
  last_restock_date DATE,
  location TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_quantity ON inventory_items(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('restock', 'issue', 'return', 'wastage', 'adjustment')),
  quantity INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  issued_to_user UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_to_department TEXT,
  issued_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cost_per_unit NUMERIC(10, 2),
  total_cost NUMERIC(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at DESC);

-- ============================================
-- 6. EMERGENCY/TRIAGE SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS triage_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  triage_level TEXT NOT NULL CHECK (triage_level IN ('red', 'yellow', 'green', 'blue', 'black')),
  chief_complaint TEXT NOT NULL,
  vital_signs JSONB,
  pain_scale INTEGER CHECK (pain_scale BETWEEN 0 AND 10),
  assessment_notes TEXT,
  recommended_action TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_treatment', 'completed')),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triage_patient_id ON triage_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_triage_level ON triage_assessments(triage_level);
CREATE INDEX IF NOT EXISTS idx_triage_status ON triage_assessments(status);
CREATE INDEX IF NOT EXISTS idx_triage_assessed_at ON triage_assessments(assessed_at DESC);

-- ============================================
-- 7. STAFF SCHEDULING
-- ============================================

CREATE TABLE IF NOT EXISTS staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night', 'full_day')),
  department TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'absent', 'on_leave', 'swapped')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, shift_date, shift_type)
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON staff_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON staff_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON staff_schedules(status);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'annual', 'emergency', 'maternity', 'paternity', 'compassionate', 'unpaid')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- ============================================
-- 8. BLOOD BANK MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS blood_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_type TEXT NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  units_available INTEGER NOT NULL DEFAULT 0,
  units_reserved INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 5,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS blood_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name TEXT NOT NULL,
  donor_phone TEXT,
  donor_email TEXT,
  blood_type TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  donation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date DATE NOT NULL,
  screening_status TEXT DEFAULT 'pending' CHECK (screening_status IN ('pending', 'passed', 'failed')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired', 'discarded')),
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_donations_type ON blood_donations(blood_type);
CREATE INDEX IF NOT EXISTS idx_blood_donations_status ON blood_donations(status);
CREATE INDEX IF NOT EXISTS idx_blood_donations_expiry ON blood_donations(expiry_date);

CREATE TABLE IF NOT EXISTS blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blood_type TEXT NOT NULL,
  units_requested INTEGER NOT NULL,
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_requests_patient ON blood_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);

-- ============================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_advanced_features_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notifications_timestamp ON notifications;
DROP TRIGGER IF EXISTS update_queue_timestamp ON queue_management;
DROP TRIGGER IF EXISTS update_virtual_consultations_timestamp ON virtual_consultations;
DROP TRIGGER IF EXISTS update_wards_timestamp ON wards;
DROP TRIGGER IF EXISTS update_beds_timestamp ON beds;
DROP TRIGGER IF EXISTS update_admissions_timestamp ON admissions;
DROP TRIGGER IF EXISTS update_inventory_items_timestamp ON inventory_items;
DROP TRIGGER IF EXISTS update_staff_schedules_timestamp ON staff_schedules;
DROP TRIGGER IF EXISTS update_leave_requests_timestamp ON leave_requests;

CREATE TRIGGER update_queue_timestamp
  BEFORE UPDATE ON queue_management
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_virtual_consultations_timestamp
  BEFORE UPDATE ON virtual_consultations
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_wards_timestamp
  BEFORE UPDATE ON wards
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_beds_timestamp
  BEFORE UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_admissions_timestamp
  BEFORE UPDATE ON admissions
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_inventory_items_timestamp
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_staff_schedules_timestamp
  BEFORE UPDATE ON staff_schedules
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_leave_requests_timestamp
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

-- ============================================
-- 10. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Queue: Staff can view queues for their departments
DROP POLICY IF EXISTS "Staff can view queues" ON queue_management;
CREATE POLICY "Staff can view queues"
  ON queue_management FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'nurse', 'doctor', 'pharmacist', 'cashier', 'records_officer')
  ));

-- Virtual Consultations: Doctors and patients can view their consultations
DROP POLICY IF EXISTS "View own virtual consultations" ON virtual_consultations;
CREATE POLICY "View own virtual consultations"
  ON virtual_consultations FOR ALL
  USING (
    doctor_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Admins can manage all tables
DROP POLICY IF EXISTS "Admin full access wards" ON wards;
DROP POLICY IF EXISTS "Admin full access beds" ON beds;
DROP POLICY IF EXISTS "Admin full access admissions" ON admissions;
DROP POLICY IF EXISTS "Admin full access inventory_categories" ON inventory_categories;
DROP POLICY IF EXISTS "Admin full access inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Admin full access inventory_transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Admin full access triage" ON triage_assessments;
DROP POLICY IF EXISTS "Admin full access schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Admin full access leave_requests" ON leave_requests;
DROP POLICY IF EXISTS "Admin full access blood_inventory" ON blood_inventory;
DROP POLICY IF EXISTS "Admin full access blood_donations" ON blood_donations;
DROP POLICY IF EXISTS "Admin full access blood_requests" ON blood_requests;

CREATE POLICY "Admin full access wards" ON wards FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access beds" ON beds FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access admissions" ON admissions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access inventory_categories" ON inventory_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access inventory_items" ON inventory_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access inventory_transactions" ON inventory_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access triage" ON triage_assessments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse', 'doctor')));

CREATE POLICY "Admin full access schedules" ON staff_schedules FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access leave_requests" ON leave_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access blood_inventory" ON blood_inventory FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access blood_donations" ON blood_donations FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access blood_requests" ON blood_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor')));

-- ============================================
-- SETUP COMPLETE
-- ============================================

-- Insert default inventory categories
INSERT INTO inventory_categories (name, description) VALUES
  ('Disposables', 'Single-use medical supplies'),
  ('Equipment', 'Reusable medical equipment'),
  ('Linen', 'Bedsheets, towels, gowns'),
  ('Stationery', 'Office and administrative supplies'),
  ('Laboratory Supplies', 'Lab consumables and reagents'),
  ('Pharmacy Supplies', 'Non-drug pharmacy items')
ON CONFLICT (name) DO NOTHING;

-- Insert default blood inventory
INSERT INTO blood_inventory (blood_type, units_available, units_reserved) VALUES
  ('A+', 0, 0),
  ('A-', 0, 0),
  ('B+', 0, 0),
  ('B-', 0, 0),
  ('AB+', 0, 0),
  ('AB-', 0, 0),
  ('O+', 0, 0),
  ('O-', 0, 0)
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Advanced Features Database Setup Complete!';
  RAISE NOTICE 'Tables created: notifications, queue_management, virtual_consultations, wards, beds, admissions, inventory_*, triage_assessments, staff_schedules, leave_requests, blood_*';
  RAISE NOTICE 'Next: Build the frontend components for these features';
END $$;

-- ============================================================
-- END: advanced-features-setup.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\001_core_clinical.sql
-- ============================================================

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

-- ============================================================
-- END: migrations\001_core_clinical.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\002_nursing_ward.sql
-- ============================================================

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

-- ============================================================
-- END: migrations\002_nursing_ward.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\003_revenue_cycle_nhia.sql
-- ============================================================

-- ============================================
-- CareLink HMS — Migration 003: Revenue Cycle & NHIA Claims Engine
-- NHIA tariffs, GDRG, encounter-based billing, batch claims, receipts
-- Depends on: 001_core_clinical.sql (encounters, diagnoses, clinical_orders)
-- ============================================

-- ============================================
-- 1. NHIA TARIFF CATALOG
-- Ghana National Health Insurance Authority tariff schedule
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_tariff_code ON nhia_tariff_catalog(tariff_code);
CREATE INDEX IF NOT EXISTS idx_tariff_category ON nhia_tariff_catalog(category);
CREATE INDEX IF NOT EXISTS idx_tariff_active ON nhia_tariff_catalog(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tariff_effective ON nhia_tariff_catalog(effective_from, effective_to);

COMMENT ON TABLE nhia_tariff_catalog IS 'NHIA tariff schedule with GDRG codes for claims pricing';

-- ============================================
-- 2. FEE SCHEDULES
-- Per-service pricing for private insurance and cash
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_fee_schedule_service ON fee_schedules(service_code);
CREATE INDEX IF NOT EXISTS idx_fee_schedule_active ON fee_schedules(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE fee_schedules IS 'Service pricing by payer type — cash, NHIS, private insurance, corporate';

-- ============================================
-- 3. BILLING ITEMS
-- Line-item charges per encounter
-- ============================================

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

-- Auto-calculate total amount
CREATE OR REPLACE FUNCTION calculate_billing_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.discount_amount := COALESCE(NEW.unit_price * NEW.quantity * COALESCE(NEW.discount_percent, 0) / 100, 0);
  NEW.total_amount := (NEW.unit_price * NEW.quantity) - NEW.discount_amount + COALESCE(NEW.tax_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_billing_total ON billing_items;
CREATE TRIGGER trigger_billing_total
  BEFORE INSERT OR UPDATE ON billing_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_billing_total();

CREATE INDEX IF NOT EXISTS idx_billing_items_encounter ON billing_items(encounter_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_patient ON billing_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_status ON billing_items(billing_status);
CREATE INDEX IF NOT EXISTS idx_billing_items_category ON billing_items(category);
CREATE INDEX IF NOT EXISTS idx_billing_items_created ON billing_items(created_at DESC);

COMMENT ON TABLE billing_items IS 'Individual charge line items per encounter — auto-generated from orders/prescriptions';

-- ============================================
-- 4. CLAIM ITEMS
-- Line-item detail for insurance claims
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_claim_items_tariff ON claim_items(tariff_id);
CREATE INDEX IF NOT EXISTS idx_claim_items_status ON claim_items(status);

COMMENT ON TABLE claim_items IS 'Line-item detail for NHIS/private insurance claims with tariff mapping';

-- ============================================
-- 5. CLAIM BATCHES
-- Group claims for batch submission to NHIA
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_batches_period ON claim_batches(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_batches_number ON claim_batches(batch_number);

COMMENT ON TABLE claim_batches IS 'Groups claims into submission batches for NHIA processing';

-- Link claims to batches
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES claim_batches(id) ON DELETE SET NULL;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(10, 2);

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2);

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_claims_batch ON claims(batch_id);
CREATE INDEX IF NOT EXISTS idx_claims_encounter ON claims(encounter_id);

-- ============================================
-- 6. NHIA SUBMISSIONS
-- Track API submissions to NHIA
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_nhia_sub_submitted ON nhia_submissions(submitted_at DESC);

COMMENT ON TABLE nhia_submissions IS 'Tracks every NHIA API submission attempt with request/response payloads';

-- ============================================
-- 7. PAYMENT ALLOCATIONS
-- Map partial/split payments to billing items
-- ============================================

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  billing_item_id UUID NOT NULL REFERENCES billing_items(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(10, 2) NOT NULL,
  allocation_type TEXT DEFAULT 'patient' CHECK (allocation_type IN ('patient', 'insurance', 'nhis', 'corporate', 'write_off')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_billing_item ON payment_allocations(billing_item_id);

COMMENT ON TABLE payment_allocations IS 'Maps partial/split payments across individual billing line items';

-- ============================================
-- 8. RECEIPTS
-- Sequential numbered receipts
-- ============================================

CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH 100001;

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE DEFAULT ('RCP-' || LPAD(nextval('receipt_number_seq')::TEXT, 8, '0')),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL,
  change_amount NUMERIC(10, 2) DEFAULT 0,
  payment_method TEXT NOT NULL,
  payer_name TEXT,
  payer_type TEXT DEFAULT 'patient' CHECK (payer_type IN ('patient', 'insurance', 'nhis', 'corporate', 'third_party')),
  items JSONB NOT NULL DEFAULT '[]',
  issued_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voided BOOLEAN DEFAULT FALSE,
  void_reason TEXT,
  voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_patient ON receipts(patient_id);
CREATE INDEX IF NOT EXISTS idx_receipts_encounter ON receipts(encounter_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON receipts(created_at DESC);

COMMENT ON TABLE receipts IS 'Sequentially numbered printable receipts for all payment transactions';

-- ============================================
-- 9. CLAIM SCRUB FUNCTION
-- Validates claims before submission
-- ============================================

CREATE OR REPLACE FUNCTION scrub_claim_batch(p_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_errors JSONB := '[]';
  v_claim RECORD;
  v_item RECORD;
  v_error JSONB;
BEGIN
  -- Check each claim in the batch
  FOR v_claim IN
    SELECT c.*, p.nhis_number, p.name AS patient_name
    FROM claims c
    JOIN patients p ON p.id = c.patient_id
    WHERE c.batch_id = p_batch_id
  LOOP
    -- Validate NHIS number exists
    IF v_claim.nhis_number IS NULL OR v_claim.nhis_number = '' THEN
      v_error := jsonb_build_object(
        'claim_id', v_claim.id,
        'patient_name', v_claim.patient_name,
        'error_type', 'missing_nhis',
        'message', 'Patient has no NHIS number'
      );
      v_errors := v_errors || v_error;
    END IF;

    -- Validate claim has line items
    IF NOT EXISTS (SELECT 1 FROM claim_items WHERE claim_id = v_claim.id) THEN
      v_error := jsonb_build_object(
        'claim_id', v_claim.id,
        'patient_name', v_claim.patient_name,
        'error_type', 'no_items',
        'message', 'Claim has no line items'
      );
      v_errors := v_errors || v_error;
    END IF;

    -- Validate each claim item has a valid tariff
    FOR v_item IN
      SELECT ci.* FROM claim_items ci WHERE ci.claim_id = v_claim.id
    LOOP
      IF v_item.gdrg_code IS NULL OR v_item.gdrg_code = '' THEN
        v_error := jsonb_build_object(
          'claim_id', v_claim.id,
          'claim_item_id', v_item.id,
          'patient_name', v_claim.patient_name,
          'error_type', 'missing_gdrg',
          'message', 'Claim item missing GDRG code: ' || v_item.description
        );
        v_errors := v_errors || v_error;
      END IF;

      -- Check tariff is active and price matches
      IF v_item.tariff_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM nhia_tariff_catalog
          WHERE id = v_item.tariff_id
          AND is_active = TRUE
          AND effective_from <= CURRENT_DATE
          AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
        ) THEN
          v_error := jsonb_build_object(
            'claim_id', v_claim.id,
            'claim_item_id', v_item.id,
            'patient_name', v_claim.patient_name,
            'error_type', 'expired_tariff',
            'message', 'Tariff expired or inactive: ' || v_item.description
          );
          v_errors := v_errors || v_error;
        END IF;
      END IF;
    END LOOP;

    -- Validate claim has at least one diagnosis
    IF v_claim.encounter_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM diagnoses WHERE encounter_id = v_claim.encounter_id
      ) THEN
        v_error := jsonb_build_object(
          'claim_id', v_claim.id,
          'patient_name', v_claim.patient_name,
          'error_type', 'missing_diagnosis',
          'message', 'Encounter has no coded diagnosis'
        );
        v_errors := v_errors || v_error;
      END IF;
    END IF;
  END LOOP;

  -- Update batch with scrub results
  UPDATE claim_batches
  SET scrubbed_at = NOW(),
      scrub_errors = v_errors,
      status = CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'scrubbed' ELSE 'draft' END
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'total_errors', jsonb_array_length(v_errors),
    'errors', v_errors,
    'status', CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'passed' ELSE 'failed' END
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION scrub_claim_batch IS 'Validates all claims in a batch: checks NHIS numbers, diagnosis codes, tariffs, line items';

-- ============================================
-- 10. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_tariff_timestamp ON nhia_tariff_catalog;
CREATE TRIGGER update_tariff_timestamp
  BEFORE UPDATE ON nhia_tariff_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fee_schedule_timestamp ON fee_schedules;
CREATE TRIGGER update_fee_schedule_timestamp
  BEFORE UPDATE ON fee_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_items_timestamp ON billing_items;
CREATE TRIGGER update_billing_items_timestamp
  BEFORE UPDATE ON billing_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claim_items_timestamp ON claim_items;
CREATE TRIGGER update_claim_items_timestamp
  BEFORE UPDATE ON claim_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claim_batches_timestamp ON claim_batches;
CREATE TRIGGER update_claim_batches_timestamp
  BEFORE UPDATE ON claim_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE nhia_tariff_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhia_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Tariff Catalog: all staff view, admin manages
DROP POLICY IF EXISTS "Staff view tariff catalog" ON nhia_tariff_catalog;
CREATE POLICY "Staff view tariff catalog"
  ON nhia_tariff_catalog FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admin manage tariff catalog" ON nhia_tariff_catalog;
CREATE POLICY "Admin manage tariff catalog"
  ON nhia_tariff_catalog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Fee Schedules: all staff view, admin manages
DROP POLICY IF EXISTS "Staff view fee schedules" ON fee_schedules;
CREATE POLICY "Staff view fee schedules"
  ON fee_schedules FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admin manage fee schedules" ON fee_schedules;
CREATE POLICY "Admin manage fee schedules"
  ON fee_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Billing Items: cashier, admin, doctor
DROP POLICY IF EXISTS "Staff view billing items" ON billing_items;
CREATE POLICY "Staff view billing items"
  ON billing_items FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Billing staff manage items" ON billing_items;
CREATE POLICY "Billing staff manage items"
  ON billing_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier', 'doctor')
  ));

-- Claim Items: cashier, admin
DROP POLICY IF EXISTS "Staff view claim items" ON claim_items;
CREATE POLICY "Staff view claim items"
  ON claim_items FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Claims staff manage items" ON claim_items;
CREATE POLICY "Claims staff manage items"
  ON claim_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

-- Claim Batches: cashier, admin
DROP POLICY IF EXISTS "Staff view claim batches" ON claim_batches;
CREATE POLICY "Staff view claim batches"
  ON claim_batches FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

DROP POLICY IF EXISTS "Admin manage claim batches" ON claim_batches;
CREATE POLICY "Admin manage claim batches"
  ON claim_batches FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

-- NHIA Submissions: admin only
DROP POLICY IF EXISTS "Admin view nhia submissions" ON nhia_submissions;
CREATE POLICY "Admin view nhia submissions"
  ON nhia_submissions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admin manage nhia submissions" ON nhia_submissions;
CREATE POLICY "Admin manage nhia submissions"
  ON nhia_submissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Payment Allocations: cashier, admin
DROP POLICY IF EXISTS "Billing staff view allocations" ON payment_allocations;
CREATE POLICY "Billing staff view allocations"
  ON payment_allocations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

DROP POLICY IF EXISTS "Billing staff manage allocations" ON payment_allocations;
CREATE POLICY "Billing staff manage allocations"
  ON payment_allocations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

-- Receipts: cashier, admin
DROP POLICY IF EXISTS "Staff view receipts" ON receipts;
CREATE POLICY "Staff view receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Cashier manage receipts" ON receipts;
CREATE POLICY "Cashier manage receipts"
  ON receipts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

-- ============================================
-- MIGRATION 003 COMPLETE
-- Tables created: nhia_tariff_catalog, fee_schedules, billing_items,
--                 claim_items, claim_batches, nhia_submissions,
--                 payment_allocations, receipts
-- Tables modified: claims (+batch_id, +encounter_id, +approved_amount, +paid_amount, +paid_at, +payment_reference)
-- Functions:       scrub_claim_batch(batch_id) — validates batch before submission
-- Sequences:       receipt_number_seq
-- ============================================

-- ============================================================
-- END: migrations\003_revenue_cycle_nhia.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\004_ancillary_services.sql
-- ============================================================

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

-- ============================================================
-- END: migrations\004_ancillary_services.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\005_interop_fhir.sql
-- ============================================================

-- ============================================
-- CareLink HMS — Migration 005: Interoperability Layer
-- FHIR R4 resource logging, DHIMS2 reporting, integration endpoints,
-- multi-tenant hospital support, RBAC, security hardening
-- Depends on: 001-004 migrations
-- ============================================

-- ============================================
-- 1. HOSPITALS (Multi-Tenant)
-- ============================================

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  license_number TEXT UNIQUE,
  nhia_provider_id TEXT UNIQUE,
  edition TEXT NOT NULL DEFAULT 'district' CHECK (edition IN ('clinic', 'district', 'regional', 'teaching')),
  facility_type TEXT CHECK (facility_type IN ('clinic', 'health_center', 'polyclinic', 'district_hospital', 'regional_hospital', 'teaching_hospital', 'psychiatric', 'maternity_home')),
  bed_capacity INTEGER DEFAULT 0,
  region TEXT,
  district TEXT,
  town TEXT,
  address TEXT,
  gps_latitude NUMERIC(10, 7),
  gps_longitude NUMERIC(10, 7),
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1E40AF',
  accent_color TEXT DEFAULT '#3B82F6',
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'expired', 'cancelled')),
  subscription_plan TEXT CHECK (subscription_plan IN ('free', 'basic', 'professional', 'enterprise')),
  subscription_expires_at DATE,
  features_enabled JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  working_hours JSONB DEFAULT '{"mon": {"start": "08:00", "end": "17:00"}, "tue": {"start": "08:00", "end": "17:00"}, "wed": {"start": "08:00", "end": "17:00"}, "thu": {"start": "08:00", "end": "17:00"}, "fri": {"start": "08:00", "end": "17:00"}}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_name ON hospitals(name);
CREATE INDEX IF NOT EXISTS idx_hospitals_nhia ON hospitals(nhia_provider_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_region ON hospitals(region);
CREATE INDEX IF NOT EXISTS idx_hospitals_edition ON hospitals(edition);
CREATE INDEX IF NOT EXISTS idx_hospitals_status ON hospitals(subscription_status);

COMMENT ON TABLE hospitals IS 'Multi-tenant hospital registry — each facility gets isolated data';

-- Hospital Departments
CREATE TABLE IF NOT EXISTS hospital_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  head_of_department UUID REFERENCES users(id) ON DELETE SET NULL,
  location TEXT,
  phone_extension TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hosp_dept_hospital ON hospital_departments(hospital_id);

-- ============================================
-- 2. RBAC (Roles & Permissions)
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'export', 'approve', 'submit')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Seed system roles
INSERT INTO roles (name, display_name, description, is_system_role, permissions) VALUES
  ('super_admin', 'Super Administrator', 'Platform-level administrator with access to all hospitals', TRUE, '["*"]'),
  ('hospital_admin', 'Hospital Administrator', 'Full access within a single hospital', TRUE, '["hospital.*"]'),
  ('doctor', 'Doctor', 'Clinical access — encounters, orders, prescriptions, diagnoses', TRUE, '["encounters.*", "diagnoses.*", "orders.*", "prescriptions.*", "lab_tests.read", "vitals.read"]'),
  ('nurse', 'Nurse', 'Nursing access — vitals, MAR, assessments, care plans', TRUE, '["vitals.*", "mar.*", "nursing_assessments.*", "care_plans.*", "handover.*", "encounters.read"]'),
  ('pharmacist', 'Pharmacist', 'Pharmacy access — drugs, dispensing, controlled substances', TRUE, '["drugs.*", "prescriptions.read", "prescriptions.update", "drug_batches.*", "controlled_substance_log.*"]'),
  ('cashier', 'Cashier', 'Billing access — payments, receipts, claims', TRUE, '["payments.*", "billing_items.*", "receipts.*", "claims.*"]'),
  ('records_officer', 'Records Officer', 'Medical records access — patients, encounters history, reports', TRUE, '["patients.*", "encounters.read", "reports.*"]'),
  ('lab_technician', 'Lab Technician', 'Laboratory access — tests, specimens, results', TRUE, '["lab_tests.*", "lab_specimens.*", "lab_test_catalog.read"]'),
  ('radiologist', 'Radiologist', 'Radiology access — orders, results, reports', TRUE, '["radiology_orders.*", "radiology_results.*"]')
ON CONFLICT DO NOTHING;

-- Seed core permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('patients', 'create', 'Register new patients'),
  ('patients', 'read', 'View patient records'),
  ('patients', 'update', 'Update patient information'),
  ('patients', 'delete', 'Delete patient records'),
  ('patients', 'export', 'Export patient data'),
  ('encounters', 'create', 'Start new encounters'),
  ('encounters', 'read', 'View encounter history'),
  ('encounters', 'update', 'Update encounter details'),
  ('diagnoses', 'create', 'Add diagnoses'),
  ('diagnoses', 'read', 'View diagnoses'),
  ('prescriptions', 'create', 'Create prescriptions'),
  ('prescriptions', 'read', 'View prescriptions'),
  ('prescriptions', 'update', 'Dispense/cancel prescriptions'),
  ('lab_tests', 'create', 'Order lab tests'),
  ('lab_tests', 'read', 'View lab results'),
  ('lab_tests', 'update', 'Enter lab results'),
  ('payments', 'create', 'Process payments'),
  ('payments', 'read', 'View payment history'),
  ('claims', 'create', 'Create insurance claims'),
  ('claims', 'read', 'View claims'),
  ('claims', 'submit', 'Submit claims to NHIA'),
  ('claims', 'approve', 'Approve/reject claims'),
  ('reports', 'read', 'View reports'),
  ('reports', 'export', 'Export reports'),
  ('users', 'create', 'Create staff accounts'),
  ('users', 'read', 'View staff list'),
  ('users', 'update', 'Update staff accounts'),
  ('users', 'delete', 'Deactivate staff accounts'),
  ('settings', 'read', 'View hospital settings'),
  ('settings', 'update', 'Update hospital settings')
ON CONFLICT DO NOTHING;

-- Add hospital_id to users for multi-tenancy
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_hospital ON users(hospital_id);

-- ============================================
-- 3. SESSION MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- 4. CONSENT MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('data_processing', 'treatment', 'research', 'disclosure', 'telemedicine', 'marketing')),
  purpose TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  consent_method TEXT CHECK (consent_method IN ('written', 'verbal', 'electronic', 'guardian')),
  witness_id UUID REFERENCES users(id) ON DELETE SET NULL,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_patient ON consent_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_type ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_granted ON consent_records(granted);

COMMENT ON TABLE consent_records IS 'Patient consent tracking for Ghana Data Protection Act compliance';

-- ============================================
-- 5. DATA ACCESS LOG (Enhanced Audit)
-- ============================================

CREATE TABLE IF NOT EXISTS data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'create', 'update', 'delete', 'export', 'print')),
  access_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_log_user ON data_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_access_log_patient ON data_access_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_access_log_resource ON data_access_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_access_log_created ON data_access_log(created_at DESC);

-- Partitioning hint: for production, partition data_access_log by month
COMMENT ON TABLE data_access_log IS 'Forensic-grade access logging — every PHI view/edit is recorded';

-- ============================================
-- 6. FHIR RESOURCE LOG
-- ============================================

CREATE TABLE IF NOT EXISTS fhir_resource_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  fhir_version TEXT DEFAULT 'R4',
  version INTEGER DEFAULT 1,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'read', 'update', 'delete', 'search', 'batch')),
  source_system TEXT,
  target_system TEXT,
  payload JSONB NOT NULL,
  response_code INTEGER,
  error_message TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fhir_log_type ON fhir_resource_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_fhir_log_resource_id ON fhir_resource_log(resource_id);
CREATE INDEX IF NOT EXISTS idx_fhir_log_direction ON fhir_resource_log(direction);
CREATE INDEX IF NOT EXISTS idx_fhir_log_hospital ON fhir_resource_log(hospital_id);
CREATE INDEX IF NOT EXISTS idx_fhir_log_created ON fhir_resource_log(created_at DESC);

COMMENT ON TABLE fhir_resource_log IS 'Logs every FHIR resource exchanged — audit trail for interoperability';

-- ============================================
-- 7. FHIR ENDPOINT CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS fhir_endpoint_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  fhir_version TEXT DEFAULT 'R4',
  auth_type TEXT DEFAULT 'bearer' CHECK (auth_type IN ('none', 'basic', 'bearer', 'oauth2', 'smart')),
  auth_credentials JSONB DEFAULT '{}',
  supported_resources JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_ms": 1000}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fhir_endpoints_hospital ON fhir_endpoint_config(hospital_id);
CREATE INDEX IF NOT EXISTS idx_fhir_endpoints_enabled ON fhir_endpoint_config(enabled) WHERE enabled = TRUE;

COMMENT ON TABLE fhir_endpoint_config IS 'Configuration for external FHIR server connections';
-- NOTE: auth_credentials should be encrypted at rest via pgcrypto in production

-- ============================================
-- 8. DHIMS2 REPORTING
-- ============================================

CREATE TABLE IF NOT EXISTS dhims2_indicator_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_code TEXT NOT NULL UNIQUE,
  indicator_name TEXT NOT NULL,
  dhims2_data_element_id TEXT NOT NULL,
  dhims2_category_option TEXT,
  source_table TEXT NOT NULL,
  source_query TEXT NOT NULL,
  aggregation_type TEXT DEFAULT 'count' CHECK (aggregation_type IN ('count', 'sum', 'average', 'min', 'max')),
  filter_conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dhims2_indicators_code ON dhims2_indicator_mappings(indicator_code);
CREATE INDEX IF NOT EXISTS idx_dhims2_indicators_active ON dhims2_indicator_mappings(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE dhims2_indicator_mappings IS 'Maps CareLink data fields to DHIMS2 indicator codes for aggregate reporting';

CREATE TABLE IF NOT EXISTS dhims2_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('monthly_opd', 'monthly_ipd', 'disease_surveillance', 'maternal_health', 'child_health', 'nutrition', 'family_planning', 'mortality')),
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'submitted', 'accepted', 'rejected')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dhims2_response JSONB,
  submission_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, report_type, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_dhims2_reports_hospital ON dhims2_reports(hospital_id);
CREATE INDEX IF NOT EXISTS idx_dhims2_reports_type ON dhims2_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_dhims2_reports_period ON dhims2_reports(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_dhims2_reports_status ON dhims2_reports(status);

COMMENT ON TABLE dhims2_reports IS 'DHIMS2 aggregate reports for GHS submission';

-- ============================================
-- 9. INTEGRATION ENDPOINTS (General)
-- ============================================

CREATE TABLE IF NOT EXISTS integration_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  endpoint_type TEXT NOT NULL CHECK (endpoint_type IN ('nhia_eclaims', 'dhims2', 'fhir', 'sms_gateway', 'payment_gateway', 'email', 'momo', 'custom')),
  base_url TEXT NOT NULL,
  api_version TEXT,
  auth_type TEXT DEFAULT 'api_key' CHECK (auth_type IN ('none', 'api_key', 'basic', 'bearer', 'oauth2')),
  auth_config JSONB DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  timeout_ms INTEGER DEFAULT 30000,
  retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_ms": 1000}',
  enabled BOOLEAN DEFAULT TRUE,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'down', 'unknown')),
  last_health_check TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_hospital ON integration_endpoints(hospital_id);
CREATE INDEX IF NOT EXISTS idx_integration_type ON integration_endpoints(endpoint_type);
CREATE INDEX IF NOT EXISTS idx_integration_enabled ON integration_endpoints(enabled) WHERE enabled = TRUE;

COMMENT ON TABLE integration_endpoints IS 'Configuration for all external API integrations (NHIA, DHIMS2, SMS, MoMo)';

-- ============================================
-- 10. REPORTING ENGINE
-- ============================================

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  report_code TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('clinical', 'financial', 'operational', 'regulatory', 'custom')),
  description TEXT,
  query_template TEXT NOT NULL,
  parameters JSONB DEFAULT '[]',
  output_format TEXT DEFAULT 'table' CHECK (output_format IN ('table', 'chart', 'pdf', 'excel', 'csv')),
  schedule TEXT,
  is_system_report BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_hospital ON report_templates(hospital_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);

CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  parameters_used JSONB DEFAULT '{}',
  row_count INTEGER,
  execution_time_ms INTEGER,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  file_url TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_runs_template ON report_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_hospital ON report_runs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_created ON report_runs(created_at DESC);

-- Seed standard report templates
INSERT INTO report_templates (report_name, report_code, category, description, query_template, is_system_report) VALUES
  ('OPD Daily Register', 'OPD_DAILY', 'clinical', 'Daily outpatient attendance register', 'SELECT e.*, p.name, p.patient_id, d.icd10_code, d.icd10_description FROM encounters e JOIN patients p ON p.id = e.patient_id LEFT JOIN diagnoses d ON d.encounter_id = e.id WHERE e.encounter_type = ''outpatient'' AND e.created_at::date = :report_date ORDER BY e.created_at', TRUE),
  ('IPD Census', 'IPD_CENSUS', 'clinical', 'Inpatient daily census by ward', 'SELECT w.name AS ward, COUNT(*) AS patients, SUM(CASE WHEN a.status = ''admitted'' THEN 1 ELSE 0 END) AS current_admissions FROM admissions a JOIN wards w ON w.id = a.ward_id WHERE a.status = ''admitted'' GROUP BY w.name', TRUE),
  ('Disease Surveillance Top 20', 'DISEASE_TOP20', 'regulatory', 'Top 20 diagnoses by ICD-10 code for the period', 'SELECT d.icd10_code, d.icd10_description, COUNT(*) AS cases FROM diagnoses d WHERE d.created_at BETWEEN :start_date AND :end_date GROUP BY d.icd10_code, d.icd10_description ORDER BY cases DESC LIMIT 20', TRUE),
  ('Revenue Summary', 'REVENUE_SUMMARY', 'financial', 'Revenue summary by payment method and department', 'SELECT payment_method, SUM(amount) AS total, COUNT(*) AS transactions FROM payments WHERE status = ''completed'' AND created_at BETWEEN :start_date AND :end_date GROUP BY payment_method', TRUE),
  ('Claims Aging Report', 'CLAIMS_AGING', 'financial', 'Claims aging by status and submission date', 'SELECT status, COUNT(*) AS claims, SUM(amount) AS total_amount, AVG(EXTRACT(DAY FROM NOW() - created_at)) AS avg_days FROM claims WHERE created_at BETWEEN :start_date AND :end_date GROUP BY status', TRUE),
  ('Lab TAT Report', 'LAB_TAT', 'operational', 'Laboratory turnaround time metrics', 'SELECT test_name, AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) AS avg_tat_hours, COUNT(*) AS total_tests FROM lab_tests WHERE status = ''completed'' AND created_at BETWEEN :start_date AND :end_date GROUP BY test_name ORDER BY avg_tat_hours DESC', TRUE),
  ('Pharmacy Stock Valuation', 'PHARMA_STOCK', 'financial', 'Current pharmacy stock with valuation', 'SELECT name, category, stock, price, (stock * price) AS total_value, reorder_level, CASE WHEN stock <= reorder_level THEN ''LOW'' ELSE ''OK'' END AS stock_status FROM drugs ORDER BY total_value DESC', TRUE),
  ('Blood Bank Status', 'BLOOD_BANK', 'operational', 'Current blood bank inventory and recent activity', 'SELECT blood_type, units_available, units_reserved, reorder_level FROM blood_inventory ORDER BY blood_type', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- 11. AI SUGGESTIONS LOG
-- ============================================

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('diagnosis', 'drug_interaction', 'dosage_verification', 'lab_interpretation', 'readmission_risk', 'clinical_alert')),
  context JSONB NOT NULL,
  suggestion TEXT NOT NULL,
  confidence_score NUMERIC(3, 2),
  model_name TEXT,
  model_version TEXT,
  accepted BOOLEAN,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  rejection_reason TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_encounter ON ai_suggestions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created ON ai_suggestions(created_at DESC);

COMMENT ON TABLE ai_suggestions IS 'Logs all AI-generated clinical suggestions with acceptance/rejection tracking';

-- ============================================
-- 12. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_hospitals_timestamp ON hospitals;
CREATE TRIGGER update_hospitals_timestamp
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hosp_dept_timestamp ON hospital_departments;
CREATE TRIGGER update_hosp_dept_timestamp
  BEFORE UPDATE ON hospital_departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_timestamp ON roles;
CREATE TRIGGER update_roles_timestamp
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consent_timestamp ON consent_records;
CREATE TRIGGER update_consent_timestamp
  BEFORE UPDATE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fhir_endpoints_timestamp ON fhir_endpoint_config;
CREATE TRIGGER update_fhir_endpoints_timestamp
  BEFORE UPDATE ON fhir_endpoint_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dhims2_indicators_timestamp ON dhims2_indicator_mappings;
CREATE TRIGGER update_dhims2_indicators_timestamp
  BEFORE UPDATE ON dhims2_indicator_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dhims2_reports_timestamp ON dhims2_reports;
CREATE TRIGGER update_dhims2_reports_timestamp
  BEFORE UPDATE ON dhims2_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_endpoints_timestamp ON integration_endpoints;
CREATE TRIGGER update_integration_endpoints_timestamp
  BEFORE UPDATE ON integration_endpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_templates_timestamp ON report_templates;
CREATE TRIGGER update_report_templates_timestamp
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 13. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir_resource_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir_endpoint_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dhims2_indicator_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dhims2_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Hospital-scoped policies (users can only see their hospital's data)
DROP POLICY IF EXISTS "Users view own hospital" ON hospitals;
CREATE POLICY "Users view own hospital"
  ON hospitals FOR SELECT
  TO authenticated
  USING (
    id = (SELECT hospital_id FROM users WHERE users.id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "Admin manage hospitals" ON hospitals;
CREATE POLICY "Admin manage hospitals"
  ON hospitals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Generic authenticated read for reference tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'hospital_departments', 'roles', 'permissions', 'role_permissions',
      'consent_records', 'fhir_resource_log', 'fhir_endpoint_config',
      'dhims2_indicator_mappings', 'dhims2_reports', 'integration_endpoints',
      'report_templates', 'report_runs', 'ai_suggestions'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %I" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Authenticated read %I" ON %I FOR SELECT TO authenticated USING (TRUE)', tbl, tbl);
  END LOOP;
END $$;

-- Admin write for configuration tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'hospital_departments', 'roles', 'role_permissions',
      'fhir_endpoint_config', 'dhims2_indicator_mappings',
      'integration_endpoints', 'report_templates'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin manage %I" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Admin manage %I" ON %I FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ''admin''))', tbl, tbl);
  END LOOP;
END $$;

-- User sessions: users can only see their own
DROP POLICY IF EXISTS "Users view own sessions" ON user_sessions;
CREATE POLICY "Users view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Data access log: admin only
DROP POLICY IF EXISTS "Admin view access log" ON data_access_log;
CREATE POLICY "Admin view access log"
  ON data_access_log FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "System insert access log" ON data_access_log;
CREATE POLICY "System insert access log"
  ON data_access_log FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- ============================================
-- MIGRATION 005 COMPLETE
-- Tables created: hospitals, hospital_departments, roles, permissions,
--                 role_permissions, user_sessions, consent_records,
--                 data_access_log, fhir_resource_log, fhir_endpoint_config,
--                 dhims2_indicator_mappings, dhims2_reports,
--                 integration_endpoints, report_templates, report_runs,
--                 ai_suggestions
-- Tables modified: users (+hospital_id, +role_id)
-- Seed data:      9 system roles, 30 core permissions, 8 report templates
-- ============================================

-- ============================================================
-- END: migrations\005_interop_fhir.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\006_offline_sync.sql
-- ============================================================

-- ============================================
-- CareLink HMS — Migration 006: Offline Sync Infrastructure
-- Server-side sync tables for offline-first PWA capability
-- Depends on: 005_interop_fhir.sql (hospitals)
-- ============================================

-- ============================================
-- 1. SYNC QUEUE
-- Receives batched mutations from offline clients on reconnect
-- ============================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload JSONB NOT NULL,
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'applied', 'conflict', 'rejected')),
  error_message TEXT,
  batch_id TEXT,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_hospital ON sync_queue(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_client ON sync_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_queue_batch ON sync_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at DESC);

COMMENT ON TABLE sync_queue IS 'Receives offline client mutations for server-side application';

-- ============================================
-- 2. SYNC CONFLICTS
-- Tracks version conflicts for manual resolution
-- ============================================

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_queue_id UUID NOT NULL REFERENCES sync_queue(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  client_version JSONB NOT NULL,
  server_version JSONB NOT NULL,
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update_update', 'update_delete', 'delete_update')),
  resolution TEXT CHECK (resolution IN ('client_wins', 'server_wins', 'merged', 'manual')),
  resolved_version JSONB,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_hospital ON sync_conflicts(hospital_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_table ON sync_conflicts(table_name);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolution ON sync_conflicts(resolution);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON sync_conflicts(resolved_at) WHERE resolved_at IS NULL;

COMMENT ON TABLE sync_conflicts IS 'Tracks offline sync version conflicts with resolution history';

-- ============================================
-- 3. OFFLINE CACHE MANIFEST
-- Defines which data subsets sync per hospital/department/role
-- ============================================

CREATE TABLE IF NOT EXISTS offline_cache_manifest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('server_to_client', 'client_to_server', 'bidirectional')),
  filter_column TEXT,
  filter_value TEXT,
  role_filter TEXT[],
  department_filter TEXT[],
  max_records INTEGER DEFAULT 1000,
  sync_frequency_minutes INTEGER DEFAULT 15,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  include_columns TEXT[],
  exclude_columns TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  last_full_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_manifest_hospital ON offline_cache_manifest(hospital_id);
CREATE INDEX IF NOT EXISTS idx_cache_manifest_table ON offline_cache_manifest(table_name);
CREATE INDEX IF NOT EXISTS idx_cache_manifest_active ON offline_cache_manifest(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE offline_cache_manifest IS 'Defines offline data sync rules per hospital, department, and role';

-- Seed default cache manifest entries
INSERT INTO offline_cache_manifest (table_name, sync_direction, max_records, priority, role_filter) VALUES
  ('patients', 'bidirectional', 5000, 10, ARRAY['doctor', 'nurse', 'records_officer', 'pharmacist', 'cashier']),
  ('drugs', 'server_to_client', 2000, 9, ARRAY['doctor', 'nurse', 'pharmacist']),
  ('encounters', 'bidirectional', 2000, 9, ARRAY['doctor', 'nurse']),
  ('vitals', 'bidirectional', 5000, 8, ARRAY['doctor', 'nurse']),
  ('prescriptions', 'bidirectional', 2000, 8, ARRAY['doctor', 'pharmacist']),
  ('prescription_items', 'bidirectional', 5000, 8, ARRAY['doctor', 'pharmacist']),
  ('appointments', 'bidirectional', 1000, 7, ARRAY['doctor', 'nurse', 'records_officer']),
  ('queue_management', 'bidirectional', 500, 7, ARRAY['doctor', 'nurse', 'pharmacist', 'cashier']),
  ('lab_tests', 'bidirectional', 2000, 7, ARRAY['doctor', 'nurse']),
  ('diagnoses', 'bidirectional', 3000, 7, ARRAY['doctor']),
  ('nhia_tariff_catalog', 'server_to_client', 5000, 6, ARRAY['cashier']),
  ('blood_inventory', 'server_to_client', 20, 5, ARRAY['doctor', 'nurse'])
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. SYNC CHECKPOINT
-- Tracks last sync position per client for delta sync
-- ============================================

CREATE TABLE IF NOT EXISTS sync_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_record_version INTEGER DEFAULT 0,
  records_synced INTEGER DEFAULT 0,
  sync_duration_ms INTEGER,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_client ON sync_checkpoints(client_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_user ON sync_checkpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_table ON sync_checkpoints(table_name);

COMMENT ON TABLE sync_checkpoints IS 'Delta sync markers — tracks last sync position per client per table';

-- ============================================
-- 5. DEVICE REGISTRY
-- Track registered offline-capable devices
-- ============================================

CREATE TABLE IF NOT EXISTS registered_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT CHECK (device_type IN ('tablet', 'phone', 'laptop', 'desktop')),
  os TEXT,
  browser TEXT,
  app_version TEXT,
  push_subscription JSONB,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  storage_quota_mb INTEGER DEFAULT 500,
  storage_used_mb INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_hospital ON registered_devices(hospital_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON registered_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_active ON registered_devices(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE registered_devices IS 'Registry of offline-capable devices with sync and storage tracking';

-- ============================================
-- 6. SYNC BATCH PROCESSING FUNCTION
-- Applies a batch of sync operations atomically
-- ============================================

CREATE OR REPLACE FUNCTION process_sync_batch(p_batch_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_result JSONB := '{"applied": 0, "conflicts": 0, "errors": 0}';
  v_server_version JSONB;
  v_applied INTEGER := 0;
  v_conflicts INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  FOR v_item IN
    SELECT * FROM sync_queue
    WHERE batch_id = p_batch_id
    AND status = 'pending'
    ORDER BY sequence_number ASC
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE sync_queue SET status = 'processing', server_timestamp = NOW()
      WHERE id = v_item.id;

      -- Check for conflicts (server record was modified after client's timestamp)
      IF v_item.operation IN ('update', 'delete') THEN
        EXECUTE format(
          'SELECT to_jsonb(t.*) FROM %I t WHERE id = $1 AND updated_at > $2',
          v_item.table_name
        ) INTO v_server_version USING v_item.record_id, v_item.client_timestamp;

        IF v_server_version IS NOT NULL THEN
          -- Conflict detected
          INSERT INTO sync_conflicts (
            sync_queue_id, hospital_id, table_name, record_id,
            client_version, server_version,
            client_timestamp, server_timestamp,
            conflict_type
          ) VALUES (
            v_item.id, v_item.hospital_id, v_item.table_name, v_item.record_id,
            v_item.payload, v_server_version,
            v_item.client_timestamp, NOW(),
            CASE v_item.operation
              WHEN 'update' THEN 'update_update'
              WHEN 'delete' THEN 'delete_update'
              ELSE 'update_update'
            END
          );

          UPDATE sync_queue SET status = 'conflict' WHERE id = v_item.id;
          v_conflicts := v_conflicts + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Apply the operation
      CASE v_item.operation
        WHEN 'insert' THEN
          EXECUTE format(
            'INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1) ON CONFLICT (id) DO NOTHING',
            v_item.table_name, v_item.table_name
          ) USING v_item.payload;
        WHEN 'update' THEN
          EXECUTE format(
            'UPDATE %I SET %s WHERE id = $1',
            v_item.table_name,
            (SELECT string_agg(format('%I = ($2->>%L)::%s', key, key,
              CASE
                WHEN pg_typeof IS NOT NULL THEN pg_typeof::TEXT
                ELSE 'TEXT'
              END
            ), ', ')
            FROM jsonb_each_text(v_item.payload) AS j(key, value)
            WHERE key != 'id')
          ) USING v_item.record_id, v_item.payload;
        WHEN 'delete' THEN
          EXECUTE format('DELETE FROM %I WHERE id = $1', v_item.table_name)
          USING v_item.record_id;
      END CASE;

      UPDATE sync_queue SET status = 'applied' WHERE id = v_item.id;
      v_applied := v_applied + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE sync_queue SET status = 'rejected', error_message = SQLERRM WHERE id = v_item.id;
      v_errors := v_errors + 1;
    END;
  END LOOP;

  v_result := jsonb_build_object(
    'batch_id', p_batch_id,
    'applied', v_applied,
    'conflicts', v_conflicts,
    'errors', v_errors,
    'total', v_applied + v_conflicts + v_errors
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_sync_batch IS 'Atomically processes a batch of offline sync operations with conflict detection';

-- ============================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_cache_manifest_timestamp ON offline_cache_manifest;
CREATE TRIGGER update_cache_manifest_timestamp
  BEFORE UPDATE ON offline_cache_manifest
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checkpoints_timestamp ON sync_checkpoints;
CREATE TRIGGER update_checkpoints_timestamp
  BEFORE UPDATE ON sync_checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_devices_timestamp ON registered_devices;
CREATE TRIGGER update_devices_timestamp
  BEFORE UPDATE ON registered_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_cache_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;

-- Users can view/manage their own sync data
DROP POLICY IF EXISTS "Users manage own sync queue" ON sync_queue;
CREATE POLICY "Users manage own sync queue"
  ON sync_queue FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin view all sync conflicts" ON sync_conflicts;
CREATE POLICY "Admin view all sync conflicts"
  ON sync_conflicts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admin manage cache manifest" ON offline_cache_manifest;
CREATE POLICY "Admin manage cache manifest"
  ON offline_cache_manifest FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "Authenticated read cache manifest" ON offline_cache_manifest;
CREATE POLICY "Authenticated read cache manifest"
  ON offline_cache_manifest FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Users manage own checkpoints" ON sync_checkpoints;
CREATE POLICY "Users manage own checkpoints"
  ON sync_checkpoints FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own devices" ON registered_devices;
CREATE POLICY "Users manage own devices"
  ON registered_devices FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin view all devices" ON registered_devices;
CREATE POLICY "Admin view all devices"
  ON registered_devices FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- ============================================
-- MIGRATION 006 COMPLETE
-- Tables created: sync_queue, sync_conflicts, offline_cache_manifest,
--                 sync_checkpoints, registered_devices
-- Functions:      process_sync_batch(batch_id) — applies offline mutations with conflict detection
-- Seed data:      12 default cache manifest entries for core tables
-- ============================================

-- ============================================================
-- END: migrations\006_offline_sync.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\007_encounter_threading.sql
-- ============================================================

-- ============================================
-- Migration 007: Encounter Threading
-- Add encounter_id to legacy tables + discharge_summaries
-- ============================================

-- 1. Add encounter_id to prescriptions table
ALTER TABLE prescriptions 
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter ON prescriptions(encounter_id);

COMMENT ON COLUMN prescriptions.encounter_id IS 'Links prescription to the clinical encounter';

-- 2. Add encounter_id to payments table
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_encounter ON payments(encounter_id);

COMMENT ON COLUMN payments.encounter_id IS 'Links payment to the clinical encounter';

-- 3. Add encounter_id to claims table (if not already present)
ALTER TABLE claims 
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_claims_encounter_legacy ON claims(encounter_id);

-- 4. Add encounter_id to lab_tests table
ALTER TABLE lab_tests 
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_tests_encounter ON lab_tests(encounter_id);

COMMENT ON COLUMN lab_tests.encounter_id IS 'Links lab test to the clinical encounter';

-- 5. Add encounter_id to admissions table
ALTER TABLE admissions 
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admissions_encounter ON admissions(encounter_id);

COMMENT ON COLUMN admissions.encounter_id IS 'Links admission to the clinical encounter';

-- 6. Add encounter_id to triage_assessments table
ALTER TABLE triage_assessments 
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_triage_encounter ON triage_assessments(encounter_id);

COMMENT ON COLUMN triage_assessments.encounter_id IS 'Links triage assessment to the clinical encounter';

-- Fix triage_assessments column names (severity vs triage_level mismatch)
ALTER TABLE triage_assessments 
  ADD COLUMN IF NOT EXISTS severity TEXT;

UPDATE triage_assessments SET severity = triage_level WHERE severity IS NULL;

ALTER TABLE triage_assessments 
  ADD COLUMN IF NOT EXISTS pain_score TEXT;

UPDATE triage_assessments SET pain_score = COALESCE(pain_scale::TEXT, '0') WHERE pain_score IS NULL;

-- Add notes alias column (code sends 'notes', DB has 'assessment_notes')
ALTER TABLE triage_assessments 
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Give triage_level a default so new inserts without it don't violate NOT NULL
ALTER TABLE triage_assessments ALTER COLUMN triage_level SET DEFAULT 'yellow';

-- 7. Create discharge_summaries table
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
CREATE INDEX IF NOT EXISTS idx_discharge_encounter ON discharge_summaries(encounter_id);
CREATE INDEX IF NOT EXISTS idx_discharge_date ON discharge_summaries(discharge_date DESC);

COMMENT ON TABLE discharge_summaries IS 'Structured discharge documentation linking admission and encounter';

-- 8. Enable RLS on discharge_summaries
ALTER TABLE discharge_summaries ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view discharge summaries
DROP POLICY IF EXISTS "Staff view discharge summaries" ON discharge_summaries;
CREATE POLICY "Staff view discharge summaries"
  ON discharge_summaries FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'doctor', 'nurse', 'records_officer')
  );

-- Policy: Doctors and nurses can create discharge summaries
DROP POLICY IF EXISTS "Clinical staff create discharge summaries" ON discharge_summaries;
CREATE POLICY "Clinical staff create discharge summaries"
  ON discharge_summaries FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'doctor', 'nurse')
  );

-- 9. Update existing admissions with discharge_summary data
-- (Optional: migrate old discharge_summary text to new table)

-- 10. Triggers
DROP TRIGGER IF EXISTS update_discharge_summaries_timestamp ON discharge_summaries;
CREATE TRIGGER update_discharge_summaries_timestamp
  BEFORE UPDATE ON discharge_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. Fix ward_rounds for WardRounds.jsx
-- admission_id is NOT NULL but code never provides it (rounds can exist without a formal admission)
ALTER TABLE ward_rounds ALTER COLUMN admission_id DROP NOT NULL;
-- Code sends ward_id, clinical_findings, orders, notes — columns that don't exist yet
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES wards(id) ON DELETE SET NULL;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS clinical_findings TEXT;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS orders TEXT;
ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_ward_rounds_ward ON ward_rounds(ward_id);

-- 12. Add missing columns to clinical_orders for Radiology.jsx
-- Code sets started_at when scan begins, result_notes for findings
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS result_notes TEXT;

-- ============================================
-- Summary:
-- - Added encounter_id to: prescriptions, payments, claims, lab_tests, admissions, triage_assessments
-- - Created discharge_summaries table
-- - Fixed triage_assessments column name mismatches
-- - Fixed ward_rounds: made admission_id nullable, added ward_id/clinical_findings/orders/notes columns
-- - Fixed clinical_orders: added started_at and result_notes columns
-- - Added indexes and RLS policies
-- ============================================

-- ============================================================
-- END: migrations\007_encounter_threading.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\008_procurement_ward_transfers.sql
-- ============================================================

-- ============================================================
-- CareLink HMS — Migration 008: Procurement & Ward Transfers
-- Adds: suppliers, purchase_orders, purchase_order_items
--       patient_transfers (if not already created)
--       encounter_id on queue_management
-- ============================================================

-- ── Suppliers ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_hospital ON suppliers(hospital_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ── Purchase Orders ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ordered'
    CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  total_cost NUMERIC(12, 2) DEFAULT 0,
  expected_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_hospital ON purchase_orders(hospital_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);

-- ── Purchase Order Items ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poi_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_drug ON purchase_order_items(drug_id);

-- ── Patient Transfers ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id UUID REFERENCES admissions(id) ON DELETE SET NULL,
  from_ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  from_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  to_ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  to_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  reason TEXT,
  transferred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  transfer_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_patient ON patient_transfers(patient_id);
CREATE INDEX IF NOT EXISTS idx_transfers_admission ON patient_transfers(admission_id);

-- ── encounter_id on queue_management ────────────────────────

ALTER TABLE queue_management
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

ALTER TABLE queue_management
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_queue_encounter ON queue_management(encounter_id);

-- ── Updated-at triggers ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_suppliers_timestamp ON suppliers;
CREATE TRIGGER update_suppliers_timestamp
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_orders_timestamp ON purchase_orders;
CREATE TRIGGER update_purchase_orders_timestamp
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read suppliers" ON suppliers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manage suppliers" ON suppliers FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));

CREATE POLICY "Authenticated read purchase_orders" ON purchase_orders FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manage purchase_orders" ON purchase_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));

CREATE POLICY "Authenticated read purchase_order_items" ON purchase_order_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manage purchase_order_items" ON purchase_order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));

CREATE POLICY "Authenticated read patient_transfers" ON patient_transfers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Nurse manage patient_transfers" ON patient_transfers FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse', 'doctor')));

-- ============================================================
-- Migration 008 complete
-- New tables: suppliers, purchase_orders, purchase_order_items, patient_transfers
-- Altered:    queue_management (+encounter_id, +reason)
-- ============================================================

-- ============================================================
-- END: migrations\008_procurement_ward_transfers.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\009_production_patches.sql
-- ============================================================

-- ============================================================
-- CareLink HMS — Migration 009: Production Patches
-- Adds columns needed by the HealthFlow integration and
-- NHIA claim submission workflow.
-- All statements are safe to re-run (IF NOT EXISTS / DO NOTHING).
-- ============================================================

-- ── patients: date_of_birth ──────────────────────────────────
-- Required for NHIA pharmacy-claim API (dateOfBirth field).
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Back-fill where age is known but DOB is missing:
-- (approximate — sets DOB to Jan 1 of the birth year so claims
--  can proceed; staff should correct these during next patient visit)
UPDATE patients
SET date_of_birth = (CURRENT_DATE - (age || ' years')::INTERVAL)::DATE
WHERE date_of_birth IS NULL AND age IS NOT NULL AND age > 0;

-- ── prescriptions: NHIA claim tracking columns ───────────────
-- Written by Pharmacy.jsx after submitting via HealthFlow.
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS nhis_claim_id TEXT,
  ADD COLUMN IF NOT EXISTS nhis_cc_code  TEXT;

CREATE INDEX IF NOT EXISTS idx_prescriptions_nhis_claim ON prescriptions(nhis_claim_id)
  WHERE nhis_claim_id IS NOT NULL;

-- ── drugs: NHIA formulary code ───────────────────────────────
-- Used when building the medicines[] array for NHIA claim submission.
ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS nhia_code TEXT;

CREATE INDEX IF NOT EXISTS idx_drugs_nhia_code ON drugs(nhia_code)
  WHERE nhia_code IS NOT NULL;

-- ── integration_endpoints: ensure healthflow type is valid ───
-- The integration_endpoints table from migration 003 may have a
-- CHECK constraint on endpoint_type. If it does, we need to allow 'healthflow'.
-- This is safe to run even if the constraint doesn't exist.
DO $$
BEGIN
  -- Drop and recreate the check constraint if it exists and doesn't include 'healthflow'
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'integration_endpoints'
      AND constraint_name = 'integration_endpoints_endpoint_type_check'
  ) THEN
    -- Only alter if 'healthflow' is not already included
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'integration_endpoints_endpoint_type_check'
        AND check_clause LIKE '%healthflow%'
    ) THEN
      ALTER TABLE integration_endpoints
        DROP CONSTRAINT integration_endpoints_endpoint_type_check;
      ALTER TABLE integration_endpoints
        ADD CONSTRAINT integration_endpoints_endpoint_type_check
        CHECK (endpoint_type IN (
          'nhia_eclaims', 'dhims2', 'fhir_server', 'momo_mtn',
          'momo_telecel', 'momo_airteltigo', 'sms_gateway',
          'healthflow', 'other'
        ));
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- Migration 009 complete
-- Altered:  patients (+date_of_birth)
--           prescriptions (+nhis_claim_id, +nhis_cc_code)
--           drugs (+nhia_code)
--           integration_endpoints (healthflow type allowed)
-- ============================================================

-- ============================================================
-- END: migrations\009_production_patches.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\010_lab_sample_tracking.sql
-- ============================================================

-- ============================================================
-- CareLink HMS — Migration 010: Lab Sample Tracking Columns
-- Adds all columns required by labSampleService.js that are
-- missing from the base lab_tests table (database-setup.sql).
-- Safe to re-run (IF NOT EXISTS / DO blocks with guards).
-- ============================================================

-- ── 1. Accession number ─────────────────────────────────────
-- Generated by labSampleService.generateAccessionNumber()
-- Format: LAB-YYYYMMDD-XXXX
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS accession_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_tests_accession
  ON lab_tests(accession_number)
  WHERE accession_number IS NOT NULL;

-- ── 2. Priority ─────────────────────────────────────────────
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'routine'
  CHECK (priority IN ('routine', 'urgent', 'stat', 'emergency'));

-- ── 3. Clinical notes (separate from the existing 'notes') ──
-- labSampleService.js uses clinical_notes; base table has notes.
-- Both are kept — notes is for internal use, clinical_notes
-- carries the doctor's clinical indication for the test.
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS clinical_notes TEXT;

-- ── 4. Specimen / collection columns ────────────────────────
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS specimen_type TEXT;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS collection_notes TEXT;

-- ── 5. Processing columns ────────────────────────────────────
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- ── 6. Result tracking columns ──────────────────────────────
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS result_details JSONB DEFAULT '{}';

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS is_abnormal BOOLEAN DEFAULT FALSE;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── 7. Expand status CHECK constraint ───────────────────────
-- Base table only allows: pending, in_progress, completed, cancelled
-- labSampleService.js also uses: ordered, collected, processing
-- Strategy: drop the inline CHECK, recreate with full value set.
DO $$
BEGIN
  -- Drop the old constraint if it exists (auto-named by Postgres)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'lab_tests'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'lab_tests_status_check'
  ) THEN
    ALTER TABLE lab_tests DROP CONSTRAINT lab_tests_status_check;
  END IF;

  -- Add the expanded constraint
  -- (IF NOT EXISTS is not available for ADD CONSTRAINT before PG15,
  --  so we guard with the check above)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'lab_tests'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'lab_tests_status_check'
  ) THEN
    ALTER TABLE lab_tests
      ADD CONSTRAINT lab_tests_status_check
      CHECK (status IN (
        'pending',
        'ordered',
        'in_progress',
        'collected',
        'processing',
        'completed',
        'cancelled'
      ));
  END IF;
END;
$$;

-- ── 8. Helpful indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lab_tests_priority
  ON lab_tests(priority);

CREATE INDEX IF NOT EXISTS idx_lab_tests_collected_at
  ON lab_tests(collected_at DESC)
  WHERE collected_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_tests_completed_at
  ON lab_tests(completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- ============================================================
-- Migration 010 complete
-- Altered: lab_tests
--   Added:  accession_number, priority, clinical_notes,
--           specimen_type, collected_by, collected_at,
--           collection_notes, processed_by, processing_started_at,
--           result_details, is_abnormal, completed_by
--   Fixed:  status CHECK now includes ordered, collected, processing
-- ============================================================

-- ============================================================
-- END: migrations\010_lab_sample_tracking.sql
-- ============================================================


-- ============================================================
-- BEGIN: migrations\011_new_modules.sql
-- ============================================================

-- Migration 011: Theatre, Maternity, Dietary, Notifications, HR & Payroll, Ambulance, Patient Portal
-- Run this on your Supabase SQL editor

-- ==================== THEATRE MANAGEMENT ====================

CREATE TABLE IF NOT EXISTS theatre_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  procedure_name TEXT NOT NULL,
  surgeon TEXT NOT NULL,
  anaesthetist TEXT,
  ot_room TEXT,
  surgery_type TEXT DEFAULT 'elective' CHECK (surgery_type IN ('elective', 'emergency', 'urgent')),
  anaesthesia_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed')),
  pre_op_notes TEXT,
  consent_obtained BOOLEAN DEFAULT FALSE,
  consent_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theatre_pre_op (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES theatre_sessions(id) ON DELETE CASCADE,
  assessment_notes TEXT,
  fasting_confirmed BOOLEAN DEFAULT FALSE,
  allergies TEXT,
  blood_group TEXT,
  consent_obtained BOOLEAN DEFAULT FALSE,
  pre_op_medication TEXT,
  anaesthesia_type TEXT DEFAULT 'general',
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theatre_operation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES theatre_sessions(id) ON DELETE CASCADE,
  operation_notes TEXT NOT NULL,
  findings TEXT,
  complications TEXT,
  blood_loss_ml NUMERIC,
  duration_minutes INTEGER,
  implants_used TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theatre_post_op (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES theatre_sessions(id) ON DELETE CASCADE,
  post_op_notes TEXT,
  recovery_status TEXT DEFAULT 'stable',
  pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
  instructions TEXT,
  discharged_to TEXT DEFAULT 'ward',
  discharge_time TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE theatre_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_pre_op ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_operation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_post_op ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_theatre_sessions" ON theatre_sessions FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_theatre_pre_op" ON theatre_pre_op FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_theatre_op_notes" ON theatre_operation_notes FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_theatre_post_op" ON theatre_post_op FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== MATERNITY ====================

CREATE TABLE IF NOT EXISTS anc_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_date DATE NOT NULL,
  gestational_age_weeks NUMERIC,
  weight_kg NUMERIC,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  fundal_height_cm NUMERIC,
  fetal_heart_rate INTEGER,
  presentation TEXT DEFAULT 'cephalic',
  edd DATE,
  blood_group TEXT,
  hb_level NUMERIC,
  urine_protein TEXT DEFAULT 'negative',
  urine_glucose TEXT DEFAULT 'negative',
  tetanus_dose TEXT,
  iron_folate_given BOOLEAN DEFAULT FALSE,
  ipt_given BOOLEAN DEFAULT FALSE,
  llin_given BOOLEAN DEFAULT FALSE,
  notes TEXT,
  next_visit_date DATE,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maternity_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  delivery_date DATE NOT NULL,
  delivery_time TIME,
  delivery_mode TEXT DEFAULT 'svd' CHECK (delivery_mode IN ('svd', 'cs', 'assisted', 'breech')),
  gestational_age_weeks NUMERIC,
  birth_weight_kg NUMERIC,
  baby_sex TEXT CHECK (baby_sex IN ('male', 'female')),
  apgar_1min INTEGER,
  apgar_5min INTEGER,
  placenta_complete BOOLEAN DEFAULT TRUE,
  blood_loss_ml NUMERIC,
  episiotomy BOOLEAN DEFAULT FALSE,
  tears TEXT DEFAULT 'none',
  attendant TEXT,
  complications TEXT,
  outcome TEXT DEFAULT 'live_birth' CHECK (outcome IN ('live_birth', 'stillbirth', 'neonatal_death', 'twins')),
  mother_condition TEXT DEFAULT 'good',
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS postnatal_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_date DATE NOT NULL,
  days_postpartum INTEGER,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  temperature NUMERIC,
  uterus_involution TEXT DEFAULT 'normal',
  lochia TEXT DEFAULT 'normal',
  breast_condition TEXT DEFAULT 'normal',
  breastfeeding BOOLEAN DEFAULT TRUE,
  family_planning_counselled BOOLEAN DEFAULT FALSE,
  family_planning_method TEXT,
  baby_condition TEXT DEFAULT 'good',
  immunizations_given TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE anc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE maternity_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE postnatal_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_anc_visits" ON anc_visits FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_deliveries" ON maternity_deliveries FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_postnatal" ON postnatal_visits FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== DIETARY SERVICES ====================

CREATE TABLE IF NOT EXISTS diet_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  admission_id UUID REFERENCES admissions(id),
  diet_type TEXT NOT NULL,
  special_instructions TEXT,
  allergies TEXT,
  fluid_restriction_ml INTEGER,
  meal_frequency INTEGER DEFAULT 3,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed')),
  notes TEXT,
  ordered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE diet_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospital_diet_orders" ON diet_orders FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== NOTIFICATIONS ====================

CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL UNIQUE REFERENCES hospitals(id) ON DELETE CASCADE,
  sms_provider TEXT DEFAULT 'arkesel',
  sms_api_key TEXT,
  sms_sender_id TEXT,
  whatsapp_provider TEXT DEFAULT 'twilio',
  whatsapp_account_sid TEXT,
  whatsapp_auth_token TEXT,
  whatsapp_from_number TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('SMS', 'WhatsApp')),
  template_text TEXT NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, event_type, channel)
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  channel TEXT NOT NULL,
  event_type TEXT,
  message TEXT,
  recipient_phone TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  provider_response JSONB,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_notification_settings" ON notification_settings FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_notification_templates" ON notification_templates FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_notification_logs" ON notification_logs FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== HR & PAYROLL ====================

CREATE TABLE IF NOT EXISTS hr_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  department TEXT,
  role TEXT,
  employment_type TEXT DEFAULT 'Full-time',
  phone TEXT,
  email TEXT,
  hire_date DATE,
  basic_salary NUMERIC DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  national_id TEXT,
  ssnit_number TEXT,
  tin_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated', 'suspended')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, employee_id)
);

CREATE TABLE IF NOT EXISTS hr_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'off')),
  check_in TIME,
  check_out TIME,
  notes TEXT,
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, staff_id, date)
);

CREATE TABLE IF NOT EXISTS hr_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  applied_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM
  basic_salary NUMERIC DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  gross_salary NUMERIC DEFAULT 0,
  ssnit_deduction NUMERIC DEFAULT 0,
  income_tax NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'cancelled')),
  notes TEXT,
  generated_by UUID REFERENCES auth.users(id),
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, staff_id, month)
);

ALTER TABLE hr_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_hr_staff" ON hr_staff FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_hr_attendance" ON hr_attendance FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_hr_leaves" ON hr_leaves FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_hr_payroll" ON hr_payroll FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== AMBULANCE MANAGEMENT ====================

CREATE TABLE IF NOT EXISTS ambulance_fleet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  vehicle_type TEXT DEFAULT 'Basic Life Support',
  make_model TEXT,
  year INTEGER,
  driver_name TEXT,
  driver_phone TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'dispatched', 'maintenance', 'standby')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, registration_number)
);

CREATE TABLE IF NOT EXISTS ambulance_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  ambulance_id UUID NOT NULL REFERENCES ambulance_fleet(id),
  caller_name TEXT,
  caller_phone TEXT,
  incident_location TEXT NOT NULL,
  incident_type TEXT DEFAULT 'Medical Emergency',
  patient_name TEXT,
  dispatcher_notes TEXT,
  status TEXT DEFAULT 'en_route' CHECK (status IN ('en_route', 'on_scene', 'returning', 'completed', 'cancelled')),
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dispatched_by UUID REFERENCES auth.users(id)
);

ALTER TABLE ambulance_fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulance_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_ambulance_fleet" ON ambulance_fleet FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_ambulance_dispatches" ON ambulance_dispatches FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_theatre_sessions_hospital ON theatre_sessions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_theatre_sessions_patient ON theatre_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_patient ON anc_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_patient ON maternity_deliveries(patient_id);
CREATE INDEX IF NOT EXISTS idx_postnatal_patient ON postnatal_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_diet_orders_hospital ON diet_orders(hospital_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_hospital ON notification_logs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_patient ON notification_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_hr_staff_hospital ON hr_staff(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON hr_attendance(hospital_id, date);
CREATE INDEX IF NOT EXISTS idx_ambulance_dispatches_status ON ambulance_dispatches(hospital_id, status);

-- ============================================================
-- END: migrations\011_new_modules.sql
-- ============================================================

