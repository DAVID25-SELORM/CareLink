-- Live-like pre-conversion state (mirrors the 2026-11 inventory: platform instance, one onboarding hospital,
-- no clinical rows, staff across all six roles, one platform owner). Synthetic data only.
INSERT INTO public.carelink_instance(singleton,enabled,instance_kind) VALUES(true,true,'platform');
INSERT INTO public.platform_tenants(id,hospital_name,owner_email) VALUES
 ('10000000-0000-0000-0000-000000000001','Rehearsal Hospital','owner@example.invalid');
INSERT INTO auth.users(id) SELECT ('00000000-0000-0000-0000-0000000001'||lpad(g::text,2,'0'))::uuid FROM generate_series(1,7) g;
INSERT INTO public.users(id,email,role,full_name)
SELECT ('00000000-0000-0000-0000-0000000001'||lpad(g::text,2,'0'))::uuid,'staff'||g||'@example.invalid',
 (ARRAY['admin','cashier','doctor','nurse','pharmacist','records_officer','nurse'])[g],'Staff '||g FROM generate_series(1,7) g;
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000000900');
INSERT INTO public.platform_owners(user_id) VALUES('00000000-0000-0000-0000-000000000900');
