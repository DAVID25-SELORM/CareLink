-- Platform project only. Requires 018. Stores requested configuration, not deployed state.
BEGIN;
CREATE TABLE public.platform_onboarding_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL UNIQUE REFERENCES public.platform_tenants(id),
 revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
 step integer NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 7),
 requirements jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(requirements) = 'object'),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_onboarding_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_onboarding_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.platform_onboarding_drafts TO authenticated;
CREATE POLICY draft_read ON public.platform_onboarding_drafts FOR SELECT TO authenticated
 USING(public.platform_can('hospitals.read'));
CREATE TRIGGER draft_audit AFTER INSERT OR UPDATE ON public.platform_onboarding_drafts
 FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();

CREATE FUNCTION public.platform_save_onboarding_draft(p_tenant_id uuid,p_revision integer,p_step integer,p_requirements jsonb)
RETURNS public.platform_onboarding_drafts LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.platform_onboarding_drafts; k text;
BEGIN
 IF NOT public.platform_can('onboarding.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_step IS NULL OR p_step NOT BETWEEN 0 AND 7 THEN RAISE EXCEPTION 'Invalid draft revision or step'; END IF;
 IF p_requirements IS NULL OR jsonb_typeof(p_requirements)<>'object' OR octet_length(p_requirements::text)>24000 THEN RAISE EXCEPTION 'Invalid requirements'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_requirements) LOOP
   IF k NOT IN ('contact_phone','location','primary_color','secondary_color','target_date','notes','modules','training_notes','verification_notes') THEN RAISE EXCEPTION 'Unsupported requirement field'; END IF;
   IF k<>'modules' AND (jsonb_typeof(p_requirements->k)<>'string' OR length(p_requirements->>k)>4000) THEN RAISE EXCEPTION 'Invalid text field'; END IF;
 END LOOP;
 IF p_requirements ? 'modules' THEN
   IF jsonb_typeof(p_requirements->'modules')<>'array' THEN RAISE EXCEPTION 'Module list required'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_requirements->'modules') m WHERE jsonb_typeof(m)<>'string') THEN RAISE EXCEPTION 'Invalid module'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_requirements->'modules') m WHERE m NOT IN ('patients','appointments','laboratory','pharmacy','drug_management','billing','claims','reports','nurse_dashboard','records_dashboard','referrals')) THEN RAISE EXCEPTION 'Unknown module'; END IF;
 END IF;
 -- Serialize first saves as well as updates; no duplicate draft race.
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id AND lifecycle_state<>'archived' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
 SELECT * INTO d FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id;
 IF COALESCE(d.revision,0)<>p_revision THEN RAISE EXCEPTION 'Draft changed by another editor. Reload before saving.'; END IF;
 INSERT INTO public.platform_onboarding_drafts(tenant_id,step,requirements,updated_by)
 VALUES(p_tenant_id,p_step,p_requirements,auth.uid())
 ON CONFLICT(tenant_id) DO UPDATE SET revision=platform_onboarding_drafts.revision+1,
 step=EXCLUDED.step, requirements=EXCLUDED.requirements,updated_by=auth.uid(),updated_at=now()
 RETURNING * INTO d;
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.platform_save_onboarding_draft(uuid,integer,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_save_onboarding_draft(uuid,integer,integer,jsonb) TO authenticated;
COMMIT;
