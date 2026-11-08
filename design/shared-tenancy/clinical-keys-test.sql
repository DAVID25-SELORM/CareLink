\set ON_ERROR_STOP on
-- Empty core schema fixture, exercising the actual conversion draft.
CREATE TABLE public.patients(id uuid PRIMARY KEY);
CREATE TABLE public.appointments(id uuid PRIMARY KEY,patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE);
CREATE TABLE public.lab_tests(id uuid PRIMARY KEY,patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE);
CREATE TABLE public.prescriptions(id uuid PRIMARY KEY,patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE);
CREATE TABLE public.prescription_items(id uuid PRIMARY KEY,prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE CASCADE);
CREATE TABLE public.payments(id uuid PRIMARY KEY,patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL);
CREATE TABLE public.referrals(id uuid PRIMARY KEY,patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE);
\ir 004_clinical_keys.sql
ALTER TABLE public.platform_tenants ADD COLUMN hospital_name text NOT NULL DEFAULT 'Test hospital';
\ir 005_hospital_session.sql
BEGIN;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO public.platform_tenants(id,lifecycle_state) VALUES('10000000-0000-0000-0000-000000000001','active'),('10000000-0000-0000-0000-000000000002','active');
INSERT INTO public.carelink_instance VALUES(true,true,'shared');
INSERT INTO public.hospital_memberships(tenant_id,user_id,role) SELECT id,'00000000-0000-0000-0000-000000000001','doctor' FROM public.platform_tenants;
INSERT INTO public.patients(id,tenant_id) VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');
CREATE POLICY legacy_allow ON public.patients TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY legacy_allow ON public.prescriptions TO authenticated USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.patients,public.prescriptions TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ BEGIN
 IF public.hospital_session()->>'role'<>'doctor' OR public.hospital_session()->>'tenant_id'<>'10000000-0000-0000-0000-000000000001' THEN RAISE EXCEPTION 'Hospital session mismatch'; END IF;
 IF (SELECT count(*) FROM public.patients)<>1 THEN RAISE EXCEPTION 'Legacy policy bypassed isolation'; END IF;
 BEGIN
  INSERT INTO public.prescriptions(id,patient_id) VALUES(gen_random_uuid(),'20000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'Cross hospital prescription accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO public.prescriptions(id,patient_id) VALUES(gen_random_uuid(),'20000000-0000-0000-0000-000000000001');
 BEGIN
  UPDATE public.patients SET tenant_id='10000000-0000-0000-0000-000000000002';
  RAISE EXCEPTION 'Hospital reassignment accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM public.patients WHERE id='20000000-0000-0000-0000-000000000001';
 IF EXISTS(SELECT 1 FROM public.prescriptions) THEN RAISE EXCEPTION 'Original cascade broken'; END IF;
 PERFORM set_config('request.headers','{}',true);
 BEGIN
  PERFORM public.hospital_session();
  RAISE EXCEPTION 'Missing context accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Hospital access denied' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
