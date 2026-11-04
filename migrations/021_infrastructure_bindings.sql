-- Platform project only. Requires 020. Provider identifiers and verification state only; never store secrets.
BEGIN;
CREATE TABLE IF NOT EXISTS public.platform_tenant_bindings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL UNIQUE REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
 supabase_project_ref text CHECK(supabase_project_ref ~ '^[a-z0-9]{6,64}$'), supabase_url text,
 vercel_project_id text, vercel_project_name text, deployment_id text, deployment_url text, domain text,
 provider_status text NOT NULL DEFAULT 'pending' CHECK(provider_status IN ('pending','creating','ready','degraded','failed','blocked')),
 health_status text NOT NULL DEFAULT 'unknown' CHECK(health_status IN ('unknown','healthy','degraded','down')),
 admin_invitation_status text NOT NULL DEFAULT 'pending' CHECK(admin_invitation_status IN ('pending','requested','accepted','failed')),
 schema_version text, schema_checksum text CHECK(schema_checksum IS NULL OR schema_checksum ~ '^[a-f0-9]{64}$'),
 estimated_monthly_cost numeric(14,2) CHECK(estimated_monthly_cost IS NULL OR estimated_monthly_cost>=0), cost_currency text CHECK(cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$'),
 provisioned_at timestamptz, last_sync_at timestamptz, last_health_check_at timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.platform_tenant_schema_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
 migration_name text NOT NULL, checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'), status text NOT NULL CHECK(status IN ('applied','failed')),
 applied_at timestamptz NOT NULL DEFAULT now(), error text, UNIQUE(tenant_id,migration_name)
);
CREATE TABLE IF NOT EXISTS public.platform_tenant_costs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('supabase','vercel','other')), period_start date NOT NULL,
 amount numeric(14,2) NOT NULL CHECK(amount>=0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), source text NOT NULL,
 measured_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,provider,period_start)
);
CREATE INDEX IF NOT EXISTS platform_bindings_status_idx ON public.platform_tenant_bindings(provider_status,health_status,last_sync_at);
CREATE INDEX IF NOT EXISTS platform_schema_ledger_tenant_idx ON public.platform_tenant_schema_ledger(tenant_id,applied_at DESC);
ALTER TABLE public.platform_tenant_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_schema_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_tenant_bindings,public.platform_tenant_schema_ledger,public.platform_tenant_costs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_tenant_bindings,public.platform_tenant_schema_ledger,public.platform_tenant_costs TO authenticated;
DROP POLICY IF EXISTS binding_read ON public.platform_tenant_bindings;
DROP POLICY IF EXISTS schema_ledger_read ON public.platform_tenant_schema_ledger;
CREATE POLICY binding_read ON public.platform_tenant_bindings FOR SELECT TO authenticated USING(public.platform_can('hospitals.read'));
CREATE POLICY schema_ledger_read ON public.platform_tenant_schema_ledger FOR SELECT TO authenticated USING(public.platform_can('hospitals.read'));
DROP POLICY IF EXISTS cost_read ON public.platform_tenant_costs;
CREATE POLICY cost_read ON public.platform_tenant_costs FOR SELECT TO authenticated USING(public.platform_can('billing.read'));
DROP TRIGGER IF EXISTS binding_audit ON public.platform_tenant_bindings;
CREATE TRIGGER binding_audit AFTER INSERT OR UPDATE ON public.platform_tenant_bindings FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();

