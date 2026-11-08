-- Runs inside full-schema-test.sql's transaction (shared mode, hospitals A and B, user ...01 admin of both).
RESET ROLE;
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000000021'),('00000000-0000-0000-0000-000000000022');
INSERT INTO public.users(id,email,role,full_name) VALUES
 ('00000000-0000-0000-0000-000000000021','nurse@example.invalid','nurse','Nurse A'),
 ('00000000-0000-0000-0000-000000000022','adminb@example.invalid','nurse','Admin B');
INSERT INTO public.hospital_memberships(tenant_id,user_id,role) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','nurse'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022','admin');
SET LOCAL ROLE authenticated;

-- Nurse in hospital A can record her own action, cannot forge another user, cannot edit or delete.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ BEGIN
 INSERT INTO public.audit_log(user_id,action,table_name) VALUES('00000000-0000-0000-0000-000000000021','nurse_action','beds');
 BEGIN
  INSERT INTO public.audit_log(user_id,action,table_name) VALUES('00000000-0000-0000-0000-000000000001','forged','beds');
  RAISE EXCEPTION 'Audit row attributed to another user accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.audit_log SET action='tamper'; RAISE EXCEPTION 'Audit update allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.audit_log; RAISE EXCEPTION 'Audit delete allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.audit_log)<>1 THEN RAISE EXCEPTION 'Nurse should see only her own audit row'; END IF;
 INSERT INTO public.data_access_log(user_id,action,resource_type) VALUES('00000000-0000-0000-0000-000000000021','view','patient');
 BEGIN
  INSERT INTO public.report_runs(name,run_by) VALUES('forged run','00000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'Report run attributed to another user accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- Admin of A (user 01) sees A's trail including the nurse's row.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.audit_log)<>1 THEN RAISE EXCEPTION 'Hospital admin cannot read own hospital audit trail'; END IF;
END $$;

-- Admin of hospital B sees nothing from hospital A, even when asking for A.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.audit_log) THEN RAISE EXCEPTION 'Cross-hospital audit read via forged header'; END IF;
 IF EXISTS(SELECT 1 FROM public.data_access_log) THEN RAISE EXCEPTION 'Cross-hospital access-log read'; END IF;
 BEGIN
  INSERT INTO public.audit_log(user_id,action,table_name,tenant_id)
  VALUES('00000000-0000-0000-0000-000000000022','cross','beds','10000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'Cross-hospital audit insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN check_violation THEN NULL; END;
END $$;
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000002"}',true);
DO $$ BEGIN
 INSERT INTO public.audit_log(user_id,action,table_name) VALUES('00000000-0000-0000-0000-000000000022','b_action','beds');
 IF (SELECT count(*) FROM public.audit_log)<>1 THEN RAISE EXCEPTION 'Hospital B should see only its own trail'; END IF;
END $$;
RESET ROLE;
