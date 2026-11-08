-- 027: Close findings from the production audit (Supabase Security Advisor + review).
--  * audit_log was only created by a legacy root script, never by /migrations. Create it here.
--  * audit_log / data_access_log / report_runs allowed any authenticated user to insert
--    arbitrary rows (WITH CHECK (TRUE)); audit_log was readable by every authenticated user
--    and contained old/new row values. Audit rows are now append-only and attributable.
--  * Pin search_path on trigger/helper functions flagged "Function Search Path Mutable".
-- Idempotent. NOT applied to production by the audit; review and apply deliberately.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- audit_log: append-only, attributable, readable by admins (and a user's own rows).
DROP POLICY IF EXISTS audit_log_select_authenticated ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert_authenticated ON public.audit_log;
DROP POLICY IF EXISTS audit_log_select_admin_or_self ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert_self ON public.audit_log;
CREATE POLICY audit_log_select_admin_or_self ON public.audit_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_tenant_admin());
CREATE POLICY audit_log_insert_self ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_tenant_user() OR public.is_platform_owner()));
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.audit_log FROM anon;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;

-- data_access_log: same rule (reads stay admin-only per 013).
DROP POLICY IF EXISTS "System insert data access log" ON public.data_access_log;
DROP POLICY IF EXISTS data_access_log_insert_self ON public.data_access_log;
CREATE POLICY data_access_log_insert_self ON public.data_access_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_tenant_user() OR public.is_platform_owner()));
REVOKE UPDATE, DELETE, TRUNCATE ON public.data_access_log FROM PUBLIC, anon, authenticated;

-- report_runs: a user may only create runs attributed to themselves.
DROP POLICY IF EXISTS "Staff create report runs" ON public.report_runs;
DROP POLICY IF EXISTS report_runs_insert_self ON public.report_runs;
CREATE POLICY report_runs_insert_self ON public.report_runs FOR INSERT TO authenticated
  WITH CHECK (run_by = auth.uid() AND public.is_tenant_user());

-- Pin search_path on every overload of the flagged functions (skips any that do not exist).
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('calculate_billing_total','calculate_bmi','get_user_role',
        'set_hospital_onboarding_updated_at','set_hospital_profile_updated_at',
        'set_records_row_updated_at','update_advanced_features_timestamp',
        'update_referrals_updated_at','update_updated_at_column')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.sig);
  END LOOP;
END $$;
