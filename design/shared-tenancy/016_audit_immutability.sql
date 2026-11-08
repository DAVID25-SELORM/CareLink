-- DRAFT: audit integrity for shared hospitals. Requires 001 through 015. No shared-mode activation.
-- 008 gave audit_log/data_access_log admin-only read AND write plus UPDATE rights. In shared mode that
--   * drops audit events raised by nurses, doctors and cashiers (the app writes them as the acting user),
--   * lets an admin attribute rows to someone else or rewrite history.
-- Here: every active member may append events about their own actions in the selected hospital,
-- hospital admins read that hospital's trail, members read only their own rows, nobody updates or deletes.
-- report_runs rows must be attributed to the creating user.
BEGIN;
DO $$ DECLARE tab text; p record; BEGIN
 FOREACH tab IN ARRAY ARRAY['audit_log','data_access_log'] LOOP
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname<>'hospital_boundary'
  LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,tab); END LOOP;
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT,INSERT ON public.%I TO authenticated',tab);
  EXECUTE format('CREATE POLICY hospital_read ON public.%I FOR SELECT TO authenticated USING(public.hospital_role(tenant_id)=''admin'' OR (user_id=auth.uid() AND public.hospital_role(tenant_id) IS NOT NULL))',tab);
  EXECUTE format('CREATE POLICY hospital_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.hospital_role(tenant_id) IS NOT NULL)',tab);
 END LOOP;
END $$;
DROP POLICY hospital_insert ON public.report_runs;
DROP POLICY hospital_update ON public.report_runs;
CREATE POLICY hospital_insert ON public.report_runs FOR INSERT TO authenticated
 WITH CHECK(run_by=auth.uid() AND public.hospital_role(tenant_id) IS NOT NULL);
CREATE POLICY hospital_update ON public.report_runs FOR UPDATE TO authenticated
 USING(public.hospital_role(tenant_id)='admin' OR run_by=auth.uid())
 WITH CHECK(public.hospital_role(tenant_id)='admin' OR run_by=auth.uid());
COMMIT;
