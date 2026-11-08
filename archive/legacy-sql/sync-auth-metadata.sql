-- ============================================
-- CareLink HMS - Sync Auth Profile Metadata
-- Mirrors public.users details into auth.users
-- Author: David Gabion Selorm
-- Date: April 3, 2026
-- ============================================
--
-- PURPOSE:
-- - Updates the Supabase Auth dashboard display values
-- - Keeps auth.users profile metadata aligned with public.users
-- - Does not change passwords or authentication settings
--
-- RUN AFTER:
-- 1. database-setup.sql
-- 2. setup-users.sql
-- 3. Any in-app user creation or user profile updates you want reflected in Auth
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
WHERE LOWER(au.email) = LOWER(u.email);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT
  au.email,
  au.phone,
  au.raw_user_meta_data ->> 'full_name' AS full_name,
  au.raw_user_meta_data ->> 'role' AS role,
  au.raw_user_meta_data ->> 'specialty' AS specialty
FROM auth.users AS au
WHERE LOWER(au.email) IN (
  'owner.carelink@gmail.com',
  'doctor@carelink.com',
  'pharmacist@carelink.com',
  'nurse@carelink.com',
  'cashier@carelink.com',
  'records@carelink.com'
)
ORDER BY au.email;

-- ============================================
-- EXPECTED RESULT
-- ============================================
--
-- The Auth dashboard should now show:
-- - phone in the auth.users phone column
-- - full_name in raw_user_meta_data
-- - role in raw_user_meta_data
-- - specialty in raw_user_meta_data where applicable
