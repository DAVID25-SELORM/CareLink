-- ============================================
-- CareLink HMS - Owner and Test Users Setup
-- Syncs public.users with Supabase auth.users
-- Author: David Gabion Selorm
-- Date: April 3, 2026
-- ============================================
--
-- IMPORTANT:
-- 1. Create these accounts first in Supabase Authentication -> Users.
-- 2. Run this script after database-setup.sql.
-- 3. Run this before entering real operational data.
--    It updates public.users.id to match auth.users.id.
-- 4. The first row is your real owner/admin account.
--    If your actual owner email is different, edit that row first.
-- 5. All remaining rows are demo/test role accounts for system checks.
--
-- OWNER ACCOUNT:
-- - owner.carelink@gmail.com
--
-- TEST ACCOUNTS:
-- - doctor@carelink.com
-- - pharmacist@carelink.com
-- - nurse@carelink.com
-- - cashier@carelink.com
-- - records@carelink.com
-- ============================================

DO $$
DECLARE
  desired_user RECORD;
  auth_user_id UUID;
  auth_user_email TEXT;
  existing_user_id UUID;
  existing_user_email TEXT;
  temp_email TEXT;
BEGIN
  FOR desired_user IN
    SELECT *
    FROM (
      VALUES
        ('owner.carelink@gmail.com', 'admin', NULL, 'David Gabion Selorm', '+233247654381'),
        ('doctor@carelink.com', 'doctor', 'General Practitioner', 'Test Doctor Account', '+233240000001'),
        ('pharmacist@carelink.com', 'pharmacist', NULL, 'Test Pharmacist Account', '+233240000002'),
        ('nurse@carelink.com', 'nurse', 'General Nurse', 'Test Nurse Account', '+233240000003'),
        ('cashier@carelink.com', 'cashier', NULL, 'Test Cashier Account', '+233240000004'),
        ('records@carelink.com', 'records_officer', NULL, 'Test Records Officer Account', '+233240000005')
    ) AS seed(email, role, specialty, full_name, phone)
  LOOP
    auth_user_id := NULL;
    auth_user_email := NULL;
    existing_user_id := NULL;
    existing_user_email := NULL;

    SELECT au.id, au.email
    INTO auth_user_id, auth_user_email
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(desired_user.email)
    LIMIT 1;

    IF auth_user_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT u.id, u.email
    INTO existing_user_id, existing_user_email
    FROM public.users u
    WHERE LOWER(u.email) = LOWER(desired_user.email)
    LIMIT 1;

    IF existing_user_id IS NULL THEN
      INSERT INTO public.users (id, email, role, specialty, full_name, phone)
      VALUES (
        auth_user_id,
        auth_user_email,
        desired_user.role,
        desired_user.specialty,
        desired_user.full_name,
        desired_user.phone
      )
      ON CONFLICT (id) DO UPDATE
      SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        specialty = EXCLUDED.specialty,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        updated_at = NOW();

    ELSIF existing_user_id = auth_user_id THEN
      UPDATE public.users
      SET
        role = desired_user.role,
        specialty = desired_user.specialty,
        full_name = desired_user.full_name,
        phone = desired_user.phone,
        updated_at = NOW()
      WHERE id = existing_user_id;

    ELSE
      temp_email := existing_user_email || '.legacy-' || LEFT(existing_user_id::TEXT, 8);

      UPDATE public.users
      SET email = temp_email,
          updated_at = NOW()
      WHERE id = existing_user_id;

      INSERT INTO public.users (id, email, role, specialty, full_name, phone)
      VALUES (
        auth_user_id,
        auth_user_email,
        desired_user.role,
        desired_user.specialty,
        desired_user.full_name,
        desired_user.phone
      )
      ON CONFLICT (id) DO UPDATE
      SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        specialty = EXCLUDED.specialty,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        updated_at = NOW();

      UPDATE public.prescriptions
      SET doctor_id = auth_user_id
      WHERE doctor_id = existing_user_id;

      UPDATE public.appointments
      SET doctor_id = auth_user_id
      WHERE doctor_id = existing_user_id;

      UPDATE public.lab_tests
      SET requested_by = auth_user_id
      WHERE requested_by = existing_user_id;

      UPDATE public.audit_log
      SET user_id = auth_user_id
      WHERE user_id = existing_user_id;

      IF to_regclass('public.patient_vitals') IS NOT NULL THEN
        EXECUTE 'UPDATE public.patient_vitals SET nurse_id = $1 WHERE nurse_id = $2'
        USING auth_user_id, existing_user_id;
      END IF;

      IF to_regclass('public.nurse_notes') IS NOT NULL THEN
        EXECUTE 'UPDATE public.nurse_notes SET nurse_id = $1 WHERE nurse_id = $2'
        USING auth_user_id, existing_user_id;
      END IF;

      IF to_regclass('public.nurse_tasks') IS NOT NULL THEN
        EXECUTE 'UPDATE public.nurse_tasks SET nurse_id = $1 WHERE nurse_id = $2'
        USING auth_user_id, existing_user_id;
      END IF;

      IF to_regclass('public.shift_handovers') IS NOT NULL THEN
        EXECUTE 'UPDATE public.shift_handovers SET nurse_id = $1 WHERE nurse_id = $2'
        USING auth_user_id, existing_user_id;
      END IF;

      IF to_regclass('public.medical_records') IS NOT NULL THEN
        EXECUTE 'UPDATE public.medical_records SET officer_id = $1 WHERE officer_id = $2'
        USING auth_user_id, existing_user_id;
        EXECUTE 'UPDATE public.medical_records SET archived_by = $1 WHERE archived_by = $2'
        USING auth_user_id, existing_user_id;
        EXECUTE 'UPDATE public.medical_records SET restored_by = $1 WHERE restored_by = $2'
        USING auth_user_id, existing_user_id;
      END IF;

      IF to_regclass('public.record_requests') IS NOT NULL THEN
        EXECUTE 'UPDATE public.record_requests SET processed_by = $1 WHERE processed_by = $2'
        USING auth_user_id, existing_user_id;
      END IF;

      IF to_regclass('public.referrals') IS NOT NULL THEN
        EXECUTE 'UPDATE public.referrals SET referring_doctor_id = $1 WHERE referring_doctor_id = $2'
        USING auth_user_id, existing_user_id;
        EXECUTE 'UPDATE public.referrals SET referred_to_doctor_id = $1 WHERE referred_to_doctor_id = $2'
        USING auth_user_id, existing_user_id;
      END IF;

      DELETE FROM public.users
      WHERE id = existing_user_id;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- VERIFICATION 1: AUTH USERS STILL MISSING
