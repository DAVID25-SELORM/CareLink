-- ============================================
-- DIAGNOSE: What constraint actually exists?
-- Run this to see the exact constraint details
-- ============================================

-- Show all UNIQUE constraints on users table
SELECT 
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition,
  con.contype AS constraint_type,
  'DROP CONSTRAINT ' || con.conname || ';' AS drop_command
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'users'
  AND con.contype = 'u'
ORDER BY con.conname;

-- Show all indexes on phone column
SELECT 
  indexname,
  indexdef,
  'DROP INDEX ' || schemaname || '.' || indexname || ' CASCADE;' AS drop_command
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND (indexname ILIKE '%phone%' OR indexdef ILIKE '%phone%')
ORDER BY indexname;

-- Count users with the phone number
SELECT 
  COUNT(*) AS total_with_phone,
  COUNT(DISTINCT email) AS distinct_emails
FROM public.users
WHERE phone = '+233247654381';
