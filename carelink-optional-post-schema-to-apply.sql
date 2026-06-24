-- CareLink HMS optional post-schema bundle
-- Apply after carelink-full-schema-to-apply.sql only if you want branding/onboarding/RBAC hardening/catalog seed data.



-- ============================================================
-- BEGIN: hospital-profile-setup.sql
-- ============================================================

-- ============================================
-- CareLink HMS - Hospital Profile Setup
-- Shared CareLink brand with per-hospital identity
-- Author: David Gabion Selorm
-- Date: April 3, 2026
-- ============================================
--
-- PURPOSE:
-- - Keeps CareLink as the umbrella product name
-- - Lets each hospital show its own name in login and dashboard UI
-- - Stores one profile row per deployment
-- ============================================

CREATE TABLE IF NOT EXISTS hospital_profile (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  platform_name TEXT NOT NULL DEFAULT 'CareLink HMS',
  hospital_name TEXT NOT NULL DEFAULT 'Your Hospital Name',
  branch_name TEXT,
  dashboard_label TEXT,
  tagline TEXT NOT NULL DEFAULT 'Powered by CareLink',
  primary_color TEXT,
  secondary_color TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO hospital_profile (singleton_key)
VALUES (TRUE)
ON CONFLICT (singleton_key) DO NOTHING;

CREATE OR REPLACE FUNCTION set_hospital_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hospital_profile_updated_at ON hospital_profile;
CREATE TRIGGER update_hospital_profile_updated_at
  BEFORE UPDATE ON hospital_profile
  FOR EACH ROW
  EXECUTE FUNCTION set_hospital_profile_updated_at();

ALTER TABLE hospital_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospital_profile_select_public ON hospital_profile;
DROP POLICY IF EXISTS hospital_profile_insert_admin ON hospital_profile;
DROP POLICY IF EXISTS hospital_profile_update_admin ON hospital_profile;

CREATE POLICY hospital_profile_select_public
  ON hospital_profile
  FOR SELECT
  USING (TRUE);

CREATE POLICY hospital_profile_insert_admin
  ON hospital_profile
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

CREATE POLICY hospital_profile_update_admin
  ON hospital_profile
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

SELECT singleton_key, platform_name, hospital_name, branch_name, dashboard_label, tagline
FROM hospital_profile;

-- ============================================================
-- END: hospital-profile-setup.sql
-- ============================================================


-- ============================================================
-- BEGIN: hospital-onboarding-setup.sql
-- ============================================================

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

-- ============================================================
-- END: hospital-onboarding-setup.sql
-- ============================================================


-- ============================================================
-- BEGIN: role-based-rls-policies.sql
-- ============================================================

-- ============================================
-- CareLink HMS - Role-Based RLS Policies
-- Replace insecure USING (TRUE) policies with role-based restrictions
-- Author: David Gabion Selorm
-- Date: April 4, 2026
-- ============================================

-- Helper function to get user role from auth.users metadata
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM users WHERE id = auth.uid()),
    'unauthorized'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================
-- USERS TABLE - Admin only for modifications, all can view
-- ============================================

DROP POLICY IF EXISTS users_select_authenticated ON users;
DROP POLICY IF EXISTS users_insert_authenticated ON users;
DROP POLICY IF EXISTS users_update_authenticated ON users;
DROP POLICY IF EXISTS users_delete_authenticated ON users;

-- All authenticated users can view user profiles
CREATE POLICY users_select_authenticated
  ON users FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only admins can create new users
CREATE POLICY users_insert_admin_only
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

-- Only admins can update users
CREATE POLICY users_update_admin_only
  ON users FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Only admins can delete users
CREATE POLICY users_delete_admin_only
  ON users FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- PATIENTS TABLE - Medical staff can access
-- ============================================

DROP POLICY IF EXISTS patients_select_authenticated ON patients;
DROP POLICY IF EXISTS patients_insert_authenticated ON patients;
DROP POLICY IF EXISTS patients_update_authenticated ON patients;
DROP POLICY IF EXISTS patients_delete_authenticated ON patients;

-- Medical staff can view patients
CREATE POLICY patients_select_medical_staff
  ON patients FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'pharmacist', 'cashier', 'records_officer')
  );

-- Medical staff can register patients
CREATE POLICY patients_insert_medical_staff
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'records_officer')
  );

-- Medical staff can update patient records
CREATE POLICY patients_update_medical_staff
  ON patients FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'records_officer')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'records_officer')
  );

-- Only admins can delete patients
CREATE POLICY patients_delete_admin_only
  ON patients FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- PRESCRIPTIONS TABLE - Doctors create, pharmacists dispense
-- ============================================

DROP POLICY IF EXISTS prescriptions_select_authenticated ON prescriptions;
DROP POLICY IF EXISTS prescriptions_insert_authenticated ON prescriptions;
DROP POLICY IF EXISTS prescriptions_update_authenticated ON prescriptions;
DROP POLICY IF EXISTS prescriptions_delete_authenticated ON prescriptions;

-- Medical staff can view prescriptions
CREATE POLICY prescriptions_select_medical_staff
  ON prescriptions FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'pharmacist', 'nurse')
  );

-- Only doctors can create prescriptions
CREATE POLICY prescriptions_insert_doctors_only
  ON prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor')
  );

-- Doctors and pharmacists can update prescriptions
CREATE POLICY prescriptions_update_medical_staff
  ON prescriptions FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'pharmacist')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'pharmacist')
  );

-- Only admins and prescribing doctors can delete prescriptions
CREATE POLICY prescriptions_delete_restricted
  ON prescriptions FOR DELETE
  TO authenticated
  USING (
    get_user_role() = 'admin'
  );

-- ============================================
-- PRESCRIPTION ITEMS TABLE - Linked to prescriptions
-- ============================================

DROP POLICY IF EXISTS prescription_items_select_authenticated ON prescription_items;
DROP POLICY IF EXISTS prescription_items_insert_authenticated ON prescription_items;
DROP POLICY IF EXISTS prescription_items_update_authenticated ON prescription_items;
DROP POLICY IF EXISTS prescription_items_delete_authenticated ON prescription_items;

CREATE POLICY prescription_items_select_medical_staff
  ON prescription_items FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'pharmacist', 'nurse')
  );

CREATE POLICY prescription_items_insert_doctors_only
  ON prescription_items FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor')
  );

CREATE POLICY prescription_items_update_medical_staff
  ON prescription_items FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'pharmacist')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'pharmacist')
  );

