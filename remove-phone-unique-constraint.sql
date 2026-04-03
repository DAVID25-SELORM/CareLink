-- ============================================
-- CareLink HMS - Remove Phone UNIQUE Constraint
-- Phone numbers should NOT be unique in the users table
-- Multiple staff members may share a phone number
-- Author: David Gabion Selorm
-- Date: April 3, 2026
-- ============================================
--
-- WHY THIS IS NEEDED:
-- - Phone numbers can be shared (department phones, mobile phones)
-- - The UNIQUE constraint causes errors when multiple users have the same phone
-- - Email is the unique identifier, not phone
--
-- RUN THIS ONCE to permanently fix the issue
-- ============================================

-- Drop the phone UNIQUE constraint directly (most critical step)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key CASCADE;

-- Drop any unique indexes that might exist
DROP INDEX IF EXISTS public.users_phone_key;
DROP INDEX IF EXISTS public.idx_users_phone_unique;

-- Scan and drop any other unique indexes on phone column
DO $$
DECLARE
  phone_index RECORD;
BEGIN
  FOR phone_index IN
    SELECT idx.indexname
    FROM pg_indexes idx
    WHERE idx.schemaname = 'public'
      AND idx.tablename = 'users'
      AND idx.indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND (
        idx.indexdef ILIKE '%phone%'
        OR idx.indexname ILIKE '%phone%'
      )
  LOOP
    RAISE NOTICE 'Dropping unique index: %', phone_index.indexname;
    EXECUTE format('DROP INDEX IF EXISTS public.%I CASCADE', phone_index.indexname);
  END LOOP;
END $$;

-- Create a regular (non-unique) index for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone) WHERE phone IS NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check if phone constraint still exists (should return 0 rows)
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
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

-- Check phone indexes (should only show the non-unique index)
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND (indexname ILIKE '%phone%' OR indexdef ILIKE '%phone%')
ORDER BY indexname;

-- ============================================
-- EXPECTED RESULT
-- ============================================
-- First query should return 0 rows (no UNIQUE constraint on phone)
-- Second query should show only idx_users_phone with a regular index
