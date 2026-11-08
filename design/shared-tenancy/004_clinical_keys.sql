-- DRAFT: core clinical key conversion. Apply only as part of the tested atomic
-- rollout; does not enable shared mode or replace existing role policies.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ DECLARE tab text; populated boolean; BEGIN
 FOREACH tab IN ARRAY ARRAY['patients','appointments','lab_tests','prescriptions','prescription_items','payments','referrals'] LOOP
  EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',tab);
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',tab) INTO populated;
  IF populated THEN RAISE EXCEPTION 'Explicit data mapping required for %',tab; END IF;
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid NOT NULL DEFAULT public.current_hospital_id() REFERENCES public.platform_tenants(id)',tab);
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE(tenant_id,id)',tab,tab||'_tenant_identity');
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  -- Restrictive boundary intersects legacy permissive rules, never broadens them.
  EXECUTE format('CREATE POLICY hospital_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(tenant_id=public.current_hospital_id()) WITH CHECK(tenant_id=public.current_hospital_id())',tab);
 END LOOP;
END $$;

-- Replace single-column foreign keys while preserving relationship names.
-- Composite SET NULL changes only the referenced column, never tenant_id.
DO $$ DECLARE f record; BEGIN
 FOR f IN
 SELECT c.conrelid::regclass AS child,c.confrelid::regclass AS parent,c.conname,c.confdeltype,a.attname AS child_column,b.attname AS parent_column
 FROM pg_constraint c
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
 JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=c.confkey[1]
 WHERE c.contype='f' AND cardinality(c.conkey)=1 AND cardinality(c.confkey)=1
 AND c.conrelid IN ('public.patients'::regclass,'public.appointments'::regclass,'public.lab_tests'::regclass,'public.prescriptions'::regclass,'public.prescription_items'::regclass,'public.payments'::regclass,'public.referrals'::regclass)
 AND c.confrelid IN ('public.patients'::regclass,'public.appointments'::regclass,'public.lab_tests'::regclass,'public.prescriptions'::regclass,'public.prescription_items'::regclass,'public.payments'::regclass,'public.referrals'::regclass)
 AND b.attname='id'
 LOOP
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',f.child,f.conname);
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY(tenant_id,%I) REFERENCES %s(tenant_id,%I) ON DELETE %s DEFERRABLE INITIALLY IMMEDIATE',f.child,f.conname,f.child_column,f.parent,f.parent_column,CASE f.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN format('SET NULL (%I)',f.child_column) WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END);
 END LOOP;
END $$;
COMMIT;
