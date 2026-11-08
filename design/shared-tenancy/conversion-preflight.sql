-- Preflight: refuse to run against anything but the expected pre-conversion state.
DO $$ DECLARE initial uuid := nullif(current_setting('carelink.initial_tenant_id',true),'')::uuid; bad text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='platform') THEN
  RAISE EXCEPTION 'Preflight: carelink_instance must be an enabled platform instance'; END IF;
 IF to_regclass('public.hospital_memberships') IS NOT NULL THEN
  RAISE EXCEPTION 'Preflight: hospital_memberships already exists (already converted or partially applied?)'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_tenants WHERE id=initial) THEN
  RAISE EXCEPTION 'Preflight: initial hospital % is not in platform_tenants',initial; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_jobs WHERE status IN ('queued','running')) THEN
  RAISE EXCEPTION 'Preflight: queued or running provisioning jobs exist; stop the worker and resolve them'; END IF;
 SELECT string_agg(DISTINCT role,', ') INTO bad FROM public.users
  WHERE role NOT IN ('admin','doctor','pharmacist','nurse','cashier','records_officer');
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Preflight: users have roles with no hospital-role mapping: %',bad; END IF;
 IF EXISTS(SELECT 1 FROM public.users u WHERE NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id=u.id)) THEN
  RAISE EXCEPTION 'Preflight: public.users rows without an auth identity'; END IF;
END $$;
