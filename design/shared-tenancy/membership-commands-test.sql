-- EMPTY disposable database only, after membership-test.sql.
\set ON_ERROR_STOP on
-- Mock owner identity; production uses its existing protected owner registry.
CREATE FUNCTION public.is_platform_owner() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT auth.uid()='00000000-0000-0000-0000-000000000003'::uuid;
$$;
\ir 003_membership_commands.sql
BEGIN;
INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
INSERT INTO public.platform_tenants VALUES
 ('10000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000002','active');
INSERT INTO public.carelink_instance VALUES(true,true,'shared');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ BEGIN
 IF public.current_hospital_id() IS NOT NULL THEN RAISE EXCEPTION 'Platform owner has implicit clinical access'; END IF;
 PERFORM public.hospital_set_member('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','admin','active','Bootstrap hospital administrator');
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.hospital_set_member('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','doctor','active','Remove last administrator');
  RAISE EXCEPTION 'Last administrator removal allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Assign another active administrator first' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.hospital_set_member('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','admin','active','Cross hospital attempt');
  RAISE EXCEPTION 'Cross hospital administration allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Not authorized' THEN RAISE; END IF;
 END;
 PERFORM public.hospital_set_member('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','nurse','active','Assign nursing membership');
 IF (SELECT count(*) FROM public.hospital_membership_audit)<>2 THEN RAISE EXCEPTION 'Missing audit records'; END IF;
 BEGIN
  DELETE FROM public.hospital_membership_audit;
  RAISE EXCEPTION 'Audit modification allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.hospital_set_member('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','admin','active','Escalate own membership');
  RAISE EXCEPTION 'Nurse self promotion allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Not authorized' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.hospital_membership_audit)<>0 THEN RAISE EXCEPTION 'Nurse can read membership audit'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT public.hospital_set_member('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','admin','active','Assign successor administrator');
SELECT public.hospital_set_member('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','doctor','active','Transfer hospital administration');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.hospital_membership_audit)<>4 THEN RAISE EXCEPTION 'Audit count mismatch'; END IF;
END $$;
ROLLBACK;
