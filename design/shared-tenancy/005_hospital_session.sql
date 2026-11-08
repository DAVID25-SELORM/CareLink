-- DRAFT: requires membership/context foundations; no instance-mode activation.
BEGIN;
CREATE FUNCTION public.hospital_session() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE tenant uuid := public.current_hospital_id();
BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'Hospital access denied'; END IF;
 RETURN jsonb_build_object('tenant_id',tenant,'user_id',auth.uid(),'role',public.hospital_role(tenant),
 'hospital_name',(SELECT hospital_name FROM public.platform_tenants WHERE id=tenant));
END $$;
REVOKE ALL ON FUNCTION public.hospital_session() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hospital_session() TO authenticated;
CREATE FUNCTION public.hospital_choices() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('tenant_id',t.id,'hospital_name',t.hospital_name) ORDER BY t.hospital_name),'[]'::jsonb)
 FROM public.platform_tenants t JOIN public.hospital_memberships m ON m.tenant_id=t.id
 WHERE m.user_id=auth.uid() AND public.hospital_role(t.id) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.hospital_choices() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hospital_choices() TO authenticated;
COMMIT;
