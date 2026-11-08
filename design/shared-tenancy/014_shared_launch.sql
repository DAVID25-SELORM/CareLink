-- DRAFT: shared launch retains evidence, subscription and explicit owner gates.
BEGIN;
ALTER FUNCTION public.platform_launch_blockers(uuid) RENAME TO platform_dedicated_launch_blockers;
CREATE FUNCTION public.platform_launch_blockers(p_tenant uuid) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.platform_tenants; d public.platform_onboarding_drafts; result text[]:='{}'; k text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared')
 THEN RETURN public.platform_dedicated_launch_blockers(p_tenant); END IF;
 SELECT * INTO t FROM public.platform_tenants WHERE id=p_tenant;
 SELECT * INTO d FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant;
 IF t.id IS NULL OR t.lifecycle_state IN ('archived','suspended') THEN result:=array_append(result,'Hospital unavailable'); END IF;
 IF d.id IS NULL THEN result:=array_append(result,'Save requirements'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.hospitals WHERE id=p_tenant AND tenant_id=p_tenant)
 OR NOT EXISTS(SELECT 1 FROM public.hospital_profile WHERE tenant_id=p_tenant) THEN result:=array_append(result,'Prepare shared workspace'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_hospital_invitations i JOIN public.hospital_memberships m ON m.tenant_id=i.tenant_id AND m.user_id=i.accepted_by
 WHERE i.tenant_id=p_tenant AND i.revision=d.revision AND i.accepted_at IS NOT NULL AND i.accepted_by=t.admin_user_id
 AND i.email=lower(trim(t.owner_email)) AND m.status='active' AND m.role='admin') THEN result:=array_append(result,'Administrator must accept current invitation'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_subscriptions s JOIN public.platform_plans p ON p.id=s.plan_id
 WHERE s.tenant_id=p_tenant AND s.status IN ('active','trialing') AND s.period_end+s.grace_days>=current_date AND p.active)
 THEN result:=array_append(result,'Eligible subscription required'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.requirements->'modules','[]')) requested
 WHERE NOT EXISTS(SELECT 1 FROM public.platform_subscriptions s JOIN public.platform_plans p ON p.id=s.plan_id
 WHERE s.tenant_id=p_tenant AND requested=ANY(p.modules))) THEN result:=array_append(result,'Requested modules exceed licensed plan'); END IF;
 FOREACH k IN ARRAY ARRAY['deployment','isolation','admin_acceptance','account_protection','backup_restore','clinical','training','support'] LOOP
 IF NOT EXISTS(SELECT 1 FROM public.platform_launch_evidence WHERE tenant_id=p_tenant AND revision=d.revision AND kind=k)
 THEN result:=array_append(result,'Evidence required: '||k); END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.platform_onboarding_tasks WHERE hospital_id=p_tenant AND status<>'completed') THEN result:=array_append(result,'Complete onboarding checklist'); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.platform_launch_blockers(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.platform_record_shared_verification(p_tenant_id uuid,p_revision integer,p_kind text,p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_platform_owner() OR NOT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared')
 OR p_kind IS NULL OR p_kind NOT IN ('deployment','isolation') THEN RAISE EXCEPTION 'Owner verification required'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id AND lifecycle_state NOT IN ('archived','suspended') FOR UPDATE;
 IF NOT FOUND OR p_revision IS NULL OR p_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id)
 THEN RAISE EXCEPTION 'Requirements changed'; END IF;
 INSERT INTO public.platform_launch_evidence(tenant_id,revision,kind,reference,actor_id)
 VALUES(p_tenant_id,p_revision,p_kind,p_reference,auth.uid())
 ON CONFLICT(tenant_id,revision,kind) DO UPDATE SET reference=EXCLUDED.reference,actor_id=EXCLUDED.actor_id,created_at=now();
 DELETE FROM public.platform_launch_approvals WHERE tenant_id=p_tenant_id;
END $$;

CREATE FUNCTION public.platform_launch_shared_hospital(p_tenant_id uuid,p_revision integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE requested text[];
BEGIN
 IF NOT public.is_platform_owner() OR NOT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared')
 THEN RAISE EXCEPTION 'Owner permission required'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id FOR UPDATE;
 IF NOT FOUND OR p_revision IS NULL OR p_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id)
 THEN RAISE EXCEPTION 'Requirements changed'; END IF;
 -- Lock entitlement rows while verifying and applying requested modules.
 PERFORM 1 FROM public.platform_subscriptions s JOIN public.platform_plans p ON p.id=s.plan_id WHERE s.tenant_id=p_tenant_id FOR SHARE OF s,p;
 IF cardinality(public.platform_launch_blockers(p_tenant_id))>0 THEN RAISE EXCEPTION 'Resolve launch blockers first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_launch_approvals a JOIN public.platform_owners o ON o.user_id=a.actor_id WHERE a.tenant_id=p_tenant_id AND a.revision=p_revision)
 THEN RAISE EXCEPTION 'Current owner approval required'; END IF;
 SELECT COALESCE(array_agg(value),'{}') INTO requested FROM public.platform_onboarding_drafts d,
 jsonb_array_elements_text(COALESCE(d.requirements->'modules','[]')) WHERE d.tenant_id=p_tenant_id;
 UPDATE public.platform_tenants SET lifecycle_state='active',status='live',enabled_modules=requested,provisioned_at=COALESCE(provisioned_at,now()),updated_at=now() WHERE id=p_tenant_id;
 UPDATE public.hospitals SET status='live',enabled_modules=requested,go_live_date=COALESCE(go_live_date,current_date) WHERE id=p_tenant_id AND tenant_id=p_tenant_id;
END $$;
REVOKE ALL ON FUNCTION public.platform_record_shared_verification(uuid,integer,text,text),public.platform_launch_shared_hospital(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_record_shared_verification(uuid,integer,text,text),public.platform_launch_shared_hospital(uuid,integer) TO authenticated;
COMMIT;
