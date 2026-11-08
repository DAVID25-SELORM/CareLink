\set ON_ERROR_STOP on
DO $$ BEGIN
 IF (SELECT count(*) FROM public.patients)<>2 THEN RAISE EXCEPTION 'Restore lost patient records'; END IF;
 IF (SELECT count(*) FROM auth.users)<>1 THEN RAISE EXCEPTION 'Restore lost auth identity'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.patients)<>1 THEN RAISE EXCEPTION 'Restored RLS did not isolate records'; END IF;
 IF public.hospital_role('10000000-0000-0000-0000-000000000001')<>'doctor' THEN RAISE EXCEPTION 'Restored membership missing'; END IF;
 BEGIN
  INSERT INTO public.encounters(patient_id,encounter_type) VALUES('20000000-0000-0000-0000-000000000022','outpatient');
  RAISE EXCEPTION 'Restored FK allowed foreign patient';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000002"}',false);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.patients) THEN RAISE EXCEPTION 'Restored membership boundary bypassed'; END IF;
END $$;
RESET ROLE;
