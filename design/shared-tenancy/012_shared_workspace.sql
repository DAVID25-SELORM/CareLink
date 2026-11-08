-- DRAFT: idempotent local workspace preparation. Does not approve or activate a hospital.
BEGIN;
CREATE FUNCTION public.platform_prepare_shared_hospital(p_tenant_id uuid,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.platform_tenants; d public.platform_onboarding_drafts;
BEGIN
 IF NOT public.platform_can('onboarding.write') OR NOT EXISTS(
  SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared'
 ) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO t FROM public.platform_tenants WHERE id=p_tenant_id FOR UPDATE;
 IF NOT FOUND OR t.lifecycle_state='archived' THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
 SELECT * INTO d FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND OR p_revision IS DISTINCT FROM d.revision THEN RAISE EXCEPTION 'Reload the current requirements revision'; END IF;
 -- Existing clinical modules use hospitals.id. Keep it identical to the registry
 -- ID so the verified hospital context works for both legacy and new columns.
 INSERT INTO public.hospitals(id,tenant_id,hospital_name,owner_email,created_by)
 VALUES(t.id,t.id,t.hospital_name,t.owner_email,(SELECT id FROM public.users WHERE id=auth.uid()))
 ON CONFLICT(id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.hospitals WHERE id=t.id AND tenant_id=t.id)
 THEN RAISE EXCEPTION 'Hospital identity conflict'; END IF;
 INSERT INTO public.hospital_profile(tenant_id,hospital_name,contact_email)
 VALUES(t.id,t.hospital_name,t.owner_email) ON CONFLICT(tenant_id) DO NOTHING;
 RETURN jsonb_build_object('tenant_id',t.id,'revision',d.revision,'workspace_prepared',true,'live',false);
END $$;
REVOKE ALL ON FUNCTION public.platform_prepare_shared_hospital(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_prepare_shared_hospital(uuid,integer) TO authenticated;
COMMIT;
