-- Read-only. One row per object with a hash of its definition, so two databases can be diffed by name.
-- Run on the live project (SQL editor) and on the fixture (see drift-compare.mjs), then compare.
SELECT category, name, md5(def) AS hash FROM (
  SELECT 'policy' AS category, schemaname||'.'||tablename||'.'||policyname AS name,
         concat_ws('|', cmd, permissive, array_to_string(roles,','), qual, with_check) AS def
    FROM pg_policies WHERE schemaname = 'public'
  UNION ALL
  SELECT 'function', p.oid::regprocedure::text,
         concat_ws('|', pg_get_functiondef(p.oid), p.prosecdef::text, coalesce(p.proconfig::text,''))
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prokind = 'f'
  UNION ALL
  SELECT 'trigger', c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal
  UNION ALL
  SELECT 'table_grant', table_name||'.'||grantee, string_agg(privilege_type, ',' ORDER BY privilege_type)
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
   GROUP BY table_name, grantee
  UNION ALL
  SELECT 'rls', relname, concat_ws('|', relrowsecurity::text, relforcerowsecurity::text)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
) fingerprint ORDER BY category, name;
