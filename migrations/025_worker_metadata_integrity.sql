-- Platform only. Requires 024. Preserve partial metadata updates and validate worker input.
BEGIN;
CREATE OR REPLACE FUNCTION public.platform_record_binding(p_tenant_id uuid,p_state jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ref text; v_url text; v_checksum text; k text;
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''), NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 IF p_state IS NULL OR jsonb_typeof(p_state)<>'object' OR octet_length(p_state::text)>12000 THEN RAISE EXCEPTION 'Invalid binding'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_state) LOOP
   IF k NOT IN ('supabase_project_ref','supabase_url','vercel_project_id','vercel_project_name','deployment_id','deployment_url','domain','provider_status','health_status','admin_invitation_status','schema_version','schema_checksum','estimated_monthly_cost','cost_currency','provisioned_at','last_error') THEN RAISE EXCEPTION 'Unsupported binding field'; END IF;
 END LOOP;
 v_ref:=p_state->>'supabase_project_ref'; v_url:=p_state->>'supabase_url'; v_checksum:=p_state->>'schema_checksum';
 IF v_ref IS NOT NULL AND v_ref !~ '^[a-z0-9]{6,64}$' THEN RAISE EXCEPTION 'Invalid Supabase project reference'; END IF;
 IF v_checksum IS NOT NULL AND v_checksum !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid schema checksum'; END IF;
 INSERT INTO public.platform_tenant_bindings(tenant_id,supabase_project_ref,supabase_url,vercel_project_id,vercel_project_name,deployment_id,deployment_url,domain,provider_status,health_status,admin_invitation_status,schema_version,schema_checksum,estimated_monthly_cost,cost_currency,provisioned_at,last_sync_at,last_error)
 SELECT p_tenant_id,v_ref,p_state->>'supabase_url',p_state->>'vercel_project_id',p_state->>'vercel_project_name',p_state->>'deployment_id',p_state->>'deployment_url',p_state->>'domain',COALESCE(p_state->>'provider_status','pending'),COALESCE(p_state->>'health_status','unknown'),COALESCE(p_state->>'admin_invitation_status','pending'),p_state->>'schema_version',v_checksum,(p_state->>'estimated_monthly_cost')::numeric,p_state->>'cost_currency',(p_state->>'provisioned_at')::timestamptz,now(),left(p_state->>'last_error',500)
 ON CONFLICT(tenant_id) DO UPDATE SET supabase_project_ref=COALESCE(EXCLUDED.supabase_project_ref,platform_tenant_bindings.supabase_project_ref),supabase_url=COALESCE(EXCLUDED.supabase_url,platform_tenant_bindings.supabase_url),vercel_project_id=COALESCE(EXCLUDED.vercel_project_id,platform_tenant_bindings.vercel_project_id),vercel_project_name=COALESCE(EXCLUDED.vercel_project_name,platform_tenant_bindings.vercel_project_name),deployment_id=COALESCE(EXCLUDED.deployment_id,platform_tenant_bindings.deployment_id),deployment_url=COALESCE(EXCLUDED.deployment_url,platform_tenant_bindings.deployment_url),domain=COALESCE(EXCLUDED.domain,platform_tenant_bindings.domain),provider_status=CASE WHEN p_state ? 'provider_status' THEN EXCLUDED.provider_status ELSE platform_tenant_bindings.provider_status END,health_status=CASE WHEN p_state ? 'health_status' THEN EXCLUDED.health_status ELSE platform_tenant_bindings.health_status END,admin_invitation_status=CASE WHEN p_state ? 'admin_invitation_status' THEN EXCLUDED.admin_invitation_status ELSE platform_tenant_bindings.admin_invitation_status END,schema_version=COALESCE(EXCLUDED.schema_version,platform_tenant_bindings.schema_version),schema_checksum=COALESCE(EXCLUDED.schema_checksum,platform_tenant_bindings.schema_checksum),estimated_monthly_cost=COALESCE(EXCLUDED.estimated_monthly_cost,platform_tenant_bindings.estimated_monthly_cost),cost_currency=COALESCE(EXCLUDED.cost_currency,platform_tenant_bindings.cost_currency),provisioned_at=COALESCE(EXCLUDED.provisioned_at,platform_tenant_bindings.provisioned_at),last_sync_at=now(),last_error=CASE WHEN p_state ? 'last_error' THEN EXCLUDED.last_error ELSE platform_tenant_bindings.last_error END,updated_at=now();
 IF COALESCE(p_state->>'provider_status','')='ready' THEN UPDATE public.platform_tenants SET provisioned_at=COALESCE(provisioned_at,now()),status=CASE WHEN status IN ('lead','intake','provisioning') THEN 'training' ELSE status END,updated_at=now() WHERE id=p_tenant_id; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.platform_record_schema(p_tenant_id uuid,p_name text,p_checksum text,p_status text,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''), NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 IF p_checksum IS NULL OR p_status IS NULL OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 160 OR p_checksum !~ '^[a-f0-9]{64}$' OR p_status NOT IN ('applied','failed') THEN RAISE EXCEPTION 'Invalid schema record'; END IF;
 INSERT INTO public.platform_tenant_schema_ledger(tenant_id,migration_name,checksum,status,error) VALUES(p_tenant_id,trim(p_name),p_checksum,p_status,left(p_error,500)) ON CONFLICT(tenant_id,migration_name) DO UPDATE SET checksum=EXCLUDED.checksum,status=EXCLUDED.status,error=EXCLUDED.error,applied_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.platform_record_health(p_tenant_id uuid,p_status text,p_latency integer,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''), NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' OR p_status IS NULL OR p_latency IS NULL OR p_latency<0 OR p_status NOT IN ('healthy','degraded','down') THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 INSERT INTO public.platform_health_checks(tenant_id,service,status,latency_ms,detail,created_at) VALUES(p_tenant_id,'provisioning',p_status, greatest(p_latency,0),left(COALESCE(p_error,''),500),now());
 UPDATE public.platform_tenant_bindings SET health_status=p_status,last_health_check_at=now(),last_sync_at=now(),last_error=left(p_error,500),updated_at=now() WHERE tenant_id=p_tenant_id;
