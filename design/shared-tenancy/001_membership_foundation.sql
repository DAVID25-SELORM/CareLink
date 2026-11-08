-- DRAFT: isolated database validation only. Not a production rollout migration.
-- Requires platform_tenants and auth.users. Does not change clinical access.
BEGIN;
CREATE TABLE public.hospital_memberships (
 tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK(role IN ('admin','doctor','pharmacist','nurse','cashier','records_officer')),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id)
);
CREATE INDEX hospital_memberships_user ON public.hospital_memberships(user_id,tenant_id);
ALTER TABLE public.hospital_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hospital_memberships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hospital_memberships TO authenticated;
CREATE POLICY own_memberships ON public.hospital_memberships FOR SELECT TO authenticated
 USING(user_id=auth.uid());

-- Role comes from a protected membership, never a browser-supplied claim.
-- Lifecycle and instance checks fail closed. Shared mode is intentionally not
-- enabled here; the final conversion must introduce that mode explicitly.
CREATE FUNCTION public.hospital_role(p_tenant_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.role FROM public.hospital_memberships m
 JOIN public.platform_tenants t ON t.id=m.tenant_id
 WHERE m.user_id=auth.uid() AND m.tenant_id=p_tenant_id
 AND m.status='active' AND t.lifecycle_state='active'
 AND EXISTS(SELECT 1 FROM public.carelink_instance i
            WHERE i.singleton AND i.enabled AND i.instance_kind='shared');
$$;
REVOKE ALL ON FUNCTION public.hospital_role(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hospital_role(uuid) TO authenticated;
COMMIT;