CREATE OR REPLACE FUNCTION public.platform_hospital_status(p_tenant_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
   'tenant_id',t.id,'registration_status',t.status,'lifecycle_state',t.lifecycle_state,'provisioned_at',t.provisioned_at,
   'administrator_configured',t.admin_user_id IS NOT NULL,
   'binding',(SELECT to_jsonb(b) - 'id' - 'tenant_id' FROM public.platform_tenant_bindings b WHERE b.tenant_id=t.id),
   'schema_ledger',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.applied_at DESC) FROM public.platform_tenant_schema_ledger l WHERE l.tenant_id=t.id),'[]'::jsonb),
   'latest_job',(SELECT to_jsonb(j) - 'configuration' - 'lease_token' FROM public.platform_jobs j WHERE j.tenant_id=t.id ORDER BY j.created_at DESC LIMIT 1),
   'steps',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at) FROM public.platform_job_steps s JOIN public.platform_jobs j ON j.id=s.job_id WHERE j.tenant_id=t.id),'[]'::jsonb),
   'readiness_blockers',public.platform_launch_blockers(t.id),
   'owner_approved',EXISTS(SELECT 1 FROM public.platform_launch_approvals a WHERE a.tenant_id=t.id AND a.revision=(SELECT revision FROM public.platform_onboarding_drafts d WHERE d.tenant_id=t.id))
 ) FROM public.platform_tenants t WHERE t.id=p_tenant_id;
$$;

