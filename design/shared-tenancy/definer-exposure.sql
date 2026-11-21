-- Read-only. Lists SECURITY DEFINER functions in public that can be executed by anon or any signed-in user.
-- Run in the Supabase SQL editor on the live project and send the result for review.
-- Anything callable by anon is the highest priority: it should normally be REVOKEd (see 017 for the pattern).
SELECT p.oid::regprocedure AS function,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can_execute,
       coalesce(p.proconfig::text, '') AS config,
       left(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g'), 240) AS start_of_definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
 ORDER BY anon_can_execute DESC, function::text;
