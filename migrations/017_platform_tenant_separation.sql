-- Apply after existing CareLink module migrations, on EVERY dedicated project.
-- Defaults to a tenant instance. See PLATFORM_TENANT_SETUP.md for owner bootstrap.
BEGIN;

CREATE TABLE IF NOT EXISTS public.carelink_instance (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  instance_kind text NOT NULL DEFAULT 'tenant' CHECK (instance_kind IN ('platform', 'tenant')),
  enabled boolean NOT NULL DEFAULT true
);
INSERT INTO public.carelink_instance(singleton) VALUES (true) ON CONFLICT DO NOTHING;

-- Deliberately independent of public.users, hospital membership and tenant roles.
CREATE TABLE IF NOT EXISTS public.platform_owners (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.carelink_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.carelink_instance, public.platform_owners FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_owners p, public.carelink_instance i
    WHERE p.user_id = auth.uid() AND i.singleton AND i.enabled AND i.instance_kind = 'platform'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u, public.carelink_instance i
    WHERE u.id = auth.uid() AND i.singleton AND i.enabled AND i.instance_kind = 'tenant'
      AND NOT EXISTS (SELECT 1 FROM public.platform_owners p WHERE p.user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_tenant_user() AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_carelink_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN public.is_platform_owner() THEN jsonb_build_object('role', 'platform_owner', 'scope', 'platform')
    WHEN public.is_tenant_user() THEN (
      SELECT jsonb_build_object('role', role, 'scope', 'tenant') FROM public.users WHERE id = auth.uid()
    )
    ELSE jsonb_build_object('role', null, 'scope', null)
  END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_owner(), public.is_tenant_user(), public.is_tenant_admin(), public.get_carelink_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(), public.is_tenant_user(), public.is_tenant_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_carelink_access() TO authenticated;

-- Separate directory from hospitals (which is also used by clinical/FHIR modules).
CREATE TABLE IF NOT EXISTS public.platform_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_name text NOT NULL,
  branch_location text,
  contact_person text,
  contact_phone text,
  contact_email text,
  owner_full_name text,
  owner_email text NOT NULL,
  owner_phone text,
  public_url text,
  primary_color text,
  secondary_color text,
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','intake','provisioning','training','ready_for_go_live','live','paused')),
  go_live_date date,
  enabled_modules text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.platform_onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('intake','technical','database','accounts','branding','go_live','security','handover')),
  task_name text NOT NULL,
  task_details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','blocked')),
  due_date date,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_tasks_hospital_idx ON public.platform_onboarding_tasks(hospital_id);

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.platform_audit_log TO authenticated;
DROP POLICY IF EXISTS platform_audit_read ON public.platform_audit_log;
CREATE POLICY platform_audit_read ON public.platform_audit_log FOR SELECT TO authenticated USING (public.is_platform_owner());

CREATE OR REPLACE FUNCTION public.audit_platform_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.platform_audit_log(actor_id,table_name,operation,record_id,old_values,new_values)
  VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.audit_platform_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS platform_tenants_audit ON public.platform_tenants;
CREATE TRIGGER platform_tenants_audit AFTER INSERT OR UPDATE OR DELETE ON public.platform_tenants
  FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();
DROP TRIGGER IF EXISTS platform_tasks_audit ON public.platform_onboarding_tasks;
CREATE TRIGGER platform_tasks_audit AFTER INSERT OR UPDATE OR DELETE ON public.platform_onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();

-- Restrictive policies AND with existing policies, so broad legacy grants cannot
-- cross the platform/tenant boundary. Existing clinical role policies stay intact.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename NOT IN ('carelink_instance', 'platform_owners', 'platform_tenants', 'platform_onboarding_tasks', 'platform_audit_log')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS carelink_tenant_boundary ON public.%I', t.tablename);
    EXECUTE format('CREATE POLICY carelink_tenant_boundary ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (public.is_tenant_user()) WITH CHECK (public.is_tenant_user())', t.tablename);
  END LOOP;

  FOR t IN SELECT unnest(ARRAY['platform_tenants', 'platform_onboarding_tasks']) AS tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS platform_owner_access ON public.%I', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS platform_owner_boundary ON public.%I', t.tablename);
    EXECUTE format('CREATE POLICY platform_owner_access ON public.%I FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner())', t.tablename);
    EXECUTE format('CREATE POLICY platform_owner_boundary ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner())', t.tablename);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
  END LOOP;

  -- Owner-executed views must also respect underlying table RLS (Postgres 15+).
  FOR t IN SELECT viewname FROM pg_views WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', t.viewname);
  END LOOP;
END $$;

-- No self-registration or self-promotion through permissive legacy user policies.
DROP POLICY IF EXISTS carelink_users_insert_admin ON public.users;
CREATE POLICY carelink_users_insert_admin ON public.users AS RESTRICTIVE
  FOR INSERT TO PUBLIC WITH CHECK (public.is_tenant_admin());
DROP POLICY IF EXISTS carelink_users_update_admin ON public.users;
CREATE POLICY carelink_users_update_admin ON public.users AS RESTRICTIVE
  FOR UPDATE TO PUBLIC USING (public.is_tenant_admin()) WITH CHECK (public.is_tenant_admin());
DROP POLICY IF EXISTS carelink_users_delete_admin ON public.users;
CREATE POLICY carelink_users_delete_admin ON public.users AS RESTRICTIVE
  FOR DELETE TO PUBLIC USING (public.is_tenant_admin());

-- Legacy onboarding belongs to the platform too. Do not expose it in tenant projects.
DO $$
BEGIN
  IF to_regclass('public.hospital_onboarding_tasks') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS carelink_legacy_onboarding_boundary ON public.hospital_onboarding_tasks';
    EXECUTE 'CREATE POLICY carelink_legacy_onboarding_boundary ON public.hospital_onboarding_tasks AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)';
  END IF;
END $$;

COMMIT;