END $$;
CREATE OR REPLACE FUNCTION public.platform_record_cost(p_tenant_id uuid,p_provider text,p_period date,p_amount numeric,p_currency text,p_source text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''), NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' OR p_provider IS NULL OR p_amount IS NULL OR p_currency IS NULL OR p_source IS NULL OR p_provider NOT IN ('supabase','vercel','other') OR p_amount<0 OR p_currency !~ '^[A-Z]{3}$' OR length(trim(p_source))<2 THEN RAISE EXCEPTION 'Invalid cost record'; END IF;
 INSERT INTO public.platform_tenant_costs(tenant_id,provider,period_start,amount,currency,source) VALUES(p_tenant_id,p_provider,date_trunc('month',COALESCE(p_period,current_date))::date,p_amount,p_currency,trim(p_source)) ON CONFLICT(tenant_id,provider,period_start) DO UPDATE SET amount=EXCLUDED.amount,currency=EXCLUDED.currency,source=EXCLUDED.source,measured_at=now();
 UPDATE public.platform_tenant_bindings SET estimated_monthly_cost=(SELECT sum(amount) FROM public.platform_tenant_costs WHERE tenant_id=p_tenant_id AND currency=p_currency AND period_start=date_trunc('month',COALESCE(p_period,current_date))::date),cost_currency=p_currency,updated_at=now() WHERE tenant_id=p_tenant_id;
END $$;
CREATE OR REPLACE FUNCTION public.platform_hospital_status(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.platform_can('hospitals.read') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT jsonb_build_object(
   'tenant_id',t.id,'registration_status',t.status,'lifecycle_state',t.lifecycle_state,'provisioned_at',t.provisioned_at,
   'administrator_configured',t.admin_user_id IS NOT NULL,
   'binding',(SELECT (to_jsonb(b) - 'id' - 'tenant_id') - CASE WHEN public.platform_can('billing.read') THEN ARRAY[]::text[] ELSE ARRAY['estimated_monthly_cost','cost_currency'] END FROM public.platform_tenant_bindings b WHERE b.tenant_id=t.id),
   'schema_ledger',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.applied_at DESC) FROM public.platform_tenant_schema_ledger l WHERE l.tenant_id=t.id),'[]'::jsonb),
   'latest_job',(SELECT to_jsonb(j) - 'configuration' - 'lease_token' FROM public.platform_jobs j WHERE j.tenant_id=t.id ORDER BY j.created_at DESC LIMIT 1),
   'steps',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at) FROM public.platform_job_steps s JOIN public.platform_jobs j ON j.id=s.job_id WHERE j.tenant_id=t.id),'[]'::jsonb),
   'readiness_blockers',public.platform_launch_blockers(t.id),
   'owner_approved',EXISTS(SELECT 1 FROM public.platform_launch_approvals a WHERE a.tenant_id=t.id AND a.revision=(SELECT revision FROM public.platform_onboarding_drafts d WHERE d.tenant_id=t.id))
 ) INTO v_result FROM public.platform_tenants t WHERE t.id=p_tenant_id;
 RETURN v_result;
END $$;
COMMIT;
