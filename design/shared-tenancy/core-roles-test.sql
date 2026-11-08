\set ON_ERROR_STOP on
\ir 006_core_role_policies.sql
BEGIN;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO public.platform_tenants(id,lifecycle_state) VALUES
 ('10000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000002','active');
INSERT INTO public.carelink_instance VALUES(true,true,'shared');
INSERT INTO public.hospital_memberships(tenant_id,user_id,role) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','doctor'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','cashier');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ BEGIN
 INSERT INTO public.patients(id) VALUES(gen_random_uuid());
 BEGIN
  INSERT INTO public.payments(id) VALUES(gen_random_uuid());
  RAISE EXCEPTION 'Doctor wrote payment';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public.patients;
  RAISE EXCEPTION 'Browser deleted clinical records';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Switching hospitals starts a separate request/statement.
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000002"}',true);
DO $$ BEGIN
 INSERT INTO public.payments(id) VALUES(gen_random_uuid());
 BEGIN
  INSERT INTO public.patients(id) VALUES(gen_random_uuid());
  RAISE EXCEPTION 'Cashier inherited doctor role from another hospital';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.patients) THEN RAISE EXCEPTION 'Other hospital patient visible'; END IF;
END $$;
ROLLBACK;
