-- Platform only. Requires 023. All worker metadata writes use the current lease.
BEGIN;
CREATE OR REPLACE FUNCTION public.platform_worker_record(p_id uuid,p_token uuid,p_operation text,p_args jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.platform_jobs; permission text;
BEGIN
 SELECT * INTO j FROM public.platform_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR j.status<>'running' OR j.lease_token IS DISTINCT FROM p_token OR j.lease_until IS NULL OR j.lease_until<=now() THEN
   RAISE EXCEPTION 'Lease lost';
 END IF;
 permission:=CASE WHEN j.kind='invite_platform' THEN 'team.write'
 WHEN j.kind IN ('provision','invite_admin','apply_modules','go_live') THEN 'onboarding.write' ELSE 'operations.write' END;
 IF NOT public.platform_actor_can(j.requested_by,permission) THEN RAISE EXCEPTION 'Authorization changed'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=j.tenant_id AND lifecycle_state<>'archived' FOR UPDATE;
 IF NOT FOUND OR j.tenant_id IS DISTINCT FROM (p_args->>'p_tenant_id')::uuid THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
 IF j.draft_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=j.tenant_id) THEN
   RAISE EXCEPTION 'Requirements changed';
 END IF;
 IF p_operation='platform_record_binding' THEN
   PERFORM public.platform_record_binding(j.tenant_id,p_args->'p_state');
 ELSIF p_operation='platform_record_schema' THEN
   PERFORM public.platform_record_schema(j.tenant_id,p_args->>'p_name',p_args->>'p_checksum',p_args->>'p_status',p_args->>'p_error');
 ELSIF p_operation='platform_record_health' THEN
   PERFORM public.platform_record_health(j.tenant_id,p_args->>'p_status',(p_args->>'p_latency')::integer,p_args->>'p_error');
 ELSIF p_operation='platform_record_cost' THEN
   PERFORM public.platform_record_cost(j.tenant_id,p_args->>'p_provider',(p_args->>'p_period')::date,(p_args->>'p_amount')::numeric,p_args->>'p_currency',p_args->>'p_source');
 ELSE RAISE EXCEPTION 'Unsupported worker write'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.platform_worker_record(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_worker_record(uuid,uuid,text,jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.platform_record_binding(uuid,jsonb),public.platform_record_schema(uuid,text,text,text,text),public.platform_record_health(uuid,text,integer,text),public.platform_record_cost(uuid,text,date,numeric,text,text) FROM service_role;
COMMIT;
