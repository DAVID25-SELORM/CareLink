RESET ROLE;
INSERT INTO public.users(id,email,role) VALUES('00000000-0000-0000-0000-000000000012','wrong@example.invalid','doctor');
INSERT INTO public.hospital_memberships(tenant_id,user_id,role) VALUES('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000012','doctor');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ BEGIN
 BEGIN
  INSERT INTO public.encounters(patient_id,encounter_type,doctor_id) VALUES('20000000-0000-0000-0000-000000000001','outpatient','00000000-0000-0000-0000-000000000012');
  RAISE EXCEPTION 'Foreign hospital staff assigned';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO public.encounters(patient_id,encounter_type,doctor_id) VALUES('20000000-0000-0000-0000-000000000001','outpatient','00000000-0000-0000-0000-000000000011');
END $$;
RESET ROLE;
UPDATE public.hospital_memberships SET status='suspended' WHERE user_id='00000000-0000-0000-0000-000000000011';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.encounters(patient_id,encounter_type,doctor_id) VALUES('20000000-0000-0000-0000-000000000001','outpatient','00000000-0000-0000-0000-000000000011');
  RAISE EXCEPTION 'Suspended staff assigned';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 UPDATE public.encounters SET encounter_type='outpatient' WHERE doctor_id='00000000-0000-0000-0000-000000000011';
END $$;
RESET ROLE;