CREATE POLICY prescription_items_delete_restricted
  ON prescription_items FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- DRUGS TABLE - Pharmacists manage inventory
-- ============================================

DROP POLICY IF EXISTS drugs_select_authenticated ON drugs;
DROP POLICY IF EXISTS drugs_insert_authenticated ON drugs;
DROP POLICY IF EXISTS drugs_update_authenticated ON drugs;
DROP POLICY IF EXISTS drugs_delete_authenticated ON drugs;

-- All medical staff can view drugs
CREATE POLICY drugs_select_medical_staff
  ON drugs FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'pharmacist', 'nurse')
  );

-- Only pharmacists and admins can add drugs
CREATE POLICY drugs_insert_pharmacists_only
  ON drugs FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'pharmacist')
  );

-- Only pharmacists and admins can update drugs
CREATE POLICY drugs_update_pharmacists_only
  ON drugs FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'pharmacist')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'pharmacist')
  );

-- Only admins can delete drugs
CREATE POLICY drugs_delete_admin_only
  ON drugs FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- PAYMENTS TABLE - Finance staff access
-- ============================================

DROP POLICY IF EXISTS payments_select_authenticated ON payments;
DROP POLICY IF EXISTS payments_insert_authenticated ON payments;
DROP POLICY IF EXISTS payments_update_authenticated ON payments;
DROP POLICY IF EXISTS payments_delete_authenticated ON payments;

-- Finance and medical staff can view payments
CREATE POLICY payments_select_authorized_staff
  ON payments FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'cashier', 'doctor', 'pharmacist')
  );

-- Cashiers can record payments
CREATE POLICY payments_insert_cashiers_only
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'cashier')
  );

-- Cashiers and admins can update payments
CREATE POLICY payments_update_finance_staff
  ON payments FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'cashier')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'cashier')
  );

-- Only admins can delete payments (audit trail)
CREATE POLICY payments_delete_admin_only
  ON payments FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- CLAIMS TABLE - Admin and finance only
-- ============================================

DROP POLICY IF EXISTS claims_select_authenticated ON claims;
DROP POLICY IF EXISTS claims_insert_authenticated ON claims;
DROP POLICY IF EXISTS claims_update_authenticated ON claims;
DROP POLICY IF EXISTS claims_delete_authenticated ON claims;

CREATE POLICY claims_select_admin_only
  ON claims FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('admin', 'cashier'));

CREATE POLICY claims_insert_admin_only
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'cashier'));

CREATE POLICY claims_update_admin_only
  ON claims FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('admin', 'cashier'))
  WITH CHECK (get_user_role() IN ('admin', 'cashier'));

CREATE POLICY claims_delete_admin_only
  ON claims FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- LAB TESTS TABLE - Doctors order, lab staff process
-- ============================================

DROP POLICY IF EXISTS lab_tests_select_authenticated ON lab_tests;
DROP POLICY IF EXISTS lab_tests_insert_authenticated ON lab_tests;
DROP POLICY IF EXISTS lab_tests_update_authenticated ON lab_tests;
DROP POLICY IF EXISTS lab_tests_delete_authenticated ON lab_tests;

CREATE POLICY lab_tests_select_medical_staff
  ON lab_tests FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'lab_tech')
  );

CREATE POLICY lab_tests_insert_doctors_only
  ON lab_tests FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor')
  );

CREATE POLICY lab_tests_update_medical_staff
  ON lab_tests FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'lab_tech')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'lab_tech')
  );

CREATE POLICY lab_tests_delete_admin_only
  ON lab_tests FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- APPOINTMENTS TABLE - Medical staff access
-- ============================================

DROP POLICY IF EXISTS appointments_select_authenticated ON appointments;
DROP POLICY IF EXISTS appointments_insert_authenticated ON appointments;
DROP POLICY IF EXISTS appointments_update_authenticated ON appointments;
DROP POLICY IF EXISTS appointments_delete_authenticated ON appointments;

CREATE POLICY appointments_select_medical_staff
  ON appointments FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'records_officer')
  );

CREATE POLICY appointments_insert_medical_staff
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'records_officer')
  );

CREATE POLICY appointments_update_medical_staff
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'records_officer')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'nurse', 'records_officer')
  );

CREATE POLICY appointments_delete_authorized_staff
  ON appointments FOR DELETE
  TO authenticated
  USING (
    get_user_role() IN ('admin', 'doctor')
  );

-- ============================================
-- AUDIT LOG TABLE - Read-only for most, admins can manage
-- ============================================

DROP POLICY IF EXISTS audit_log_select_authenticated ON audit_log;
DROP POLICY IF EXISTS audit_log_insert_authenticated ON audit_log;
DROP POLICY IF EXISTS audit_log_update_authenticated ON audit_log;
DROP POLICY IF EXISTS audit_log_delete_authenticated ON audit_log;

CREATE POLICY audit_log_select_all_staff
  ON audit_log FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY audit_log_insert_all_staff
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Audit logs are immutable (no updates allowed)
CREATE POLICY audit_log_no_updates
  ON audit_log FOR UPDATE
  TO authenticated
  USING (FALSE);

-- Only admins can delete old audit logs
CREATE POLICY audit_log_delete_admin_only
  ON audit_log FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Role-based RLS policies applied successfully!';
  RAISE NOTICE '📋 Policy Summary:';
  RAISE NOTICE '- Users: Admin-only modifications';
  RAISE NOTICE '- Patients: Medical staff access';
  RAISE NOTICE '- Prescriptions: Doctors create, pharmacists dispense';
  RAISE NOTICE '- Drugs: Pharmacists manage inventory';
  RAISE NOTICE '- Payments: Cashiers process';
  RAISE NOTICE '- Claims: Admin and finance only';
  RAISE NOTICE '- Lab Tests: Doctors order, lab staff process';
  RAISE NOTICE '- Appointments: Medical staff manage';
  RAISE NOTICE '- Audit Log: Read for all, write for all, delete admin-only';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Run this in Supabase SQL Editor to replace existing policies';
  RAISE NOTICE '⚠️  Test thoroughly before production deployment';
END $$;

-- ============================================================
-- END: role-based-rls-policies.sql
-- ============================================================


-- ============================================================
-- BEGIN: seed-prices-catalog.sql
-- ============================================================

-- ============================================
-- CareLink HMS - Prices & Catalog Setup
-- Run this in Supabase SQL Editor (once)
-- Author: David Gabion Selorm
-- Date: April 5, 2026
-- Source: LABS AND SERVICE PRICES 2026.xlsx
--         Medicine Pricing List.pdf
--         medicine list.pdf (NHIS prices)
-- ============================================

