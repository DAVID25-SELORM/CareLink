-- DRAFT: disposable validation only. Requires 001/002 and is_platform_owner().
-- The production conversion must preserve platform owner identity in shared mode.
BEGIN;
CREATE TABLE public.hospital_membership_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 old_role text, old_status text, new_role text NOT NULL, new_status text NOT NULL,
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hospital_membership_audit_tenant ON public.hospital_membership_audit(tenant_id,created_at);
ALTER TABLE public.hospital_membership_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hospital_membership_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hospital_membership_audit TO authenticated;
CREATE POLICY membership_audit_read ON public.hospital_membership_audit FOR SELECT TO authenticated
 USING(public.is_platform_owner() OR
 (tenant_id=public.current_hospital_id() AND public.hospital_role(tenant_id)='admin'));

CREATE FUNCTION public.hospital_set_member(p_tenant_id uuid,p_user_id uuid,p_role text,p_status text,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.hospital_memberships;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='shared')
 THEN RAISE EXCEPTION 'Shared workspace unavailable'; END IF;
 -- Serialize authorization and last-administrator checks for this hospital.
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id AND lifecycle_state<>'archived' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
 IF NOT COALESCE(public.is_platform_owner(),false) AND NOT COALESCE(
   public.current_hospital_id()=p_tenant_id AND public.hospital_role(p_tenant_id)='admin',false)
 THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('admin','doctor','pharmacist','nurse','cashier','records_officer')
 OR p_status IS NULL OR p_status NOT IN ('active','suspended')
 OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 1000
 THEN RAISE EXCEPTION 'Valid role, status and reason required'; END IF;
 SELECT * INTO previous FROM public.hospital_memberships WHERE tenant_id=p_tenant_id AND user_id=p_user_id;
 IF previous.role='admin' AND previous.status='active' AND (p_role<>'admin' OR p_status<>'active')
 AND NOT EXISTS(SELECT 1 FROM public.hospital_memberships WHERE tenant_id=p_tenant_id
 AND user_id<>p_user_id AND role='admin' AND status='active')
 THEN RAISE EXCEPTION 'Assign another active administrator first'; END IF;
 INSERT INTO public.hospital_memberships(tenant_id,user_id,role,status)
 VALUES(p_tenant_id,p_user_id,p_role,p_status)
 ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=EXCLUDED.role,status=EXCLUDED.status;
 INSERT INTO public.hospital_membership_audit(tenant_id,actor_id,user_id,old_role,old_status,new_role,new_status,reason)
 VALUES(p_tenant_id,auth.uid(),p_user_id,previous.role,previous.status,p_role,p_status,trim(p_reason));
END $$;
REVOKE ALL ON FUNCTION public.hospital_set_member(uuid,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hospital_set_member(uuid,uuid,text,text,text) TO authenticated;
COMMIT;
