-- Disposable test only. Synthetic records deliberately committed for pg_dump.
INSERT INTO public.carelink_instance(singleton,enabled,instance_kind) VALUES(true,true,'shared');
UPDATE public.platform_tenants SET lifecycle_state='active';
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000021','restore@example.invalid',now());
INSERT INTO public.hospital_memberships(tenant_id,user_id,role)
 VALUES('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','doctor');
INSERT INTO public.patients(id,tenant_id,name,age,gender,phone) VALUES
 ('20000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000001','Restore synthetic A',20,'male','000'),
 ('20000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000002','Restore synthetic B',20,'female','000');
