-- DRAFT: requires 004. Core roles now derive from hospital membership.
-- Other modules and privileged functions still require conversion before rollout.
BEGIN;
DO $$ DECLARE spec record; policy record; BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('patients',ARRAY['admin','doctor','nurse','records_officer']::text[]),
 ('appointments',ARRAY['admin','doctor','nurse','records_officer']::text[]),
 ('lab_tests',ARRAY['admin','doctor','nurse']::text[]),
 ('prescriptions',ARRAY['admin','doctor','pharmacist']::text[]),
 ('prescription_items',ARRAY['admin','doctor','pharmacist']::text[]),
 ('payments',ARRAY['admin','cashier']::text[]),
 ('referrals',ARRAY['admin','doctor','records_officer']::text[])
 ) AS roles(tab,writers) LOOP
  -- Replace global users.role policies; retain the hospital boundary from 004.
  FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname='public'
   AND tablename=spec.tab AND policyname<>'hospital_boundary'
  LOOP EXECUTE format('DROP POLICY %I ON public.%I',policy.policyname,spec.tab); END LOOP;
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',spec.tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO authenticated',spec.tab);
  EXECUTE format('CREATE POLICY hospital_read ON public.%I FOR SELECT TO authenticated USING(public.hospital_role(tenant_id) IS NOT NULL)',spec.tab);
  EXECUTE format('CREATE POLICY hospital_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.hospital_role(tenant_id)=ANY(%L::text[]))',spec.tab,spec.writers);
  EXECUTE format('CREATE POLICY hospital_update ON public.%I FOR UPDATE TO authenticated USING(public.hospital_role(tenant_id)=ANY(%L::text[])) WITH CHECK(public.hospital_role(tenant_id)=ANY(%L::text[]))',spec.tab,spec.writers,spec.writers);
  -- Clinical deletion is not a generic browser operation. Preserve records;
  -- a future audited correction command must define any deletion workflow.
 END LOOP;
END $$;
COMMIT;
