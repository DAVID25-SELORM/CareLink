-- 028: Remove legacy audit_log policies that exist in the live database but not in /migrations.
-- Found by querying pg_policies after 027 was applied. Permissive policies are OR-ed, so
--   audit_log_select_all_staff  (USING true)       lets every authenticated user read all audit rows
--   audit_log_insert_all_staff  (WITH CHECK true)  lets every authenticated user forge audit rows
-- which silently defeat the stricter policies from 027.
-- audit_log_delete_admin_only is dropped too: audit rows must be immutable (DELETE is also revoked in 027).
-- Idempotent.
DROP POLICY IF EXISTS audit_log_select_all_staff ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert_all_staff ON public.audit_log;
DROP POLICY IF EXISTS audit_log_delete_admin_only ON public.audit_log;
