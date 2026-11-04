-- Platform project only. Requires 021. Activate the cost-read policy.
BEGIN;
ALTER TABLE public.platform_tenant_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cost_read ON public.platform_tenant_costs;
CREATE POLICY cost_read ON public.platform_tenant_costs
  FOR SELECT TO authenticated USING (public.platform_can('billing.read'));
REVOKE INSERT, UPDATE, DELETE ON public.platform_tenant_costs FROM authenticated;
GRANT SELECT ON public.platform_tenant_costs TO authenticated;
COMMIT;
