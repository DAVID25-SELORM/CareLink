-- DRAFT: shared identities and profile boundary. Does not activate shared mode.
BEGIN;
ALTER TABLE public.carelink_instance DROP CONSTRAINT carelink_instance_instance_kind_check;
ALTER TABLE public.carelink_instance ADD CONSTRAINT carelink_instance_instance_kind_check CHECK(instance_kind IN ('tenant','platform','shared'));
CREATE OR REPLACE FUNCTION public.is_platform_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

  SELECT EXISTS (

    SELECT 1 FROM public.platform_owners p, public.carelink_instance i

    WHERE p.user_id = auth.uid() AND i.singleton AND i.enabled AND i.instance_kind IN ('platform','shared')

  );

$function$
;
CREATE OR REPLACE FUNCTION public.platform_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

 SELECT CASE WHEN public.is_platform_owner() THEN 'platform_owner' ELSE (

   SELECT m.role FROM public.platform_members m, public.carelink_instance i

   WHERE m.user_id=auth.uid() AND m.status='active' AND i.singleton AND i.enabled AND i.instance_kind IN ('platform','shared')

 ) END;

$function$
;
CREATE OR REPLACE FUNCTION public.platform_actor_can(p_actor uuid, p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

 SELECT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind IN ('platform','shared')) AND (

 EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=p_actor) OR EXISTS(

 SELECT 1 FROM public.platform_members WHERE user_id=p_actor AND status='active' AND CASE role

 WHEN 'platform_admin' THEN p_permission IN ('hospitals.write','onboarding.write')

 WHEN 'technical_admin' THEN p_permission IN ('onboarding.write','operations.write')

 WHEN 'finance_manager' THEN p_permission='billing.write' ELSE false END));

$function$
;
CREATE OR REPLACE FUNCTION public.is_tenant_user() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared')
 THEN public.current_hospital_id() IS NOT NULL ELSE EXISTS(SELECT 1 FROM public.users u,public.carelink_instance i
 WHERE u.id=auth.uid() AND i.singleton AND i.enabled AND i.instance_kind='tenant'
 AND NOT EXISTS(SELECT 1 FROM public.platform_owners p WHERE p.user_id=auth.uid())
 AND NOT EXISTS(SELECT 1 FROM public.platform_members m WHERE m.user_id=auth.uid())) END;
$$;
CREATE OR REPLACE FUNCTION public.is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.is_tenant_user() AND public.get_user_role()='admin';
$$;
DO $$ DECLARE p record; t text; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('users','roles','permissions','role_permissions')
 LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
 FOREACH t IN ARRAY ARRAY['users','roles','permissions','role_permissions'] LOOP
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE FUNCTION public.hospital_profile_visible(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.hospital_memberships WHERE user_id=p_user AND tenant_id=public.current_hospital_id() AND status='active');
$$;
REVOKE ALL ON FUNCTION public.hospital_profile_visible(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hospital_profile_visible(uuid) TO authenticated;
CREATE POLICY hospital_profiles_read ON public.users FOR SELECT TO authenticated USING(
 id=auth.uid() OR public.hospital_profile_visible(id));
CREATE POLICY hospital_roles_read ON public.roles FOR SELECT TO authenticated USING(public.current_hospital_id() IS NOT NULL);
CREATE POLICY hospital_permissions_read ON public.permissions FOR SELECT TO authenticated USING(public.current_hospital_id() IS NOT NULL);
CREATE POLICY hospital_role_permissions_read ON public.role_permissions FOR SELECT TO authenticated USING(public.current_hospital_id() IS NOT NULL);
-- Staff listings must use membership-derived roles rather than users.role.
CREATE FUNCTION public.hospital_staff() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE tenant uuid:=public.current_hospital_id(); result jsonb;
BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'Hospital access denied'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.user_id,'role',m.role,'status',m.status,'full_name',u.full_name,'email',u.email) ORDER BY u.full_name),'[]') INTO result
 FROM public.hospital_memberships m JOIN public.users u ON u.id=m.user_id WHERE m.tenant_id=tenant;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.hospital_staff() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hospital_staff() TO authenticated;
CREATE POLICY hospital_membership_directory ON public.hospital_memberships FOR SELECT TO authenticated USING(tenant_id=public.current_hospital_id());
CREATE VIEW public.hospital_users WITH(security_invoker=true) AS
 SELECT u.id,u.email,u.full_name,u.phone,u.specialty,u.created_at,u.updated_at,m.role,m.status,m.tenant_id AS hospital_id
 FROM public.users u JOIN public.hospital_memberships m ON m.user_id=u.id
 WHERE m.tenant_id=public.current_hospital_id() AND m.status='active';
REVOKE ALL ON public.hospital_users FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hospital_users TO authenticated;
COMMIT;
