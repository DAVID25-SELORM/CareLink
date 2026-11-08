-- Test fixtures only. Run after membership-test.sql in the disposable database.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.platform_tenants VALUES
 ('10000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000002','active');
INSERT INTO public.carelink_instance VALUES(true,true,'shared');
INSERT INTO public.hospital_memberships(tenant_id,user_id,role)
 SELECT id,'00000000-0000-0000-0000-000000000001','doctor' FROM public.platform_tenants;
CREATE TABLE public.test_patients (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 UNIQUE(tenant_id,id)
);
CREATE TABLE public.test_encounters (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,patient_id uuid NOT NULL,
 FOREIGN KEY(tenant_id,patient_id) REFERENCES public.test_patients(tenant_id,id)
);
ALTER TABLE public.test_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoped_patient ON public.test_patients TO authenticated
 USING(tenant_id=public.current_hospital_id()) WITH CHECK(tenant_id=public.current_hospital_id());
CREATE POLICY scoped_encounter ON public.test_encounters TO authenticated
 USING(tenant_id=public.current_hospital_id()) WITH CHECK(tenant_id=public.current_hospital_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.test_patients,public.test_encounters TO authenticated;
INSERT INTO public.test_patients VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.test_patients)<>1 THEN RAISE EXCEPTION 'Other hospital rows visible'; END IF;
 DELETE FROM public.test_patients WHERE id='20000000-0000-0000-0000-000000000002';
 IF FOUND THEN RAISE EXCEPTION 'Other hospital deletion allowed'; END IF;
 BEGIN
  INSERT INTO public.test_patients VALUES(gen_random_uuid(),'10000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'Other hospital insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.test_encounters VALUES(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'Cross hospital reference allowed';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO public.test_encounters VALUES(gen_random_uuid(),'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
 PERFORM set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000002"}',true);
 IF (SELECT count(*) FROM public.test_encounters)<>0 THEN RAISE EXCEPTION 'Previous hospital rows visible after switch'; END IF;
END $$;
ROLLBACK;
