-- Platform only. Requires 025. Keep financial metadata behind billing permission.
-- RLS limits rows, not columns: hospital readers must not read cost columns directly.
BEGIN;
REVOKE SELECT ON public.platform_tenant_bindings FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,tenant_id,supabase_project_ref,supabase_url,vercel_project_id,
 vercel_project_name,deployment_id,deployment_url,domain,provider_status,
 health_status,admin_invitation_status,schema_version,schema_checksum,
 provisioned_at,last_sync_at,last_health_check_at,last_error,created_at,updated_at)
 ON public.platform_tenant_bindings TO authenticated;
-- Authorized financial access remains available through platform_hospital_status
-- and the billing-protected platform_tenant_costs table.
COMMIT;
