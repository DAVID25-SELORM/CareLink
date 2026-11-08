-- DRAFT: full hospital key coverage; requires 001 through 006.
-- Explicitly set carelink.initial_tenant_id to the registry hospital owning the
-- retained catalog/configuration rows. Does not enable shared mode.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TEMP TABLE hospital_key_manifest(tab text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO hospital_key_manifest SELECT unnest(ARRAY['admissions','ai_suggestions','allergies','ambulance_dispatches','ambulance_fleet','anc_registrations','anc_visits','audit_log','beds','billing_items','blood_donations','blood_inventory','blood_requests','claim_batches','claim_items','claims','clinical_notes','clinical_orders','consent_records','controlled_substance_log','data_access_log','deliveries','dental_records','dhims2_indicator_mappings','dhims2_reports','diagnoses','diet_orders','discharge_summaries','drug_batches','drug_interactions','drugs','encounters','fee_schedules','fhir_endpoint_config','fhir_resource_log','fluid_balance_charts','handover_notes','hospital_departments','hospital_onboarding_tasks','hospital_profile','hospitals','hr_attendance','hr_leaves','hr_payroll','hr_staff','integration_endpoints','inventory_categories','inventory_items','inventory_transactions','lab_panels','lab_specimens','lab_test_catalog','leave_requests','maternity_deliveries','medical_records','medication_administration_records','mortuary_records','nhia_submissions','nhia_tariff_catalog','nhis_cc_codes','notification_logs','notification_settings','notification_templates','notifications','nurse_notes','nursing_assessments','nursing_care_plans','offline_cache_manifest','patient_transfers','patient_vitals','payment_allocations','physiotherapy_sessions','postnatal_visits','problem_list','purchase_order_items','purchase_orders','queue_management','radiology_orders','radiology_results','receipts','record_requests','registered_devices','report_runs','report_templates','service_fees','staff_schedules','suppliers','surgical_procedures','sync_checkpoints','sync_conflicts','sync_queue','theatre_bookings','theatre_operation_notes','theatre_post_op','theatre_pre_op','theatre_sessions','triage_assessments','user_sessions','virtual_consultations','vitals','ward_rounds','wards']);
DO $$ DECLARE t record; populated boolean; initial uuid := nullif(current_setting('carelink.initial_tenant_id',true),'')::uuid; pk text; BEGIN
 IF initial IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_tenants WHERE id=initial) THEN RAISE EXCEPTION 'Explicit initial hospital mapping required'; END IF;
 FOR t IN SELECT tab FROM hospital_key_manifest ORDER BY tab LOOP
  EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t.tab);
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t.tab) INTO populated;
  IF populated AND t.tab<>ALL(ARRAY['audit_log','blood_inventory','drugs','hospital_profile','inventory_categories','lab_panels','lab_test_catalog','service_fees']) THEN RAISE EXCEPTION 'New data requires explicit mapping: %',t.tab; END IF;
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid REFERENCES public.platform_tenants(id)',t.tab);
  EXECUTE format('UPDATE public.%I SET tenant_id=$1',t.tab) USING initial;
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT public.current_hospital_id()',t.tab);
  IF t.tab='hospital_profile' THEN
   SELECT conname INTO pk FROM pg_constraint WHERE conrelid='public.hospital_profile'::regclass AND contype='p';
   EXECUTE format('ALTER TABLE public.hospital_profile DROP CONSTRAINT %I',pk);
   ALTER TABLE public.hospital_profile ADD PRIMARY KEY(tenant_id);
  ELSE
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE(tenant_id,id)',t.tab,t.tab||'_tenant_identity');
  END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tab);
  EXECUTE format('CREATE POLICY hospital_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(tenant_id=public.current_hospital_id()) WITH CHECK(tenant_id=public.current_hospital_id())',t.tab);
 END LOOP;
END $$;
-- Include the seven core tables when bridging relationships between modules.
INSERT INTO hospital_key_manifest SELECT unnest(ARRAY['patients','appointments','lab_tests','prescriptions','prescription_items','payments','referrals']);
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT c.conrelid::regclass AS child,c.confrelid::regclass AS parent,c.conname,c.confdeltype,a.attname AS col,b.attname AS parent_col
 FROM pg_constraint c JOIN pg_class ch ON ch.oid=c.conrelid JOIN pg_class pa ON pa.oid=c.confrelid
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
 JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=c.confkey[1]
 WHERE c.contype='f' AND cardinality(c.conkey)=1 AND cardinality(c.confkey)=1
 AND ch.relnamespace='public'::regnamespace AND pa.relnamespace='public'::regnamespace
 AND ch.relname IN(SELECT tab FROM hospital_key_manifest) AND pa.relname IN(SELECT tab FROM hospital_key_manifest) AND b.attname='id'
 AND NOT EXISTS(SELECT 1 FROM pg_constraint existing WHERE existing.conrelid=c.conrelid AND existing.conname='hospital_fk_'||substr(md5(c.conrelid::regclass::text||c.conname),1,24))
 LOOP
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',f.child,f.conname);
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY(tenant_id,%I) REFERENCES %s(tenant_id,%I) ON DELETE %s DEFERRABLE INITIALLY IMMEDIATE',f.child,f.conname,f.col,f.parent,f.parent_col,CASE f.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN format('SET NULL (%I)',f.col) WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END);
 END LOOP;
END $$;
COMMIT;
