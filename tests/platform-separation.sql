-- Disposable PostgreSQL database only. Run with psql -v ON_ERROR_STOP=1.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
\ir /tmp/database-setup.sql
CREATE VIEW public.test_patient_view AS SELECT id FROM public.patients;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000004');
INSERT INTO public.users(id,email,role) VALUES
 ('00000000-0000-0000-0000-000000000002','admin@test.invalid','admin'),
 ('00000000-0000-0000-0000-000000000003','doctor@test.invalid','doctor');
INSERT INTO public.patients(name,age,gender,phone) VALUES ('Private record',30,'female','000');
\ir /tmp/017_platform_tenant_separation.sql
-- Re-running must preserve configuration and permissions.
\ir /tmp/017_platform_tenant_separation.sql

CREATE FUNCTION public.test_assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', message; END IF; END $$;

INSERT INTO public.platform_owners(user_id) VALUES ('00000000-0000-0000-0000-000000000001');
UPDATE public.carelink_instance SET instance_kind = 'platform';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.test_assert(public.get_carelink_access()->>'role' = 'platform_owner','owner without tenant membership');
INSERT INTO public.platform_tenants(hospital_name, owner_email, created_by)
VALUES ('Hospital A','admin@test.invalid',auth.uid());
INSERT INTO public.platform_onboarding_tasks(hospital_id,phase,task_name,completed_by)
SELECT id,'intake','Check intake',auth.uid() FROM public.platform_tenants;
UPDATE public.platform_tenants SET status = 'live';
SELECT public.test_assert((SELECT count(*) = 1 FROM public.platform_tenants WHERE status = 'live'),'owner manages tenants');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.patients),'platform owner cannot read clinical data');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.test_patient_view),'views cannot bypass boundary');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.patients(name,age,gender,phone) VALUES ('Forbidden',30,'male','111');
    RAISE EXCEPTION 'owner clinical insert unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.test_assert(public.get_carelink_access()->>'role' IS NULL,'tenant admin has no role in platform instance');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.platform_tenants),'tenant admin cannot list other tenants');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.platform_tenants(hospital_name,owner_email) VALUES ('Forbidden','x@test.invalid');
    RAISE EXCEPTION 'tenant platform insert unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.platform_owners(user_id) VALUES (auth.uid());
    RAISE EXCEPTION 'owner promotion unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.carelink_instance SET instance_kind = 'tenant';
    RAISE EXCEPTION 'instance change unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
UPDATE public.carelink_instance SET instance_kind = 'tenant';
SET ROLE authenticated;
SELECT public.test_assert(public.get_carelink_access()->>'role' = 'admin','tenant admin still has tenant access');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.patients),'tenant admin sees own deployment data');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.platform_tenants),'tenant mode hides platform directory');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
UPDATE public.users SET role = 'admin' WHERE id = auth.uid();
SELECT public.test_assert(public.get_carelink_access()->>'role' = 'doctor','staff cannot self-promote');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
SELECT public.test_assert(public.get_carelink_access()->>'role' IS NULL,'unassigned auth user has no tenant access');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.patients),'unassigned auth user cannot read patient data');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.users(id,email,role) VALUES (auth.uid(),'rogue@test.invalid','admin');
    RAISE EXCEPTION 'self-registration unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Even if a legacy public.users admin row exists, ownership is not clinical access.
INSERT INTO public.users(id,email,role) VALUES ('00000000-0000-0000-0000-000000000001','owner@test.invalid','admin');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.test_assert(public.get_carelink_access()->>'role' IS NULL,'platform owner cannot become tenant admin through legacy row');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.patients),'legacy owner row cannot bypass boundary');
RESET ROLE;
UPDATE public.carelink_instance SET enabled = false;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.test_assert(public.get_carelink_access()->>'role' IS NULL,'disabled tenant cannot authenticate workspace access');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.patients),'disabled tenant cannot query data');
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT public.test_assert((SELECT count(*) = 0 FROM public.patients),'anonymous clinical access denied');
RESET ROLE;
SELECT 'Platform separation database checks passed' AS result;