CREATE OR REPLACE FUNCTION public.platform_record_binding(p_tenant_id uuid,p_state jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ref text; v_url text; v_checksum text; k text;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 IF p_state IS NULL OR jsonb_typeof(p_state)<>'object' OR octet_length(p_state::text)>12000 THEN RAISE EXCEPTION 'Invalid binding'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_state) LOOP
   IF k NOT IN ('supabase_project_ref','supabase_url','vercel_project_id','vercel_project_name','deployment_id','deployment_url','domain','provider_status','health_status','admin_invitation_status','schema_version','schema_checksum','estimated_monthly_cost','cost_currency','provisioned_at','last_error') THEN RAISE EXCEPTION 'Unsupported binding field'; END IF;
 END LOOP;
 v_ref:=p_state->>'supabase_project_ref'; v_url:=p_state->>'supabase_url'; v_checksum:=p_state->>'schema_checksum';
 IF v_ref IS NOT NULL AND v_ref !~ '^[a-z0-9]{6,64}$' THEN RAISE EXCEPTION 'Invalid Supabase project reference'; END IF;
 IF v_checksum IS NOT NULL AND v_checksum !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid schema checksum'; END IF;
 INSERT INTO public.platform_tenant_bindings(tenant_id,supabase_project_ref,supabase_url,vercel_project_id,vercel_project_name,deployment_id,deployment_url,domain,provider_status,health_status,admin_invitation_status,schema_version,schema_checksum,estimated_monthly_cost,cost_currency,provisioned_at,last_sync_at,last_error)
 SELECT p_tenant_id,v_ref,p_state->>'supabase_url',p_state->>'vercel_project_id',p_state->>'vercel_project_name',p_state->>'deployment_id',p_state->>'deployment_url',p_state->>'domain',COALESCE(p_state->>'provider_status','pending'),COALESCE(p_state->>'health_status','unknown'),COALESCE(p_state->>'admin_invitation_status','pending'),p_state->>'schema_version',v_checksum,(p_state->>'estimated_monthly_cost')::numeric,p_state->>'cost_currency',(p_state->>'provisioned_at')::timestamptz,now(),left(p_state->>'last_error',500)
 ON CONFLICT(tenant_id) DO UPDATE SET supabase_project_ref=COALESCE(EXCLUDED.supabase_project_ref,platform_tenant_bindings.supabase_project_ref),supabase_url=COALESCE(EXCLUDED.supabase_url,platform_tenant_bindings.supabase_url),vercel_project_id=COALESCE(EXCLUDED.vercel_project_id,platform_tenant_bindings.vercel_project_id),vercel_project_name=COALESCE(EXCLUDED.vercel_project_name,platform_tenant_bindings.vercel_project_name),deployment_id=COALESCE(EXCLUDED.deployment_id,platform_tenant_bindings.deployment_id),deployment_url=COALESCE(EXCLUDED.deployment_url,platform_tenant_bindings.deployment_url),domain=COALESCE(EXCLUDED.domain,platform_tenant_bindings.domain),provider_status=COALESCE(EXCLUDED.provider_status,platform_tenant_bindings.provider_status),health_status=COALESCE(EXCLUDED.health_status,platform_tenant_bindings.health_status),admin_invitation_status=COALESCE(EXCLUDED.admin_invitation_status,platform_tenant_bindings.admin_invitation_status),schema_version=COALESCE(EXCLUDED.schema_version,platform_tenant_bindings.schema_version),schema_checksum=COALESCE(EXCLUDED.schema_checksum,platform_tenant_bindings.schema_checksum),estimated_monthly_cost=COALESCE(EXCLUDED.estimated_monthly_cost,platform_tenant_bindings.estimated_monthly_cost),cost_currency=COALESCE(EXCLUDED.cost_currency,platform_tenant_bindings.cost_currency),provisioned_at=COALESCE(EXCLUDED.provisioned_at,platform_tenant_bindings.provisioned_at),last_sync_at=now(),last_error=COALESCE(EXCLUDED.last_error,platform_tenant_bindings.last_error),updated_at=now();
 IF COALESCE(p_state->>'provider_status','')='ready' THEN UPDATE public.platform_tenants SET provisioned_at=COALESCE(provisioned_at,now()),status=CASE WHEN status IN ('lead','intake','provisioning') THEN 'training' ELSE status END,updated_at=now() WHERE id=p_tenant_id; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.platform_record_schema(p_tenant_id uuid,p_name text,p_checksum text,p_status text,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 160 OR p_checksum !~ '^[a-f0-9]{64}$' OR p_status NOT IN ('applied','failed') THEN RAISE EXCEPTION 'Invalid schema record'; END IF;
 INSERT INTO public.platform_tenant_schema_ledger(tenant_id,migration_name,checksum,status,error) VALUES(p_tenant_id,trim(p_name),p_checksum,p_status,left(p_error,500)) ON CONFLICT(tenant_id,migration_name) DO UPDATE SET checksum=EXCLUDED.checksum,status=EXCLUDED.status,error=EXCLUDED.error,applied_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.platform_record_health(p_tenant_id uuid,p_status text,p_latency integer,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' OR p_status NOT IN ('healthy','degraded','down') THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 INSERT INTO public.platform_health_checks(tenant_id,service,status,latency_ms,detail,created_at) VALUES(p_tenant_id,'provisioning',p_status, greatest(p_latency,0),left(COALESCE(p_error,''),500),now());
 UPDATE public.platform_tenant_bindings SET health_status=p_status,last_health_check_at=now(),last_sync_at=now(),last_error=left(p_error,500),updated_at=now() WHERE tenant_id=p_tenant_id;
END $$;
CREATE OR REPLACE FUNCTION public.platform_record_cost(p_tenant_id uuid,p_provider text,p_period date,p_amount numeric,p_currency text,p_source text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' OR p_provider NOT IN ('supabase','vercel','other') OR p_amount<0 OR p_currency !~ '^[A-Z]{3}$' OR length(trim(p_source))<2 THEN RAISE EXCEPTION 'Invalid cost record'; END IF;
 INSERT INTO public.platform_tenant_costs(tenant_id,provider,period_start,amount,currency,source) VALUES(p_tenant_id,p_provider,COALESCE(p_period,current_date),p_amount,p_currency,trim(p_source)) ON CONFLICT(tenant_id,provider,period_start) DO UPDATE SET amount=EXCLUDED.amount,currency=EXCLUDED.currency,source=EXCLUDED.source,measured_at=now();
 UPDATE public.platform_tenant_bindings SET estimated_monthly_cost=(SELECT sum(amount) FROM public.platform_tenant_costs WHERE tenant_id=p_tenant_id AND period_start=date_trunc('month',COALESCE(p_period,current_date))::date),cost_currency=p_currency,updated_at=now() WHERE tenant_id=p_tenant_id;
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('platform_record_binding','platform_record_schema','platform_record_health','platform_record_cost') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig); END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON public.platform_health_checks TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.platform_tenant_costs TO service_role;
COMMIT;