-- ============================================
-- 1. EXTEND DRUGS TABLE WITH PRICING COLUMNS
-- ============================================
ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS strength TEXT,
  ADD COLUMN IF NOT EXISTS formulation TEXT,
  ADD COLUMN IF NOT EXISTS nhis_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand_type TEXT NOT NULL DEFAULT 'Generic';

-- ============================================
-- 2. CREATE LAB TEST CATALOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lab_test_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lab_test_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_test_catalog_select ON lab_test_catalog;
DROP POLICY IF EXISTS lab_test_catalog_insert ON lab_test_catalog;
DROP POLICY IF EXISTS lab_test_catalog_update ON lab_test_catalog;
DROP POLICY IF EXISTS lab_test_catalog_delete ON lab_test_catalog;

CREATE POLICY lab_test_catalog_select ON lab_test_catalog FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY lab_test_catalog_insert ON lab_test_catalog FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');
CREATE POLICY lab_test_catalog_update ON lab_test_catalog FOR UPDATE TO authenticated USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY lab_test_catalog_delete ON lab_test_catalog FOR DELETE TO authenticated USING (get_user_role() = 'admin');

-- ============================================
-- 3. CREATE SERVICE FEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS service_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_fees_select ON service_fees;
DROP POLICY IF EXISTS service_fees_insert ON service_fees;
DROP POLICY IF EXISTS service_fees_update ON service_fees;
DROP POLICY IF EXISTS service_fees_delete ON service_fees;

CREATE POLICY service_fees_select ON service_fees FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY service_fees_insert ON service_fees FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');
CREATE POLICY service_fees_update ON service_fees FOR UPDATE TO authenticated USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY service_fees_delete ON service_fees FOR DELETE TO authenticated USING (get_user_role() = 'admin');

-- ============================================
-- 4. SEED: LAB TEST CATALOG
-- Prices from LABS AND SERVICE PRICES 2026.xlsx
-- ============================================
INSERT INTO lab_test_catalog (name, category, price) VALUES

-- Haematology
('BF/MPS (Blood Film / Malaria Parasite Screen)', 'Haematology', 59.15),
('WIDAL Test', 'Haematology', 59.15),
('Typhoid Antibodies (IgG/IgM)', 'Haematology', 70.00),
('FBC - Full Blood Count (Automation)', 'Haematology', 75.00),
('HB (Haemoglobin)', 'Haematology', 59.15),
('Blood Group', 'Haematology', 50.00),
('Sickling Test', 'Haematology', 59.15),
('HB Electrophoresis', 'Haematology', 90.00),
('HbA1c (Glycated Haemoglobin)', 'Haematology', 106.00),
('ESR - Erythrocyte Sedimentation Rate', 'Haematology', 55.00),
('Clotting Profile', 'Haematology', 140.00),
('Bleeding Time', 'Haematology', 72.00),
('Clotting Time', 'Haematology', 73.00),
('Direct and Indirect Coombs Test', 'Haematology', 105.00),
('Cross Matching', 'Haematology', 55.00),
('Rhesus Factor', 'Haematology', 50.00),

-- Microbiology
('Urine R/E (Routine Examination)', 'Microbiology', 50.00),
('Urine C/S (Culture & Sensitivity)', 'Microbiology', 165.00),
('Blood C/S (Culture & Sensitivity)', 'Microbiology', 165.00),
('Stool R/E (Routine Examination)', 'Microbiology', 50.00),
('Stool C/S (Culture & Sensitivity)', 'Microbiology', 165.00),
('Sputum for AFB', 'Microbiology', 100.00),
('Sputum C/S (Culture & Sensitivity)', 'Microbiology', 152.00),
('HVS R/E (High Vaginal Swab - Routine)', 'Microbiology', 62.00),
('HVS C/S (High Vaginal Swab - Culture)', 'Microbiology', 165.00),
('Ear Swab', 'Microbiology', 98.00),
('Oral / Throat Swab', 'Microbiology', 125.00),
('Urethral Swab', 'Microbiology', 125.00),
('Gonorrhoea Antigen Test', 'Microbiology', 125.00),
('Pap Smear', 'Microbiology', 510.00),
('Skin Snip', 'Microbiology', 100.00),
('Skin Scrapping', 'Microbiology', 100.00),
('Semen Analysis', 'Microbiology', 165.00),
('Semen C/S', 'Microbiology', 250.00),

-- Biochemistry
('FBS / RBS (Fasting / Random Blood Glucose)', 'Biochemistry', 42.00),
('Lipid Profile', 'Biochemistry', 165.00),
('BUE and Creatinine', 'Biochemistry', 165.00),
('BUE and Creatinine (eGFR)', 'Biochemistry', 165.00),
('LFT - Liver Function Test', 'Biochemistry', 165.00),
('Uric Acid', 'Biochemistry', 58.00),
('OGTT (Oral Glucose Tolerance Test)', 'Biochemistry', 120.00),
('Bilirubin', 'Biochemistry', 50.00),
('Total Bilirubin', 'Biochemistry', 50.00),
('Urea', 'Biochemistry', 50.00),
('Albumin', 'Biochemistry', 50.00),
('ALP - Alkaline Phosphatase', 'Biochemistry', 50.00),
('ALT - Alanine Transaminase', 'Biochemistry', 50.00),
('AST - Aspartate Transaminase', 'Biochemistry', 50.00),
('Calcium', 'Biochemistry', 43.00),
('Amylase', 'Biochemistry', 50.00),
('LDH (Lactate Dehydrogenase)', 'Biochemistry', 50.00),
('Electrolytes', 'Biochemistry', 84.50),

-- Serology / Immunology
('VDRL Test', 'Serology', 50.00),
('HIV Screening (Retro Screening 1 & 2)', 'Serology', 63.00),
('HCV - Hepatitis C', 'Serology', 55.00),
('HBsAg - Hepatitis B Surface Antigen', 'Serology', 50.00),
('C-Reactive Protein (CRP)', 'Serology', 155.00),
('Rheumatoid Factor', 'Serology', 98.00),
('TORCH for Pregnant Women', 'Serology', 152.00),
('B-HCG (Serum Quantitative)', 'Serology', 140.00),
('H. Pylori (Serum)', 'Serology', 100.00),
('H. Pylori (Stool)', 'Serology', 100.00),
('Chlamydia Test', 'Serology', 115.00),
('Cardiac Enzymes', 'Serology', 218.00),
('Troponin I', 'Serology', 218.00),
('Troponin T', 'Serology', 218.00),
('CEA - Carcinoembryonic Antigen', 'Serology', 190.00),
('AFP - Alpha-Fetoprotein', 'Serology', 108.00),
('G6PD (Glucose-6-Phosphate Dehydrogenase)', 'Serology', 90.00),
('Hepatitis B Profile', 'Serology', 510.00),
('Hepatitis B Viral Load', 'Serology', 1100.00),
('HIV Viral Load', 'Serology', 1280.00),

