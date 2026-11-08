-- Run only against an EMPTY disposable PostgreSQL database, as postgres.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.platform_tenants(id uuid PRIMARY KEY,lifecycle_state text NOT NULL);
CREATE TABLE public.carelink_instance(singleton boolean PRIMARY KEY,enabled boolean,instance_kind text);
\ir 001_membership_foundation.sql
\ir 002_context_foundation.sql
BEGIN;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.platform_tenants VALUES
 ('10000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000002','active');
INSERT INTO public.carelink_instance VALUES(true,true,'shared');
INSERT INTO public.hospital_memberships(tenant_id,user_id,role) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','nurse');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 IF public.hospital_role('10000000-0000-0000-0000-000000000001') IS DISTINCT FROM 'nurse' THEN RAISE EXCEPTION 'Own membership unavailable'; END IF;
 IF public.hospital_role('10000000-0000-0000-0000-000000000002') IS NOT NULL THEN RAISE EXCEPTION 'Cross hospital role leaked'; END IF;
 IF public.current_hospital_id() IS NOT NULL THEN RAISE EXCEPTION 'Missing context accepted'; END IF;
 PERFORM set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
 IF public.current_hospital_id() IS DISTINCT FROM '10000000-0000-0000-0000-000000000001'::uuid THEN RAISE EXCEPTION 'Valid context denied'; END IF;
 PERFORM set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000002"}',true);
 IF public.current_hospital_id() IS NOT NULL THEN RAISE EXCEPTION 'Forged context accepted'; END IF;
 PERFORM set_config('request.headers','{"x-carelink-hospital":"not-a-uuid"}',true);
 IF public.current_hospital_id() IS NOT NULL THEN RAISE EXCEPTION 'Malformed context accepted'; END IF;
 BEGIN
  UPDATE public.hospital_memberships SET role='admin';
  RAISE EXCEPTION 'Self promotion allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.hospital_memberships SET status='suspended';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.hospital_role('10000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Suspended membership allowed'; END IF;
END $$;
RESET ROLE;
UPDATE public.hospital_memberships SET status='active';
UPDATE public.platform_tenants SET lifecycle_state='suspended';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.hospital_role('10000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Suspended hospital allowed'; END IF;
END $$;
RESET ROLE;
UPDATE public.platform_tenants SET lifecycle_state='active';
UPDATE public.carelink_instance SET instance_kind='platform';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.hospital_role('10000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Shared access enabled before conversion'; END IF;
END $$;
ROLLBACK;
