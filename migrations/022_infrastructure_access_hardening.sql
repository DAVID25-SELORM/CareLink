-- Platform project only. Requires 021. Harden SECURITY DEFINER status access.
BEGIN;
CREATE OR REPLACE FUNCTION public.platform_hospital_status(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.platform_can('hospitals.read') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT jsonb_build_object(
   'tenant_id',t.id,'registration_status',t.status,'lifecycle_state',t.lifecycle_state,'provisioned_at',t.provisioned_at,
   'administrator_configured',t.admin_user_id IS NOT NULL,
   'binding',(SELECT to_jsonb(b) - 'id' - 'tenant_id' FROM public.platform_tenant_bindings b WHERE b.tenant_id=t.id),
   'schema_ledger',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.applied_at DESC) FROM public.platform_tenant_schema_ledger l WHERE l.tenant_id=t.id),'[]'::jsonb),
   'latest_job',(SELECT to_jsonb(j) - 'configuration' - 'lease_token' FROM public.platform_jobs j WHERE j.tenant_id=t.id ORDER BY j.created_at DESC LIMIT 1),
   'steps',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at) FROM public.platform_job_steps s JOIN public.platform_jobs j ON j.id=s.job_id WHERE j.tenant_id=t.id),'[]'::jsonb),
   'readiness_blockers',public.platform_launch_blockers(t.id),
   'owner_approved',EXISTS(SELECT 1 FROM public.platform_launch_approvals a WHERE a.tenant_id=t.id AND a.revision=(SELECT revision FROM public.platform_onboarding_drafts d WHERE d.tenant_id=t.id))
 ) INTO v_result FROM public.platform_tenants t WHERE t.id=p_tenant_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.platform_hospital_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_hospital_status(uuid) TO authenticated;
COMMIT;
