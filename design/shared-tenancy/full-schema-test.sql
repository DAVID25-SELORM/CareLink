\set ON_ERROR_STOP on
\ir schema-fixture.sql
\ir 001_membership_foundation.sql
\ir 002_context_foundation.sql
\ir 003_membership_commands.sql
\ir 004_clinical_keys.sql
\ir 005_hospital_session.sql
\ir 006_core_role_policies.sql
INSERT INTO public.platform_tenants(id,hospital_name,owner_email) VALUES
 ('10000000-0000-0000-0000-000000000001','Synthetic A','a@example.invalid'),
 ('10000000-0000-0000-0000-000000000002','Synthetic B','b@example.invalid');
SELECT set_config('carelink.initial_tenant_id','10000000-0000-0000-0000-000000000001',false);
INSERT INTO public.hospital_profile(hospital_name) VALUES('Retained configuration');
\ir 007_all_hospital_keys.sql
\ir 008_module_role_policies.sql
\ir 009_shared_identities.sql
\ir 010_shared_worker_guard.sql
\ir 011_hospital_unique_keys.sql
\ir 012_shared_workspace.sql
\ir 013_shared_invitations.sql
\ir 014_shared_launch.sql
\ir 015_staff_reference_boundary.sql
\ir 016_audit_immutability.sql
BEGIN;
-- Only this disposable fixture enables shared mode. No production mode change.

INSERT INTO public.carelink_instance(singleton,enabled,instance_kind) VALUES(true,true,'shared');
UPDATE public.platform_tenants SET lifecycle_state='active';
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO public.users(id,email,role,full_name) VALUES('00000000-0000-0000-0000-000000000001','synthetic@example.invalid','doctor','Synthetic staff');
INSERT INTO public.hospital_memberships(tenant_id,user_id,role) SELECT id,'00000000-0000-0000-0000-000000000001','admin' FROM public.platform_tenants;
INSERT INTO public.patients(id,tenant_id,name,age,gender,phone) VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Synthetic A',20,'male','000'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Synthetic B',20,'female','000');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ DECLARE visible integer; BEGIN
 IF (SELECT role FROM public.hospital_users LIMIT 1)<>'admin' THEN RAISE EXCEPTION 'Global role leaked into hospital directory'; END IF;
 IF (public.hospital_staff()->0->>'role')<>'admin' THEN RAISE EXCEPTION 'Staff RPC returned global role'; END IF;
 BEGIN
  UPDATE public.users SET role='admin';
  RAISE EXCEPTION 'Browser changed global role';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT count(*) INTO visible FROM public.patients;
 IF visible<>1 THEN RAISE EXCEPTION 'Full schema patient isolation failed'; END IF;
 IF (SELECT count(*) FROM public.hospital_profile)<>1 THEN RAISE EXCEPTION 'Retained profile mapping failed'; END IF;
 BEGIN
  INSERT INTO public.encounters(patient_id,encounter_type) VALUES('20000000-0000-0000-0000-000000000002','outpatient');
  RAISE EXCEPTION 'Cross-module foreign hospital reference allowed';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO public.encounters(patient_id,encounter_type) VALUES('20000000-0000-0000-0000-000000000001','outpatient');
 INSERT INTO public.inventory_categories(name) VALUES('Shared category name');
END $$;
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000002"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.encounters) THEN RAISE EXCEPTION 'Other hospital encounters visible'; END IF;
 IF EXISTS(SELECT 1 FROM public.hospital_profile) THEN RAISE EXCEPTION 'Other hospital profile visible'; END IF;
 INSERT INTO public.hospital_profile(hospital_name) VALUES('Second hospital profile');
 INSERT INTO public.inventory_categories(name) VALUES('Shared category name');
 BEGIN
  INSERT INTO public.inventory_categories(name) VALUES('Shared category name');
  RAISE EXCEPTION 'Duplicate natural key accepted inside hospital';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000000009');
INSERT INTO public.platform_owners(user_id) VALUES('00000000-0000-0000-0000-000000000009');
INSERT INTO public.platform_onboarding_drafts(tenant_id,updated_by)
 SELECT id,'00000000-0000-0000-0000-000000000009' FROM public.platform_tenants;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.patients) THEN RAISE EXCEPTION 'Platform owner gained clinical access without membership'; END IF;
 PERFORM public.platform_prepare_shared_hospital('10000000-0000-0000-0000-000000000001',1);
 PERFORM public.platform_prepare_shared_hospital('10000000-0000-0000-0000-000000000001',1);
 BEGIN
  PERFORM public.platform_prepare_shared_hospital('10000000-0000-0000-0000-000000000001',2);
  RAISE EXCEPTION 'Stale workspace revision accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Reload the current requirements revision' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.hospitals)<>1 THEN RAISE EXCEPTION 'Workspace retry duplicated hospital'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_tenants WHERE provisioned_at IS NOT NULL) THEN RAISE EXCEPTION 'Preparation claimed verified provisioning'; END IF;
END $$;
-- Shared mode must reject the legacy infrastructure queue before dispatch.
DO $$ BEGIN
 BEGIN
  INSERT INTO public.platform_jobs(kind,tenant_id,requested_by,status)
  VALUES('provision','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','queued');
  RAISE EXCEPTION 'Legacy infrastructure queue accepted in shared mode';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Dedicated infrastructure jobs are disabled for shared hospitals' THEN RAISE; END IF;
 END;
END $$;
DO $$ DECLARE missing integer; BEGIN
 SELECT count(*) INTO missing FROM pg_tables t WHERE schemaname='public'
 AND tablename NOT LIKE 'platform_%'
 AND tablename NOT IN ('carelink_instance','users','roles','permissions','role_permissions','hospital_memberships','hospital_membership_audit')
 AND NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.tablename AND c.column_name='tenant_id' AND c.is_nullable='NO');
 IF missing<>0 THEN RAISE EXCEPTION 'Hospital table coverage incomplete: %',missing; END IF;
END $$;
\ir invitations-test.sql
\ir launch-test.sql
\ir staff-reference-test.sql
\ir audit-scope-test.sql
ROLLBACK;
