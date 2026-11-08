-- ============================================
-- NUCLEAR OPTION: Force Remove ALL Phone Constraints
-- This will work regardless of constraint name
-- Author: David Gabion Selorm
-- ============================================

-- Find and drop ALL unique constraints that involve the phone column
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Loop through all unique constraints on users table
  FOR r IN 
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'u'
  LOOP
    -- Check if this constraint includes the phone column
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.conname = r.conname
        AND a.attname = 'phone'
    ) THEN
      RAISE NOTICE 'Dropping constraint: %', r.conname;
      EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I CASCADE', r.conname);
    END IF;
  END LOOP;
END $$;

-- Drop all unique indexes on phone
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%phone%'
  LOOP
    RAISE NOTICE 'Dropping index: %', r.indexname;
    EXECUTE format('DROP INDEX IF EXISTS public.%I CASCADE', r.indexname);
  END LOOP;
END $$;

-- Verification: Check if any phone constraints remain
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ SUCCESS: All phone constraints removed!'
    ELSE '❌ FAILED: ' || COUNT(*)::TEXT || ' constraint(s) still exist'
  END AS result
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.conrelid = 'public.users'::regclass
  AND c.contype = 'u'
  AND a.attname = 'phone';

-- Show what constraints DO exist on users table now
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
ORDER BY conname;