-- ============================================

WITH desired_users AS (
  SELECT *
  FROM (
    VALUES
      ('owner.carelink@gmail.com', 'admin'),
      ('doctor@carelink.com', 'doctor'),
      ('pharmacist@carelink.com', 'pharmacist'),
      ('nurse@carelink.com', 'nurse'),
      ('cashier@carelink.com', 'cashier'),
      ('records@carelink.com', 'records_officer')
  ) AS seed(email, role)
)
SELECT
  du.email,
  du.role,
  'Create this account in Supabase Auth before rerunning setup-users.sql' AS action_needed
FROM desired_users du
LEFT JOIN auth.users au
  ON LOWER(au.email) = LOWER(du.email)
WHERE au.id IS NULL
ORDER BY du.email;

-- ============================================
-- VERIFICATION 2: PUBLIC USERS SYNC STATUS
-- ============================================

SELECT
  u.email,
  u.id,
  au.id AS auth_user_id,
  (u.id = au.id) AS ids_match,
  u.role,
  u.specialty,
  u.full_name,
  u.phone,
  u.created_at,
  u.updated_at
FROM public.users u
LEFT JOIN auth.users au
  ON LOWER(u.email) = LOWER(au.email)
WHERE LOWER(u.email) IN (
  'owner.carelink@gmail.com',
  'doctor@carelink.com',
  'pharmacist@carelink.com',
  'nurse@carelink.com',
  'cashier@carelink.com',
  'records@carelink.com'
)
ORDER BY
  CASE u.role
    WHEN 'admin' THEN 1
    WHEN 'doctor' THEN 2
    WHEN 'pharmacist' THEN 3
    WHEN 'nurse' THEN 4
    WHEN 'cashier' THEN 5
    WHEN 'records_officer' THEN 6
    ELSE 7
  END;

-- ============================================
-- EXPECTED RESULT
-- ============================================
--
-- ids_match should be TRUE for the owner account and any test accounts you created.
-- If a row is missing from auth.users, create that Auth user first and rerun.
