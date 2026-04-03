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
