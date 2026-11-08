-- Run after the generated bundle on the seeded fixture.
DO $$ BEGIN
 IF (SELECT count(*) FROM public.hospital_memberships)<>7 THEN RAISE EXCEPTION 'Every staff profile should have one membership'; END IF;
 IF EXISTS(SELECT 1 FROM public.hospital_memberships m JOIN public.users u ON u.id=m.user_id WHERE m.role<>u.role) THEN
  RAISE EXCEPTION 'Membership role differs from existing role'; END IF;
 IF EXISTS(SELECT 1 FROM public.hospital_memberships WHERE user_id='00000000-0000-0000-0000-000000000900') THEN
  RAISE EXCEPTION 'Platform owner must not receive a hospital membership'; END IF;
END $$;
-- Hospital not launched yet: staff are fail-closed (no clinical access, no error).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
SELECT set_config('request.headers','{"x-carelink-hospital":"10000000-0000-0000-0000-000000000001"}',true);
DO $$ BEGIN
 IF public.current_hospital_id() IS NOT NULL THEN RAISE EXCEPTION 'Unlaunched hospital granted context'; END IF;
 IF EXISTS(SELECT 1 FROM public.patients) THEN RAISE EXCEPTION 'Clinical rows visible before launch'; END IF;
END $$;
-- After launch (simulated by the owner-gated lifecycle change), the right roles work and others stay out.
RESET ROLE;
UPDATE public.platform_tenants SET lifecycle_state='active';
INSERT INTO public.patients(id,tenant_id,name,age,gender,phone) VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Synthetic',30,'male','000');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true); -- doctor
DO $$ BEGIN
 IF (SELECT count(*) FROM public.patients)<>1 THEN RAISE EXCEPTION 'Doctor cannot read patients after launch'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000900',true); -- platform owner
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.patients) THEN RAISE EXCEPTION 'Platform owner gained clinical access'; END IF;
END $$;
RESET ROLE;