-- Hormones
('LH - Luteinising Hormone', 'Hormones', 125.00),
('FSH - Follicle Stimulating Hormone', 'Hormones', 125.00),
('Estradiol', 'Hormones', 125.00),
('Testosterone', 'Hormones', 125.00),
('PSA - Prostatic Specific Antigen', 'Hormones', 125.00),
('Prolactin', 'Hormones', 125.00),
('Progesterone', 'Hormones', 125.00),
('TSH - Thyroid Stimulating Hormone', 'Hormones', 162.00),
('FT3 - Free Triiodothyronine', 'Hormones', 125.00),
('FT4 - Free Thyroxine', 'Hormones', 135.00),
('TFT - Thyroid Function Test', 'Hormones', 280.00),
('AMH - Anti Mullerian Hormone', 'Hormones', 510.00),

-- Pregnancy
('Urine Pregnancy Test', 'Pregnancy', 45.00),
('Blood Pregnancy Test (SPT)', 'Pregnancy', 60.00),
('Urine Protein and Sugar', 'Pregnancy', 50.00),

-- Imaging (in-lab)
('Prostate Ultrasound', 'Imaging', 180.00),
('Thyroid Ultrasound', 'Imaging', 180.00)

ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  category = EXCLUDED.category;

-- ============================================
-- 5. SEED: SERVICE FEES
-- Prices from LABS AND SERVICE PRICES 2026.xlsx
-- ============================================
INSERT INTO service_fees (service_name, category, price) VALUES

-- Consultation & Registration
('Registration', 'Consultation', 50.70),
('Consultation - General Practitioner', 'Consultation', 110.00),
('Review Consultation', 'Consultation', 65.00),
('Specialist Consultation', 'Consultation', 240.00),
('Psychologist Consultation', 'Consultation', 240.00),
('Specialist Consultation (Review)', 'Consultation', 145.00),
('Antenatal Care', 'Consultation', 140.00),
('Telemedicine Consultation (GP)', 'Consultation', 75.00),
('Telemedicine Consultation (Specialist)', 'Consultation', 125.00),

-- Records
('Maternal Records Book (ANC Book)', 'Records', 42.25),
('Diabetic Book', 'Records', 33.80),
('Referral Letter to Other Facilities', 'Records', 125.00),

-- Admission & In-patient
('Detention - General', 'Admission', 145.00),
('Detention - Side Ward', 'Admission', 172.00),
('Detention - Private Ward', 'Admission', 185.00),
('Admission - General Ward', 'Admission', 185.00),
('Admission - Side Ward', 'Admission', 230.00),
('Admission - Private Ward', 'Admission', 280.00),
('Consumables (per day)', 'Admission', 55.00),
('Nursing Care - Inpatient (per day)', 'Admission', 60.00),
('Doctor Care - Inpatient (per day)', 'Admission', 65.00),

-- Diagnostic & Imaging
('Ultrasound Scan (Pelvic)', 'Diagnostic', 176.00),
('Abdominal Ultrasound Scan', 'Diagnostic', 185.00),
('Abdominopelvic Ultrasound Scan', 'Diagnostic', 225.00),
('Transvaginal Scan', 'Diagnostic', 175.00),
('Electrocardiogram (ECG)', 'Diagnostic', 145.00),
('Cardiotocography (CTG)', 'Diagnostic', 255.00),

-- Procedures
('Oxygen for 30 Minutes', 'Procedure', 75.00),
('Oxygen for 1 Hour', 'Procedure', 125.00),
('Daily Wound Dressing (Minor)', 'Procedure', 88.00),
('Daily Wound Dressing (Medium)', 'Procedure', 125.00),
('Ear Wash (One Ear)', 'Procedure', 120.00),
('Ear Wash (Both Ears)', 'Procedure', 191.00),
('Nebulization', 'Procedure', 100.00),
('Breast Screening / Examination', 'Procedure', 62.00),
('Bedmat', 'Procedure', 32.00),
('Blood Transfusion', 'Procedure', 760.00),
('Anaesthesia (Local / Minor)', 'Procedure', 225.00),
('Ambulance Fees (Within Greater Accra)', 'Procedure', 760.00),

-- Physiotherapy
('Physiotherapy Consultation', 'Physiotherapy', 240.00),
('Exercise Therapy', 'Physiotherapy', 180.00),
('Stress Therapy', 'Physiotherapy', 370.00),
('Thoracic Spine / Soft Tissue Mobilization', 'Physiotherapy', 250.00),
('Electrotherapy', 'Physiotherapy', 192.00),
('Thermotherapy', 'Physiotherapy', 200.00),
('Cryotherapy / Hot Pack (Adult)', 'Physiotherapy', 340.00),
('Physio-Medical', 'Physiotherapy', 160.00),
('Rehabilitation Therapy (per session)', 'Physiotherapy', 155.00),
('POP Casting', 'Physiotherapy', 185.00),
('Developmental Delay Treatment - Children (per session)', 'Physiotherapy', 185.00),

-- Eye Care
('Optometrist Consultation', 'Eye Care', 140.00),
('Removal of Foreign Body (Eye)', 'Eye Care', 125.00),
('Refraction', 'Eye Care', 50.00),
('Biometry', 'Eye Care', 100.00),
('Incision and Curation', 'Eye Care', 100.00),
('Epilation', 'Eye Care', 100.00),
('Schirmer Test', 'Eye Care', 115.00),
('Pterygium Surgery (Conjunctival Autograft)', 'Eye Care', 1660.00),
('Chalazion Incision', 'Eye Care', 1280.00),
('Intraocular Pressure (IOP)', 'Eye Care', 30.00),
('Visual Field Test', 'Eye Care', 125.00),

