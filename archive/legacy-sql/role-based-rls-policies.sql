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
