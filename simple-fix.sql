-- ============================================
-- SIMPLEST POSSIBLE FIX
-- Run this in Supabase SQL Editor
-- Author: David Gabion Selorm  
-- ============================================

-- Remove the phone number from ALL users first
UPDATE public.users SET phone = NULL;

-- Drop the constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key CASCADE;

-- Now set the owner phone
UPDATE public.users
SET 
  phone = '+233247654381',
  role = 'admin',
  full_name = 'David Gabion Selorm',
  specialty = NULL,
  updated_at = NOW()
WHERE LOWER(email) = 'owner.carelink@gmail.com';

-- Update auth
UPDATE auth.users
SET
  phone = '+233247654381',
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    '{"full_name": "David Gabion Selorm", "phone": "+233247654381", "role": "admin"}'::jsonb
WHERE LOWER(email) = 'owner.carelink@gmail.com';

-- Verify
SELECT 'SUCCESS!' AS status, email, role, full_name, phone
FROM public.users
WHERE LOWER(email) = 'owner.carelink@gmail.com';