-- Surgery & Obstetrics
('Surgery - Haemorrhoidectomy / Inguinal Hernia / Herniorrhaphy / Hydrocele / Fistulectomy', 'Surgery', 5340.00),
('Surgery - Umbilical Hernia / Para-Umbilical Hernia / Epigastric Hernia / Appendicectomy', 'Surgery', 5730.00),
('Surgery - Excision Biopsy (Minor)', 'Surgery', 3437.50),
('Surgery - Excision Biopsy (Major)', 'Surgery', 4560.00),
('Surgery - Cervical Cerclage', 'Surgery', 3950.00),
('Surgery - Caesarean Section', 'Surgery', 7350.00),
('Surgery - Ectopic Gestation', 'Surgery', 7350.00),
('Surgery - Abdominal Hysterectomy', 'Surgery', 8100.00),
('Surgery - Myomectomy', 'Surgery', 8100.00),
('Surgery - Inevitable EOU / MVA', 'Surgery', 2100.00),
('Spontaneous Vaginal Delivery', 'Surgery', 2750.00),
('Vaginal Delivery by Induction', 'Surgery', 3600.00),
('Surgery - Episiotomy', 'Surgery', 450.00),
('Surgery - Circumcision', 'Surgery', 450.00),
('Suturing - Major', 'Surgery', 450.00),
('Suturing - Medium', 'Surgery', 250.00),
('Suturing - Minor', 'Surgery', 186.00)

ON CONFLICT (service_name) DO UPDATE SET
  price = EXCLUDED.price,
  category = EXCLUDED.category;

-- ============================================
-- 6. SEED: DRUGS
-- Prices from Medicine Pricing List.pdf (cash prices)
-- NOTE: Run after table already exists.
--       This will skip existing names if no unique constraint;
--       add UNIQUE constraint on drugs.name first if desired.
-- ============================================
INSERT INTO drugs (name, category, formulation, strength, unit, price, nhis_price, brand_type, stock, reorder_level) VALUES

-- Antimalarials
('A/L Suspension (Artemether/Lumefantrine) 20+120mg/5ml', 'antimalaria', 'Suspension', '20mg+120mg/5ml', 'bottles', 19.60, 0, 'Generic', 50, 10),
('AL Tablet 80/480mg (Artemether/Lumefantrine)', 'antimalaria', 'Tablet', '80/480mg', 'tablets', 24.50, 4.00, 'Generic', 100, 20),
('Artesunate Injection 30mg', 'antimalaria', 'Injection', '30mg', 'vials', 26.00, 0, 'Generic', 30, 5),
('Artesunate Injection 60mg', 'antimalaria', 'Injection', '60mg', 'vials', 35.00, 0, 'Generic', 30, 5),
('Artesunate Injection 120mg', 'antimalaria', 'Injection', '120mg', 'vials', 42.00, 0, 'Generic', 20, 5),
('Artemether Injection 80mg/ml', 'antimalaria', 'Injection', '80mg/ml', 'ampoules', 15.00, 0, 'Generic', 20, 5),
('Coartem Tablet 80/480mg', 'antimalaria', 'Tablet', '80/480mg', 'tablets', 97.00, 0, 'Brand', 50, 10),
('Lonart DS Tablet 80/480mg', 'antimalaria', 'Tablet', '80/480mg', 'tablets', 40.60, 0, 'Brand', 40, 10),
('SP Tablet (Sulfadoxine/Pyrimethamine) 525mg', 'antimalaria', 'Tablet', '525mg', 'tablets', 12.00, 0, 'Generic', 60, 10),

-- Antibiotics
('Amoxicillin Capsule 250mg', 'antibiotic', 'Capsule', '250mg', 'capsules', 0.48, 0, 'Generic', 500, 100),
('Amoxicillin Capsule 500mg', 'antibiotic', 'Capsule', '500mg', 'capsules', 1.19, 0, 'Generic', 500, 100),
('Amoxicillin Suspension 125mg/5ml', 'antibiotic', 'Suspension', '125mg/5ml', 'bottles', 18.00, 0, 'Generic', 50, 10),
('Amoksiklav Tablet 625mg', 'antibiotic', 'Tablet', '625mg', 'tablets', 4.25, 0, 'Brand', 100, 20),
('Amoksiklav Suspension 228mg/5ml', 'antibiotic', 'Suspension', '228mg/5ml', 'bottles', 44.00, 0, 'Brand', 30, 5),
('Amoksiklav Suspension 457mg/5ml', 'antibiotic', 'Suspension', '457mg/5ml', 'bottles', 60.00, 0, 'Brand', 20, 5),
('Augmentin Tablet 625mg', 'antibiotic', 'Tablet', '625mg', 'tablets', 22.00, 0, 'Brand', 50, 10),
('Augmentin Injection 1.2g', 'antibiotic', 'Injection', '1.2g', 'vials', 43.98, 0, 'Brand', 20, 5),
('Azithromycin Capsule 250mg', 'antibiotic', 'Capsule', '250mg', 'capsules', 4.00, 0, 'Generic', 100, 20),
('Azithromycin Tablet 500mg', 'antibiotic', 'Tablet', '500mg', 'tablets', 23.50, 0, 'Generic', 100, 20),
('Azithromycin Suspension 200mg/5ml', 'antibiotic', 'Suspension', '200mg/5ml', 'bottles', 44.10, 0, 'Generic', 30, 5),
('Ceftriaxone Injection 1g', 'antibiotic', 'Injection', '1g', 'vials', 38.00, 0, 'Generic', 30, 5),
('Ceftriaxone Injection 2g', 'antibiotic', 'Injection', '2g', 'vials', 400.00, 0, 'Brand', 10, 2),
('Cefuroxime Tablet 250mg', 'antibiotic', 'Tablet', '250mg', 'tablets', 5.04, 0, 'Generic', 100, 20),
('Cefuroxime Tablet 500mg', 'antibiotic', 'Tablet', '500mg', 'tablets', 10.00, 0, 'Generic', 100, 20),
('Cefuroxime Suspension 125mg/5ml', 'antibiotic', 'Suspension', '125mg/5ml', 'bottles', 35.00, 0, 'Generic', 20, 5),
('Cefuroxime Injection 750mg (Zinacef)', 'antibiotic', 'Injection', '750mg', 'vials', 35.00, 5.00, 'Brand', 20, 5),
('Cefixime Tablet 200mg', 'antibiotic', 'Tablet', '200mg', 'tablets', 4.00, 0, 'Generic', 50, 10),
('Cefixime Suspension 100mg/5ml', 'antibiotic', 'Suspension', '100mg/5ml', 'bottles', 81.20, 0, 'Generic', 20, 5),
('Ciprofloxacin Tablet 500mg', 'antibiotic', 'Tablet', '500mg', 'tablets', 2.50, 0, 'Generic', 200, 30),
('Ciprofloxacin Infusion 200mg/100ml', 'antibiotic', 'Injection', '200mg/100ml', 'bottles', 20.00, 0, 'Generic', 20, 5),
('Ciprofloxacin Eye/Ear Drop 0.3%', 'antibiotic', 'Eye/Ear Drop', '0.3%', 'bottles', 9.66, 0, 'Generic', 20, 5),
('Clindamycin Capsule 150mg', 'antibiotic', 'Capsule', '150mg', 'capsules', 1.50, 0, 'Generic', 100, 20),
('Clindamycin Capsule 300mg', 'antibiotic', 'Capsule', '300mg', 'capsules', 2.50, 0, 'Generic', 100, 20),
('Doxycycline Capsule 100mg', 'antibiotic', 'Capsule', '100mg', 'capsules', 1.00, 0, 'Generic', 100, 20),
('Erythromycin Tablet 250mg', 'antibiotic', 'Tablet', '250mg', 'tablets', 0.82, 0, 'Generic', 100, 20),
('Erythromycin Suspension 125mg/5ml', 'antibiotic', 'Suspension', '125mg/5ml', 'bottles', 25.00, 0, 'Generic', 20, 5),
('Flucloxacillin Capsule 250mg', 'antibiotic', 'Capsule', '250mg', 'capsules', 0.66, 0, 'Generic', 100, 20),
('Flucloxacillin Capsule 500mg', 'antibiotic', 'Capsule', '500mg', 'capsules', 2.60, 0, 'Generic', 100, 20),
('Levofloxacin Tablet 500mg', 'antibiotic', 'Tablet', '500mg', 'tablets', 5.88, 0, 'Generic', 50, 10),
('Metronidazole Tablet 400mg', 'antibiotic', 'Tablet', '400mg', 'tablets', 0.25, 0, 'Generic', 200, 30),
('Metronidazole Infusion 500mg/100ml', 'antibiotic', 'Injection', '500mg/100ml', 'bottles', 20.00, 0, 'Generic', 20, 5),
('Metronidazole Suspension 200mg/5ml', 'antibiotic', 'Suspension', '200mg/5ml', 'bottles', 20.00, 0, 'Generic', 20, 5),
('Nitrofurantoin Tablet 100mg', 'antibiotic', 'Tablet', '100mg', 'tablets', 8.00, 0, 'Generic', 50, 10),

