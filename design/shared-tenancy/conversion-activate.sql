-- Map every existing staff profile to the initial hospital with the role they hold today, then
-- enable shared mode. The hospital stays in its current lifecycle state: staff gain clinical access
-- only after the hospital passes the gated launch flow (014). Platform owners get no clinical access.
INSERT INTO public.hospital_memberships(tenant_id,user_id,role,status)
SELECT current_setting('carelink.initial_tenant_id')::uuid,u.id,u.role,'active'
FROM public.users u
WHERE NOT EXISTS(SELECT 1 FROM public.platform_owners p WHERE p.user_id=u.id);
UPDATE public.carelink_instance SET instance_kind='shared' WHERE singleton;
DO $$ DECLARE missing integer; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared') THEN
  RAISE EXCEPTION 'Postflight: shared mode not enabled'; END IF;
 SELECT count(*) INTO missing FROM pg_tables t WHERE schemaname='public'
  AND tablename NOT LIKE 'platform_%'
  AND tablename NOT IN ('carelink_instance','users','roles','permissions','role_permissions','hospital_memberships','hospital_membership_audit')
  AND NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.tablename AND c.column_name='tenant_id' AND c.is_nullable='NO');
 IF missing<>0 THEN RAISE EXCEPTION 'Postflight: % hospital tables lack a NOT NULL tenant_id',missing; END IF;
 SELECT count(*) INTO missing FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;
 IF missing<>0 THEN RAISE EXCEPTION 'Postflight: % public tables without RLS',missing; END IF;
END $$;
