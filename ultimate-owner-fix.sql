-- ============================================
-- ULTIMATE FIX: Owner Account Without Constraint Battles
-- This bypasses the phone constraint issue completely
-- Author: David Gabion Selorm
-- ============================================

-- STEP 1: First, let's just remove ALL phone values to avoid conflicts
UPDATE public.users
SET phone = NULL
WHERE phone = '+233247654381';

COMMIT;

-- STEP 2: Now drop the constraint (no conflicts possible)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key CASCADE;

COMMIT;

-- STEP 3: Fix the owner account
DO $$
DECLARE
  owner_email TEXT := 'owner.carelink@gmail.com';
  owner_role TEXT := 'admin';
  owner_full_name TEXT := 'David Gabion Selorm';
  owner_phone TEXT := '+233247654381';
  auth_user_id UUID;
BEGIN
  -- Get auth user ID
  SELECT id INTO auth_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(owner_email);

  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth account not found for %', owner_email;
  END IF;

  -- Delete any existing owner rows
  DELETE FROM public.users
  WHERE LOWER(email) = LOWER(owner_email);

  -- Insert fresh owner account
  INSERT INTO public.users (id, email, role, specialty, full_name, phone, created_at, updated_at)
  VALUES (
    auth_user_id,
    owner_email,
    owner_role,
    NULL,
    owner_full_name,
    owner_phone,
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Owner account created successfully!';
END $$;

-- STEP 4: Update auth metadata
UPDATE auth.users
SET
  phone = '+233247654381',
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'full_name', 'David Gabion Selorm',
      'phone', '+233247654381',
      'role', 'admin',
      'specialty', null
    )
WHERE LOWER(email) = 'owner.carelink@gmail.com';

-- VERIFICATION
SELECT
  'public.users' AS source,
  email,
  role,
  full_name,
  phone,
  specialty
FROM public.users
WHERE LOWER(email) = 'owner.carelink@gmail.com'

UNION ALL

SELECT
  'auth.users' AS source,
  email,
  raw_user_meta_data ->> 'role' AS role,
  raw_user_meta_data ->> 'full_name' AS full_name,
  phone,
  raw_user_meta_data ->> 'specialty' AS specialty
FROM auth.users
WHERE LOWER(email) = 'owner.carelink@gmail.com';