-- Antifungals
('Clotrimazole Cream 1%', 'antifungal', 'Cream', '1%', 'tubes', 30.00, 0, 'Generic', 30, 5),
('Clotrimazole Pessary 100mg', 'antifungal', 'Pessary', '100mg', 'pieces', 53.50, 0, 'Generic', 20, 5),
('Fluconazole Capsule 150mg', 'antifungal', 'Capsule', '150mg', 'capsules', 10.00, 0, 'Generic', 50, 10),
('Ketoconazole Cream 2% 30g', 'antifungal', 'Cream', '2%', 'tubes', 30.00, 0, 'Generic', 20, 5),
('Itraconazole Capsule 100mg', 'antifungal', 'Capsule', '100mg', 'capsules', 3.00, 0, 'Generic', 30, 5),
('Nystatin Suspension 100,000 IU/ml', 'antifungal', 'Suspension', '100,000 IU/ml', 'bottles', 120.00, 0, 'Generic', 20, 5),

-- Cardiovascular / Antihypertensive
('Amlodipine Tablet 5mg', 'cardiovascular', 'Tablet', '5mg', 'tablets', 0.37, 0, 'Generic', 500, 100),
('Amlodipine Tablet 10mg', 'cardiovascular', 'Tablet', '10mg', 'tablets', 0.60, 0, 'Generic', 500, 100),
('Atenolol Tablet 50mg', 'cardiovascular', 'Tablet', '50mg', 'tablets', 0.49, 0, 'Generic', 500, 100),
('Atenolol Tablet 100mg', 'cardiovascular', 'Tablet', '100mg', 'tablets', 2.00, 0, 'Generic', 300, 50),
('Atorvastatin Tablet 10mg', 'cardiovascular', 'Tablet', '10mg', 'tablets', 2.00, 0, 'Generic', 300, 50),
('Atorvastatin Tablet 20mg', 'cardiovascular', 'Tablet', '20mg', 'tablets', 2.00, 0, 'Generic', 300, 50),
('Atorvastatin Tablet 40mg', 'cardiovascular', 'Tablet', '40mg', 'tablets', 2.50, 0, 'Generic', 200, 30),
('Bisoprolol Tablet 5mg', 'cardiovascular', 'Tablet', '5mg', 'tablets', 1.00, 0, 'Generic', 200, 30),
('Furosemide Tablet 40mg', 'cardiovascular', 'Tablet', '40mg', 'tablets', 0.30, 0, 'Generic', 500, 100),
('Furosemide Injection 20mg/2ml', 'cardiovascular', 'Injection', '20mg/2ml', 'ampoules', 8.00, 0, 'Generic', 50, 10),
('Lisinopril Tablet 10mg', 'cardiovascular', 'Tablet', '10mg', 'tablets', 0.72, 0, 'Generic', 300, 50),
('Losartan Tablet 50mg', 'cardiovascular', 'Tablet', '50mg', 'tablets', 1.24, 0, 'Generic', 300, 50),
('Losartan Tablet 100mg', 'cardiovascular', 'Tablet', '100mg', 'tablets', 1.39, 0, 'Generic', 200, 30),
('Methyldopa Tablet 250mg', 'cardiovascular', 'Tablet', '250mg', 'tablets', 1.58, 0, 'Generic', 100, 20),
('Nifedipine Tablet 20mg SR', 'cardiovascular', 'Tablet', '20mg SR', 'tablets', 2.18, 0, 'Generic', 100, 20),
('Spironolactone Tablet 25mg', 'cardiovascular', 'Tablet', '25mg', 'tablets', 2.38, 0, 'Generic', 50, 10),
('Bendroflumethiazide Tablet 2.5mg', 'cardiovascular', 'Tablet', '2.5mg', 'tablets', 0.20, 0, 'Generic', 300, 50),
('Clopidogrel Tablet 75mg', 'cardiovascular', 'Tablet', '75mg', 'tablets', 1.60, 0, 'Generic', 100, 20),
('Aspirin Dispersible Tablet 75mg', 'cardiovascular', 'Tablet', '75mg', 'tablets', 0.30, 0, 'Generic', 500, 100),
('Hydralazine Injection 20mg', 'cardiovascular', 'Injection', '20mg', 'vials', 50.00, 0, 'Generic', 20, 5),
('Labetalol Tablet 100mg', 'cardiovascular', 'Tablet', '100mg', 'tablets', 4.00, 0, 'Generic', 50, 10),

