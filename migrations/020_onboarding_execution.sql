-- Platform project only. Requires 019. Apply separately from tenant migrations.
BEGIN;
ALTER TABLE public.platform_jobs ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.platform_jobs ADD COLUMN draft_revision integer;
ALTER TABLE public.platform_jobs ADD COLUMN configuration jsonb NOT NULL DEFAULT '{}';
CREATE TABLE public.platform_job_steps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.platform_jobs(id),
 name text NOT NULL, result jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id,name)
);
CREATE TABLE public.platform_launch_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 revision integer NOT NULL, kind text NOT NULL CHECK(kind IN ('deployment','isolation','admin_acceptance','account_protection','backup_restore','clinical','training','support')),
 reference text NOT NULL CHECK(length(trim(reference)) BETWEEN 5 AND 2000),
 actor_id uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,revision,kind)
);
CREATE TABLE public.platform_launch_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 revision integer NOT NULL, actor_id uuid NOT NULL REFERENCES auth.users(id),
 reason text NOT NULL CHECK(length(trim(reason))>=5), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,revision)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['platform_job_steps','platform_launch_evidence','platform_launch_approvals'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 EXECUTE format('CREATE POLICY execution_read ON public.%I FOR SELECT TO authenticated USING(public.platform_can(''hospitals.read''))',t);
 EXECUTE format('CREATE TRIGGER execution_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change()',t);
 END LOOP;
END $$;

-- Evaluate the original requester, never a browser-supplied role or worker JWT subject.
CREATE FUNCTION public.platform_actor_can(p_actor uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='platform') AND (
 EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=p_actor) OR EXISTS(
 SELECT 1 FROM public.platform_members WHERE user_id=p_actor AND status='active' AND CASE role
 WHEN 'platform_admin' THEN p_permission IN ('hospitals.write','onboarding.write')
 WHEN 'technical_admin' THEN p_permission IN ('onboarding.write','operations.write')
 WHEN 'finance_manager' THEN p_permission='billing.write' ELSE false END));
$$;
CREATE FUNCTION public.platform_launch_blockers(p_tenant uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.platform_tenants; d public.platform_onboarding_drafts; blockers text[] := '{}'; k text;
BEGIN
 SELECT * INTO t FROM public.platform_tenants WHERE id=p_tenant;
 SELECT * INTO d FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant;
 IF t.id IS NULL OR t.lifecycle_state='archived' THEN blockers:=array_append(blockers,'Hospital unavailable'); END IF;
 IF d.id IS NULL THEN blockers:=array_append(blockers,'Save requirements'); END IF;
 IF t.provisioned_at IS NULL THEN blockers:=array_append(blockers,'Provision workspace'); END IF;
 IF t.admin_user_id IS NULL THEN blockers:=array_append(blockers,'Set up administrator'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_subscriptions WHERE tenant_id=p_tenant AND status IN ('active','trialing') AND period_end+grace_days>=current_date) THEN blockers:=array_append(blockers,'Eligible subscription required'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.requirements->'modules','[]')) m WHERE NOT m=ANY(t.enabled_modules)) THEN blockers:=array_append(blockers,'Requested modules not confirmed'); END IF;
 FOREACH k IN ARRAY ARRAY['deployment','isolation','admin_acceptance','account_protection','backup_restore','clinical','training','support'] LOOP
 IF NOT EXISTS(SELECT 1 FROM public.platform_launch_evidence WHERE tenant_id=p_tenant AND revision=d.revision AND kind=k) THEN blockers:=array_append(blockers,'Evidence required: '||k); END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.platform_onboarding_tasks WHERE hospital_id=p_tenant AND status<>'completed') THEN blockers:=array_append(blockers,'Complete onboarding checklist'); END IF;
 RETURN blockers;
