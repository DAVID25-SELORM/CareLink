-- ============================================
-- CareLink HMS - Fix Owner Account
-- Repairs the owner row in public.users and syncs auth metadata
-- Author: David Gabion Selorm
-- Date: April 3, 2026
-- ============================================
--
-- USE THIS WHEN:
-- - owner.carelink@gmail.com exists in auth.users
-- - but public.users has missing name/phone/role data
-- - or the owner row exists with the wrong id
--
-- RESULT:
-- - public.users owner row is repaired
-- - foreign key references are migrated if needed
-- - auth.users metadata is updated for dashboard display
-- ============================================

-- ============================================
-- STEP 1: Remove phone UNIQUE constraint
-- Phone numbers should not be unique (staff can share phones)
-- These must run OUTSIDE of transactions to take effect immediately
-- ============================================

-- Drop the constraint directly (most important step)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key CASCADE;

-- Drop any unique indexes on phone
DROP INDEX IF EXISTS public.users_phone_key;
DROP INDEX IF EXISTS public.idx_users_phone_unique;

-- Create a regular (non-unique) index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone) WHERE phone IS NOT NULL;

-- ============================================
-- STEP 2: Verify constraint is gone before proceeding
-- ============================================

DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO constraint_count
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'users'
    AND con.contype = 'u'
    AND (
      pg_get_constraintdef(con.oid) ILIKE '%phone%'
      OR con.conname ILIKE '%phone%'
    );
  
  IF constraint_count > 0 THEN
    RAISE EXCEPTION 'Phone UNIQUE constraint still exists! Cannot proceed.';
  ELSE
    RAISE NOTICE 'Phone constraint successfully removed. Proceeding...';
  END IF;
END $$;

-- ============================================
-- STEP 3: Fix owner account
-- ============================================

DO $$
DECLARE
  owner_email TEXT := 'owner.carelink@gmail.com';
  owner_role TEXT := 'admin';
  owner_full_name TEXT := 'David Gabion Selorm';
  owner_phone TEXT := '+233247654381';
  auth_user_id UUID;
  auth_user_email TEXT;
  existing_user_id UUID;
  existing_user_email TEXT;
  temp_email TEXT;
BEGIN
  SELECT au.id, au.email
  INTO auth_user_id, auth_user_email
  FROM auth.users au
  WHERE LOWER(au.email) = LOWER(owner_email)
  LIMIT 1;

  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Owner auth account % was not found in auth.users', owner_email;
  END IF;

  SELECT u.id, u.email
  INTO existing_user_id, existing_user_email
  FROM public.users u
  WHERE LOWER(u.email) = LOWER(owner_email)
  LIMIT 1;

  IF existing_user_id IS NULL THEN
    INSERT INTO public.users (id, email, role, specialty, full_name, phone)
    VALUES (
      auth_user_id,
      auth_user_email,
      owner_role,
      NULL,
      owner_full_name,
      owner_phone
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
      role = owner_role,
      specialty = NULL,
      full_name = owner_full_name,
      phone = owner_phone,
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
      owner_role,
      NULL,
      owner_full_name,
      owner_phone
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
END $$;

-- ============================================
-- STEP 4: Update auth.users metadata
-- ============================================

UPDATE auth.users AS au
SET
  phone = COALESCE(u.phone, au.phone),
  raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb) ||
    jsonb_strip_nulls(
      jsonb_build_object(
        'full_name', u.full_name,
        'phone', u.phone,
        'role', u.role,
        'specialty', u.specialty
      )
    )
FROM public.users AS u
WHERE LOWER(au.email) = LOWER(u.email)
  AND LOWER(au.email) = 'owner.carelink@gmail.com';

-- ============================================
-- VERIFICATION
-- ============================================

SELECT
  'public.users' AS source,
  u.email,
  u.role,
  u.full_name,
  u.phone,
  u.specialty
FROM public.users u
WHERE LOWER(u.email) = 'owner.carelink@gmail.com'

UNION ALL

SELECT
  'auth.users' AS source,
  au.email,
  au.raw_user_meta_data ->> 'role' AS role,
  au.raw_user_meta_data ->> 'full_name' AS full_name,
  au.phone,
  au.raw_user_meta_data ->> 'specialty' AS specialty
FROM auth.users au
WHERE LOWER(au.email) = 'owner.carelink@gmail.com';