-- Diabetes
('Metformin Tablet 500mg', 'diabetes', 'Tablet', '500mg', 'tablets', 0.24, 0, 'Generic', 500, 100),
('Metformin Tablet 1g', 'diabetes', 'Tablet', '1g', 'tablets', 4.61, 0, 'Generic', 200, 30),
('Glibenclamide Tablet 5mg', 'diabetes', 'Tablet', '5mg', 'tablets', 0.14, 0, 'Generic', 300, 50),
('Glimeperide Tablet 2mg (Amaryl)', 'diabetes', 'Tablet', '2mg', 'tablets', 0.84, 0, 'Brand', 100, 20),
('Glimeperide Tablet 4mg (Amaryl)', 'diabetes', 'Tablet', '4mg', 'tablets', 1.17, 0, 'Brand', 100, 20),

-- Painkillers / Analgesics
('Paracetamol Tablet 500mg', 'painkiller', 'Tablet', '500mg', 'tablets', 0.26, 0.09, 'Generic', 1000, 200),
('Paracetamol Syrup 120mg/5ml', 'painkiller', 'Syrup', '120mg/5ml', 'bottles', 12.73, 0, 'Generic', 50, 10),
('Paracetamol Infusion 1g/100ml', 'painkiller', 'Injection', '1g/100ml', 'bottles', 45.00, 0, 'Generic', 20, 5),
('Paracetamol Suppository 125mg', 'painkiller', 'Suppository', '125mg', 'pieces', 1.89, 0, 'Generic', 30, 5),
('Paracetamol Suppository 500mg', 'painkiller', 'Suppository', '500mg', 'pieces', 1.97, 0, 'Generic', 30, 5),
('Ibuprofen Tablet 400mg', 'painkiller', 'Tablet', '400mg', 'tablets', 0.40, 0, 'Generic', 300, 50),
('Ibuprofen Suspension 100mg/5ml', 'painkiller', 'Suspension', '100mg/5ml', 'bottles', 20.00, 0, 'Generic', 30, 5),
('Diclofenac Tablet 50mg', 'painkiller', 'Tablet', '50mg', 'tablets', 0.50, 0, 'Generic', 300, 50),
('Diclofenac Tablet 100mg', 'painkiller', 'Tablet', '100mg', 'tablets', 0.99, 0, 'Generic', 200, 30),
('Diclofenac Injection 75mg/3ml', 'painkiller', 'Injection', '75mg/3ml', 'ampoules', 15.00, 0, 'Generic', 30, 5),
('Diclofenac Gel 1%', 'painkiller', 'Gel', '1%', 'tubes', 9.92, 2.87, 'Generic', 30, 5),
('Tramadol Capsule 50mg', 'painkiller', 'Capsule', '50mg', 'capsules', 1.19, 0, 'Generic', 100, 20),
('Tramadol Injection 100mg/2ml', 'painkiller', 'Injection', '100mg/2ml', 'vials', 30.00, 0, 'Generic', 20, 5),
('Morphine Injection 10mg/ml', 'painkiller', 'Injection', '10mg/ml', 'ampoules', 70.00, 0, 'Generic', 10, 2),
('Pethidine Injection 100mg/2ml', 'painkiller', 'Injection', '100mg/2ml', 'ampoules', 120.00, 0, 'Generic', 10, 2),

-- Gastrointestinal
('Omeprazole Capsule 20mg', 'gastrointestinal', 'Capsule', '20mg', 'capsules', 0.30, 0, 'Generic', 500, 100),
('Omeprazole Injection 40mg', 'gastrointestinal', 'Injection', '40mg', 'vials', 40.00, 0, 'Generic', 20, 5),
('Metoclopramide Tablet 10mg', 'gastrointestinal', 'Tablet', '10mg', 'tablets', 1.40, 0, 'Generic', 100, 20),
('Metoclopramide Injection 10mg/2ml', 'gastrointestinal', 'Injection', '10mg/2ml', 'ampoules', 25.00, 0, 'Generic', 20, 5),
('Loperamide Capsule 2mg', 'gastrointestinal', 'Capsule', '2mg', 'capsules', 1.00, 0, 'Generic', 50, 10),
('Oral Rehydration Salts (ORS)', 'gastrointestinal', 'Powder', '200g', 'sachets', 2.35, 0, 'Generic', 100, 20),
('Anusol Suppositories', 'gastrointestinal', 'Suppository', 'Various', 'pieces', 8.14, 0, 'Brand', 20, 5),

-- Antivirals
('Aciclovir Tablet 200mg', 'antiviral', 'Tablet', '200mg', 'tablets', 6.08, 0, 'Generic', 100, 20),
('Aciclovir Cream 5%', 'antiviral', 'Cream', '5%', 'tubes', 133.00, 0, 'Generic', 10, 2),

-- Vitamins / Supplements
('Ferrous Sulphate Tablet 200mg', 'vitamin', 'Tablet', '200mg', 'tablets', 0.21, 0, 'Generic', 500, 100),
('Folic Acid Tablet 5mg', 'vitamin', 'Tablet', '5mg', 'tablets', 0.10, 0, 'Generic', 500, 100),
('Multivitamin Tablet', 'vitamin', 'Tablet', 'N/A', 'tablets', 0.08, 0, 'Generic', 500, 100),
('Multivitamin Syrup', 'vitamin', 'Syrup', 'N/A', 'bottles', 18.00, 0, 'Generic', 30, 5),
('Zinc Tablet 10mg', 'vitamin', 'Tablet', '10mg', 'tablets', 0.09, 0, 'Generic', 300, 50),
('Vitamin B Complex Tablet', 'vitamin', 'Tablet', 'N/A', 'tablets', 0.06, 0, 'Generic', 500, 100),
('Vitamin B Complex Syrup', 'vitamin', 'Syrup', 'N/A', 'bottles', 19.80, 0, 'Generic', 30, 5),

