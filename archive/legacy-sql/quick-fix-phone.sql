-- ============================================
-- QUICK FIX: Remove Phone Constraint ONLY
-- Run this FIRST before any other scripts
-- Author: David Gabion Selorm
-- ============================================

-- Step 1: Drop the constraint (CASCADE removes all dependencies)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key CASCADE;

-- Step 2: Drop any unique indexes
DROP INDEX IF EXISTS public.users_phone_key CASCADE;
DROP INDEX IF EXISTS public.idx_users_phone_unique CASCADE;

-- Step 3: Find and fix any duplicate phone issues
-- Set phone to NULL for any legacy/old duplicate rows
UPDATE public.users
SET phone = NULL
WHERE phone = '+233247654381'
  AND email != 'owner.carelink@gmail.com';

-- Step 4: Create regular index (not unique)
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone) WHERE phone IS NOT NULL;

-- Verification
SELECT 
  'Constraint Check' AS check_type,
  COUNT(*) AS count,
  CASE WHEN COUNT(*) = 0 THEN '✅ No phone constraints' ELSE '❌ Constraint still exists' END AS status
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'users'
  AND con.contype = 'u'
  AND (con.conname ILIKE '%phone%' OR pg_get_constraintdef(con.oid) ILIKE '%phone%')

UNION ALL

SELECT 
  'Duplicate Phone Check' AS check_type,
  COUNT(*) AS count,
  CASE WHEN COUNT(*) = 0 THEN '✅ No duplicates' ELSE '❌ Duplicates found' END AS status
FROM (
  SELECT phone, COUNT(*) as cnt
  FROM public.users
  WHERE phone = '+233247654381'
  GROUP BY phone
  HAVING COUNT(*) > 1
) AS dupes;
