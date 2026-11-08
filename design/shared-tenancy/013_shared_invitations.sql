-- DRAFT: identity-bound administrator invitations. No mail or provider creation.
BEGIN;
CREATE TABLE public.platform_hospital_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 email text NOT NULL, revision integer NOT NULL, invited_by uuid NOT NULL REFERENCES auth.users(id),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 accepted_by uuid REFERENCES auth.users(id), accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,revision,email)
);
ALTER TABLE public.platform_hospital_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_hospital_invitations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_hospital_invitations TO authenticated;
CREATE POLICY invitation_operator_read ON public.platform_hospital_invitations FOR SELECT TO authenticated
 USING(public.platform_can('onboarding.write'));
CREATE TRIGGER invitation_audit AFTER INSERT OR UPDATE ON public.platform_hospital_invitations
 FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();

CREATE FUNCTION public.platform_invite_shared_administrator(p_tenant_id uuid,p_revision integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.platform_tenants; invitation uuid;
BEGIN
 IF NOT public.is_platform_owner() OR NOT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared')
 THEN RAISE EXCEPTION 'Owner permission required'; END IF;
 SELECT * INTO t FROM public.platform_tenants WHERE id=p_tenant_id FOR UPDATE;
 IF NOT FOUND OR t.lifecycle_state IN ('archived','suspended') THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
 IF p_revision IS NULL OR p_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=t.id)
 THEN RAISE EXCEPTION 'Requirements changed'; END IF;
 IF t.owner_email IS NULL OR t.owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Valid administrator email required'; END IF;
 INSERT INTO public.platform_hospital_invitations(tenant_id,email,revision,invited_by)
 VALUES(t.id,lower(trim(t.owner_email)),p_revision,auth.uid())
 ON CONFLICT(tenant_id,revision,email) DO UPDATE SET
 expires_at=CASE WHEN platform_hospital_invitations.accepted_at IS NULL THEN now()+interval '7 days' ELSE platform_hospital_invitations.expires_at END,
 invited_by=EXCLUDED.invited_by RETURNING id INTO invitation;
 RETURN invitation;
END $$;

CREATE FUNCTION public.hospital_pending_invitations() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'hospital_name',t.hospital_name)),'[]'::jsonb)
 FROM public.platform_hospital_invitations i JOIN public.platform_tenants t ON t.id=i.tenant_id
 JOIN auth.users u ON u.id=auth.uid() AND lower(u.email)=i.email AND u.email_confirmed_at IS NOT NULL
 WHERE i.accepted_at IS NULL AND i.expires_at>now() AND t.lifecycle_state NOT IN ('archived','suspended')
 AND i.revision=(SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=t.id)
 AND EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared');
$$;

CREATE FUNCTION public.hospital_accept_invitation(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.platform_hospital_invitations; t public.platform_tenants; recipient auth.users;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared') THEN RAISE EXCEPTION 'Shared workspace unavailable'; END IF;
 -- Same tenant-first lock order as invitation creation and membership commands.
 SELECT * INTO t FROM public.platform_tenants WHERE id=(SELECT tenant_id FROM public.platform_hospital_invitations WHERE id=p_id) FOR UPDATE;
 SELECT * INTO i FROM public.platform_hospital_invitations WHERE id=p_id FOR UPDATE;
 SELECT * INTO recipient FROM auth.users WHERE id=auth.uid();
 IF i.id IS NULL OR recipient.id IS NULL OR recipient.email_confirmed_at IS NULL OR lower(recipient.email) IS DISTINCT FROM i.email
 OR t.lifecycle_state IN ('archived','suspended') OR lower(trim(t.owner_email)) IS DISTINCT FROM i.email
 OR i.revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=t.id)
 OR NOT EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=i.invited_by)
 THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 IF i.accepted_by=auth.uid() THEN RETURN; END IF;
 IF i.accepted_at IS NOT NULL OR i.expires_at<=now() THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 -- Never reactivate suspended access or overwrite another membership role.
 IF EXISTS(SELECT 1 FROM public.hospital_memberships WHERE tenant_id=t.id AND user_id=auth.uid() AND (role<>'admin' OR status<>'active'))
 THEN RAISE EXCEPTION 'Existing membership requires administrator review'; END IF;
 INSERT INTO public.users(id,email,role,full_name) VALUES(recipient.id,recipient.email,'admin',recipient.email) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.hospital_memberships(tenant_id,user_id,role) VALUES(t.id,recipient.id,'admin') ON CONFLICT DO NOTHING;
 INSERT INTO public.hospital_membership_audit(tenant_id,actor_id,user_id,new_role,new_status,reason)
 VALUES(t.id,recipient.id,recipient.id,'admin','active','Accepted owner-issued administrator invitation');
 UPDATE public.platform_hospital_invitations SET accepted_by=recipient.id,accepted_at=now() WHERE id=i.id;
 UPDATE public.platform_tenants SET admin_user_id=recipient.id WHERE id=t.id;
 DELETE FROM public.platform_launch_approvals WHERE tenant_id=t.id;
END $$;
REVOKE ALL ON FUNCTION public.platform_invite_shared_administrator(uuid,integer),public.hospital_pending_invitations(),public.hospital_accept_invitation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_invite_shared_administrator(uuid,integer),public.hospital_pending_invitations(),public.hospital_accept_invitation(uuid) TO authenticated;
COMMIT;