END $$;
CREATE FUNCTION public.platform_readiness(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.platform_can('hospitals.read') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 RETURN jsonb_build_object('blockers',public.platform_launch_blockers(p_tenant_id),'revision',(SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id));
END $$;
CREATE FUNCTION public.platform_record_evidence(p_tenant_id uuid,p_revision integer,p_kind text,p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.platform_can('onboarding.write') OR p_kind NOT IN ('clinical','training','support','backup_restore','account_protection') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id AND lifecycle_state<>'archived' FOR UPDATE;
 IF NOT FOUND OR p_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Reload the current requirements revision'; END IF;
 INSERT INTO public.platform_launch_evidence(tenant_id,revision,kind,reference,actor_id) VALUES(p_tenant_id,p_revision,p_kind,p_reference,auth.uid())
 ON CONFLICT(tenant_id,revision,kind) DO UPDATE SET reference=EXCLUDED.reference,actor_id=EXCLUDED.actor_id,created_at=now();
 DELETE FROM public.platform_launch_approvals WHERE tenant_id=p_tenant_id;
END $$;
CREATE FUNCTION public.platform_approve_launch(p_tenant_id uuid,p_revision integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Owner approval required'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id FOR UPDATE;
 IF p_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Requirements changed'; END IF;
 IF cardinality(public.platform_launch_blockers(p_tenant_id))>0 THEN RAISE EXCEPTION 'Resolve launch blockers first'; END IF;
 INSERT INTO public.platform_launch_approvals(tenant_id,revision,actor_id,reason) VALUES(p_tenant_id,p_revision,auth.uid(),p_reason)
 ON CONFLICT(tenant_id,revision) DO UPDATE SET actor_id=EXCLUDED.actor_id,reason=EXCLUDED.reason,created_at=now();
END $$;

CREATE FUNCTION public.platform_snapshot_job() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.platform_onboarding_drafts;
BEGIN
 IF NEW.tenant_id IS NOT NULL THEN
 SELECT * INTO d FROM public.platform_onboarding_drafts WHERE tenant_id=NEW.tenant_id;
 NEW.draft_revision:=d.revision; NEW.configuration:=COALESCE(d.requirements,'{}');
 IF NEW.kind IN ('provision','apply_modules','go_live') AND d.id IS NULL THEN RAISE EXCEPTION 'Save requirements before requesting this operation'; END IF;
 IF NEW.kind='go_live' AND (cardinality(public.platform_launch_blockers(NEW.tenant_id))>0 OR NOT EXISTS(SELECT 1 FROM public.platform_launch_approvals WHERE tenant_id=NEW.tenant_id AND revision=d.revision)) THEN RAISE EXCEPTION 'Launch evidence and owner approval required'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_job BEFORE INSERT ON public.platform_jobs FOR EACH ROW EXECUTE FUNCTION public.platform_snapshot_job();

CREATE FUNCTION public.platform_claim_job() RETURNS public.platform_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.platform_jobs; perm text;
BEGIN
 -- A transaction advisory lock serializes claim selection across workers, not execution.
 PERFORM pg_advisory_xact_lock(72819401);
 SELECT * INTO j FROM public.platform_jobs q WHERE
 ((q.status='queued' AND q.next_attempt_at<=now()) OR (q.status='running' AND q.lease_until<now()))
 AND NOT EXISTS(SELECT 1 FROM public.platform_jobs r WHERE r.tenant_id=q.tenant_id AND r.id<>q.id AND r.status='running' AND r.lease_until>=now())
 ORDER BY q.created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 perm:=CASE WHEN j.kind='invite_platform' THEN 'team.write' WHEN j.kind IN ('provision','invite_admin','apply_modules','go_live') THEN 'onboarding.write' ELSE 'operations.write' END;
 IF NOT public.platform_actor_can(j.requested_by,perm) OR
 (j.tenant_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.platform_tenants WHERE id=j.tenant_id AND lifecycle_state='archived')) OR
 (j.kind IN ('provision','apply_modules','go_live') AND j.draft_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=j.tenant_id)) THEN
 UPDATE public.platform_jobs SET status='blocked',error='Authorization or requirements changed; submit a new request',lease_token=null,lease_until=null WHERE id=j.id;
 RETURN NULL;
 END IF;
 IF j.kind='go_live' AND (cardinality(public.platform_launch_blockers(j.tenant_id))>0 OR NOT EXISTS(SELECT 1 FROM public.platform_launch_approvals WHERE tenant_id=j.tenant_id AND revision=j.draft_revision)) THEN
 UPDATE public.platform_jobs SET status='blocked',error='Launch approval is no longer valid' WHERE id=j.id; RETURN NULL;
 END IF;
 UPDATE public.platform_jobs SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',error=null WHERE id=j.id RETURNING * INTO j;
 RETURN j;
END $$;
CREATE FUNCTION public.platform_job_heartbeat(p_id uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.platform_jobs SET lease_until=now()+interval '90 seconds' WHERE id=p_id AND lease_token=p_token AND status='running' AND lease_until>now();
 RETURN FOUND;
END $$;
CREATE FUNCTION public.platform_checkpoint_job(p_id uuid,p_token uuid,p_name text,p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.platform_jobs WHERE id=p_id AND lease_token=p_token AND status='running' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lease lost'; END IF;
 IF p_name IS NULL OR length(p_name)>80 OR jsonb_typeof(p_result)<>'object' OR octet_length(p_result::text)>12000 THEN RAISE EXCEPTION 'Invalid checkpoint'; END IF;
 INSERT INTO public.platform_job_steps(job_id,name,result) VALUES(p_id,p_name,p_result) ON CONFLICT(job_id,name) DO NOTHING;
END $$;
CREATE FUNCTION public.platform_finish_job(p_id uuid,p_token uuid,p_status text,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.platform_jobs;
BEGIN
 SELECT * INTO j FROM public.platform_jobs WHERE id=p_id AND lease_token=p_token AND status='running' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lease lost'; END IF;
 IF p_status NOT IN ('succeeded','failed','blocked','queued') THEN RAISE EXCEPTION 'Invalid result'; END IF;
 UPDATE public.platform_jobs SET status=CASE WHEN p_status='queued' AND attempts>=6 THEN 'failed' ELSE p_status END,error=left(p_error,500),
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)),
 completed_at=CASE WHEN p_status='succeeded' THEN now() ELSE NULL END,lease_token=null,lease_until=null WHERE id=j.id;
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS sig,p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN
 ('platform_actor_can','platform_launch_blockers','platform_readiness','platform_record_evidence','platform_approve_launch','platform_snapshot_job','platform_claim_job','platform_job_heartbeat','platform_checkpoint_job','platform_finish_job') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 IF f.name IN ('platform_readiness','platform_record_evidence','platform_approve_launch') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig); END IF;
 IF f.name IN ('platform_claim_job','platform_job_heartbeat','platform_checkpoint_job','platform_finish_job') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig); END IF;
 END LOOP;
END $$;
GRANT SELECT ON public.platform_jobs,public.platform_job_steps,public.platform_tenants,public.platform_onboarding_drafts TO service_role;
COMMIT;