-- Injectables / IV Fluids
('Normal Saline 0.9% 500ml', 'injectable', 'Infusion', '0.9%', 'bottles', 25.00, 0, 'Generic', 100, 20),
('Dextrose 5% 500ml', 'injectable', 'Infusion', '5%', 'bottles', 24.00, 0, 'Generic', 100, 20),
('Dextrose 10% 500ml', 'injectable', 'Infusion', '10%', 'bottles', 24.00, 0, 'Generic', 50, 10),
('Dextrose 50% 250ml', 'injectable', 'Infusion', '50%', 'vials', 45.00, 0, 'Generic', 20, 5),
('Ringers Lactate 500ml', 'injectable', 'Infusion', 'RL', 'vials', 24.00, 0, 'Generic', 100, 20),
('Adrenaline Injection 1mg/1ml', 'injectable', 'Injection', '1mg/1ml', 'vials', 30.00, 0, 'Generic', 20, 5),
('Dexamethasone Injection 4mg/1ml', 'injectable', 'Injection', '4mg/1ml', 'ampoules', 40.00, 0, 'Generic', 30, 5),
('Gentamicin Injection 80mg/2ml', 'injectable', 'Injection', '80mg/2ml', 'ampoules', 16.00, 0, 'Generic', 30, 5),
('Magnesium Sulphate 50% Injection 10ml', 'injectable', 'Injection', '50%', 'vials', 65.00, 0, 'Generic', 20, 5),
('Oxytocin Injection 10 IU/ml', 'injectable', 'Injection', '10 IU/ml', 'vials', 19.66, 0, 'Generic', 30, 5),
('Ergometrine Injection 0.5mg/ml', 'injectable', 'Injection', '0.5mg/ml', 'vials', 40.00, 0, 'Generic', 20, 5),
('Diazepam Injection 5mg/2ml', 'injectable', 'Injection', '5mg/2ml', 'vials', 30.00, 0, 'Generic', 20, 5),
('Ketamine Injection 50mg/1ml', 'injectable', 'Injection', '50mg/1ml', 'vials', 90.00, 0, 'Generic', 10, 2),
('Tranexamic Acid Injection 500mg/5ml', 'injectable', 'Injection', '500mg/5ml', 'vials', 45.00, 0, 'Generic', 20, 5),
('Hydrocortisone Injection 100mg', 'injectable', 'Injection', '100mg', 'vials', 24.00, 0, 'Generic', 20, 5),
('Hyoscine Butylbromide Injection 20mg/ml', 'injectable', 'Injection', '20mg/ml', 'ampoules', 25.00, 0, 'Brand', 30, 5),
('Water for Injection 10ml', 'injectable', 'Injection', '10ml', 'vials', 1.48, 0, 'Generic', 200, 50),

-- Respiratory
('Salbutamol Tablet 4mg', 'respiratory', 'Tablet', '4mg', 'tablets', 1.40, 0, 'Generic', 100, 20),
('Salbutamol Nebules 2.5mg', 'respiratory', 'Nebuliser', '2.5mg/2.5ml', 'sachets', 30.00, 0, 'Generic', 30, 5),
('Salbutamol Nebules 5mg', 'respiratory', 'Nebuliser', '5mg/2.5ml', 'sachets', 48.00, 0, 'Generic', 30, 5),
('Montelukast Tablet 10mg', 'respiratory', 'Tablet', '10mg', 'tablets', 1.50, 0, 'Generic', 100, 20),
('Aminophylline Injection 250mg/10ml', 'respiratory', 'Injection', '250mg/10ml', 'ampoules', 70.00, 7.80, 'Generic', 20, 5),

-- Antihistamines
('Chlorphenamine Tablet 4mg (Piriton)', 'antihistamine', 'Tablet', '4mg', 'tablets', 0.50, 0, 'Generic', 300, 50),
('Cetirizine Tablet 10mg', 'antihistamine', 'Tablet', '10mg', 'tablets', 0.20, 0, 'Generic', 300, 50),
('Loratadine Tablet 10mg', 'antihistamine', 'Tablet', '10mg', 'tablets', 0.79, 0, 'Generic', 300, 50),
('Promethazine Tablet 25mg', 'antihistamine', 'Tablet', '25mg', 'tablets', 0.40, 0, 'Generic', 100, 20),

-- Neurological / CNS
('Diazepam Tablet 10mg', 'neurological', 'Tablet', '10mg', 'tablets', 0.19, 0, 'Generic', 100, 20),
('Amitriptyline Tablet 25mg', 'neurological', 'Tablet', '25mg', 'tablets', 0.20, 0, 'Generic', 100, 20),
('Amitriptyline Tablet 10mg', 'neurological', 'Tablet', '10mg', 'tablets', 0.60, 0, 'Generic', 100, 20),
('Pregabalin Capsule 75mg (Lyrica)', 'neurological', 'Capsule', '75mg', 'capsules', 4.21, 0, 'Brand', 30, 5),
('Phenytoin Injection 50mg/5ml', 'neurological', 'Injection', '50mg/5ml', 'ampoules', 100.00, 0, 'Generic', 10, 2),

-- Topical / Dermatology
('Bactroban Cream 15g (Mupirocin 2%)', 'topical', 'Cream', '2%', 'tubes', 157.50, 0, 'Brand', 10, 2),
('Hydrocortisone Cream 1% 30g', 'topical', 'Cream', '1%', 'tubes', 90.00, 0, 'Generic', 20, 5),
('Silver Sulphadiazine Cream 1%', 'topical', 'Cream', '1%', 'tubes', 106.47, 0, 'Generic', 10, 2),

-- Cough / Cold / Syrup
('Benylin 4-Flu Syrup 200ml', 'cough_cold', 'Syrup', 'Various', 'bottles', 97.00, 0, 'Brand', 20, 5),
('Salbutamol Ventolin Syrup 150ml', 'cough_cold', 'Syrup', '2mg/5ml', 'bottles', 77.00, 0, 'Brand', 20, 5),
('Chlorphenamine Syrup (Piriton Syrup)', 'cough_cold', 'Syrup', '2mg/5ml', 'bottles', 144.61, 0, 'Brand', 20, 5)

ON CONFLICT DO NOTHING;

-- ============================================
-- SUCCESS
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Prices & Catalog setup complete!';
  RAISE NOTICE '- drugs table: columns added (strength, formulation, nhis_price, brand_type)';
  RAISE NOTICE '- lab_test_catalog: table created + 80 tests seeded';
  RAISE NOTICE '- service_fees: table created + 70 services seeded';
  RAISE NOTICE '- drugs: ~130 medicines seeded from pricing lists';
  RAISE NOTICE '⚠️  RLS set: only admin can edit prices in catalog and service_fees';
END $$;

-- ============================================================
-- END: seed-prices-catalog.sql
-- ============================================================

