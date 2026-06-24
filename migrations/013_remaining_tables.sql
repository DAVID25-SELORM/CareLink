-- ============================================================
-- CareLink HMS — Migration 013: Remaining 30 Missing Tables
-- Safe to run: all statements use IF NOT EXISTS
-- ============================================================


-- ============================================================
-- SECTION 1: RBAC (Roles, Permissions)
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description, is_system) VALUES
  ('admin', 'Full system access', TRUE),
  ('doctor', 'Clinical care and prescriptions', TRUE),
  ('nurse', 'Nursing care and ward management', TRUE),
  ('pharmacist', 'Pharmacy dispensing', TRUE),
  ('cashier', 'Billing and payments', TRUE),
  ('lab_tech', 'Laboratory tests and results', TRUE),
  ('records_officer', 'Patient records management', TRUE)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view roles" ON roles;
CREATE POLICY "Staff view roles" ON roles FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin manage roles" ON roles;
CREATE POLICY "Admin manage roles" ON roles FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO permissions (code, name, module) VALUES
  ('patients.view', 'View Patients', 'patients'),
  ('patients.create', 'Create Patients', 'patients'),
  ('patients.edit', 'Edit Patients', 'patients'),
  ('encounters.view', 'View Encounters', 'encounters'),
  ('encounters.create', 'Create Encounters', 'encounters'),
  ('prescriptions.view', 'View Prescriptions', 'pharmacy'),
  ('prescriptions.create', 'Create Prescriptions', 'pharmacy'),
  ('lab.view', 'View Lab Tests', 'laboratory'),
  ('lab.create', 'Create Lab Tests', 'laboratory'),
  ('billing.view', 'View Billing', 'billing'),
  ('billing.create', 'Create Bills', 'billing'),
  ('billing.collect', 'Collect Payments', 'billing'),
  ('reports.view', 'View Reports', 'reports'),
  ('admin.users', 'Manage Users', 'admin'),
  ('admin.settings', 'System Settings', 'admin')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view permissions" ON permissions;
CREATE POLICY "Staff view permissions" ON permissions FOR SELECT TO authenticated USING (TRUE);


CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view role permissions" ON role_permissions;
CREATE POLICY "Staff view role permissions" ON role_permissions FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin manage role permissions" ON role_permissions;
CREATE POLICY "Admin manage role permissions" ON role_permissions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


-- ============================================================
-- SECTION 2: HOSPITAL DEPARTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  department_type TEXT CHECK (department_type IN ('clinical', 'diagnostic', 'administrative', 'support')),
  head_of_department UUID REFERENCES users(id) ON DELETE SET NULL,
  phone TEXT,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, name)
);

CREATE INDEX IF NOT EXISTS idx_dept_hospital ON hospital_departments(hospital_id);

ALTER TABLE hospital_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view departments" ON hospital_departments;
CREATE POLICY "Staff view departments" ON hospital_departments FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin manage departments" ON hospital_departments;
CREATE POLICY "Admin manage departments" ON hospital_departments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP TRIGGER IF EXISTS update_hospital_departments_timestamp ON hospital_departments;
CREATE TRIGGER update_hospital_departments_timestamp BEFORE UPDATE ON hospital_departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 3: AUDIT & SECURITY
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT,
  ip_address INET,
  user_agent TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'other')),
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own sessions" ON user_sessions;
CREATE POLICY "Users view own sessions" ON user_sessions FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
DROP POLICY IF EXISTS "System manage sessions" ON user_sessions;
CREATE POLICY "System manage sessions" ON user_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('treatment', 'surgery', 'anesthesia', 'blood_transfusion', 'photography', 'research', 'data_sharing', 'telemedicine')),
  consented BOOLEAN NOT NULL,
  consent_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consented_by TEXT,
  relationship_to_patient TEXT,
  witnessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  document_url TEXT,
  notes TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_patient ON consent_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_type ON consent_records(consent_type);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinical staff view consent" ON consent_records;
CREATE POLICY "Clinical staff view consent" ON consent_records FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Clinical staff manage consent" ON consent_records;
CREATE POLICY "Clinical staff manage consent" ON consent_records FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse', 'records_officer')));


CREATE TABLE IF NOT EXISTS data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_data_access_user ON data_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_patient ON data_access_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_data_access_resource ON data_access_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_data_access_at ON data_access_log(accessed_at DESC);

ALTER TABLE data_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin view data access log" ON data_access_log;
CREATE POLICY "Admin view data access log" ON data_access_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
DROP POLICY IF EXISTS "System insert data access log" ON data_access_log;
CREATE POLICY "System insert data access log" ON data_access_log FOR INSERT TO authenticated WITH CHECK (TRUE);


-- ============================================================
-- SECTION 4: FHIR INTEGRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS fhir_resource_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  fhir_id TEXT,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'read', 'update', 'delete', 'search')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  endpoint TEXT,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fhir_log_type ON fhir_resource_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_fhir_log_status ON fhir_resource_log(status);
CREATE INDEX IF NOT EXISTS idx_fhir_log_created ON fhir_resource_log(created_at DESC);

ALTER TABLE fhir_resource_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin view fhir log" ON fhir_resource_log;
CREATE POLICY "Admin view fhir log" ON fhir_resource_log FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


CREATE TABLE IF NOT EXISTS fhir_endpoint_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL UNIQUE REFERENCES hospitals(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  auth_type TEXT DEFAULT 'bearer' CHECK (auth_type IN ('bearer', 'basic', 'oauth2', 'none')),
  client_id TEXT,
  client_secret TEXT,
  token_url TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  sync_resources JSONB DEFAULT '["Patient","Encounter","Observation","MedicationRequest","DiagnosticReport"]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fhir_endpoint_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage fhir config" ON fhir_endpoint_config;
CREATE POLICY "Admin manage fhir config" ON fhir_endpoint_config FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP TRIGGER IF EXISTS update_fhir_config_timestamp ON fhir_endpoint_config;
CREATE TRIGGER update_fhir_config_timestamp BEFORE UPDATE ON fhir_endpoint_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 5: DHIMS2 INTEGRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS dhims2_indicator_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  indicator_name TEXT NOT NULL,
  dhims2_data_element TEXT NOT NULL,
  dhims2_category_combo TEXT,
  source_table TEXT NOT NULL,
  source_query TEXT NOT NULL,
  period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dhims2_indicator_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage dhims2 mappings" ON dhims2_indicator_mappings;
CREATE POLICY "Admin manage dhims2 mappings" ON dhims2_indicator_mappings FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


CREATE TABLE IF NOT EXISTS dhims2_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dhims2_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dhims2_hospital ON dhims2_reports(hospital_id);
CREATE INDEX IF NOT EXISTS idx_dhims2_period ON dhims2_reports(period);

ALTER TABLE dhims2_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage dhims2 reports" ON dhims2_reports;
CREATE POLICY "Admin manage dhims2 reports" ON dhims2_reports FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


-- ============================================================
-- SECTION 6: INTEGRATION ENDPOINTS
-- ============================================================

CREATE TABLE IF NOT EXISTS integration_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  endpoint_type TEXT NOT NULL CHECK (endpoint_type IN ('fhir', 'dhims2', 'nhia', 'lab_lis', 'radiology_ris', 'pharmacy', 'sms', 'email', 'webhook')),
  base_url TEXT NOT NULL,
  auth_type TEXT DEFAULT 'bearer' CHECK (auth_type IN ('bearer', 'basic', 'api_key', 'oauth2', 'none')),
  credentials JSONB DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  timeout_seconds INTEGER DEFAULT 30,
  retry_count INTEGER DEFAULT 3,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT CHECK (last_test_status IN ('ok', 'error', 'timeout')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE integration_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage integrations" ON integration_endpoints;
CREATE POLICY "Admin manage integrations" ON integration_endpoints FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP TRIGGER IF EXISTS update_integration_endpoints_timestamp ON integration_endpoints;
CREATE TRIGGER update_integration_endpoints_timestamp BEFORE UPDATE ON integration_endpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 7: REPORTING
-- ============================================================

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('clinical', 'financial', 'administrative', 'regulatory', 'custom')),
  query_definition JSONB NOT NULL DEFAULT '{}',
  parameters JSONB DEFAULT '[]',
  output_format TEXT DEFAULT 'table' CHECK (output_format IN ('table', 'chart', 'pdf', 'excel', 'csv')),
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view report templates" ON report_templates;
CREATE POLICY "Staff view report templates" ON report_templates FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin manage report templates" ON report_templates;
CREATE POLICY "Admin manage report templates" ON report_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP TRIGGER IF EXISTS update_report_templates_timestamp ON report_templates;
CREATE TRIGGER update_report_templates_timestamp BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result_url TEXT,
  result_data JSONB,
  row_count INTEGER,
  error_message TEXT,
  run_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_runs_hospital ON report_runs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_status ON report_runs(status);

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view own report runs" ON report_runs;
CREATE POLICY "Staff view own report runs" ON report_runs FOR SELECT
  USING (run_by = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
DROP POLICY IF EXISTS "Staff create report runs" ON report_runs;
CREATE POLICY "Staff create report runs" ON report_runs FOR INSERT TO authenticated WITH CHECK (TRUE);


-- ============================================================
-- SECTION 8: AI SUGGESTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('diagnosis', 'medication', 'lab_order', 'referral', 'alert', 'drug_interaction')),
  content JSONB NOT NULL,
  confidence_score NUMERIC(4, 3),
  model_version TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'ignored')),
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_encounter ON ai_suggestions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinical staff view ai suggestions" ON ai_suggestions;
CREATE POLICY "Clinical staff view ai suggestions" ON ai_suggestions FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "System manage ai suggestions" ON ai_suggestions;
CREATE POLICY "System manage ai suggestions" ON ai_suggestions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor')));


-- ============================================================
-- SECTION 9: OFFLINE SYNC
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload JSONB NOT NULL,
  checksum TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_device ON sync_queue(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id);

ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own sync queue" ON sync_queue;
CREATE POLICY "Users manage own sync queue" ON sync_queue FOR ALL
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_queue_id UUID REFERENCES sync_queue(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  device_payload JSONB NOT NULL,
  server_payload JSONB NOT NULL,
  conflict_fields JSONB DEFAULT '[]',
  resolution TEXT CHECK (resolution IN ('device_wins', 'server_wins', 'manual', 'pending')),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage sync conflicts" ON sync_conflicts;
CREATE POLICY "Admin manage sync conflicts" ON sync_conflicts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


CREATE TABLE IF NOT EXISTS offline_cache_manifest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  record_count INTEGER DEFAULT 0,
  checksum TEXT,
  version INTEGER DEFAULT 1,
  UNIQUE(device_id, table_name)
);

ALTER TABLE offline_cache_manifest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own cache manifest" ON offline_cache_manifest;
CREATE POLICY "Users manage own cache manifest" ON offline_cache_manifest FOR ALL
  USING (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS sync_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  last_sequence BIGINT DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, table_name)
);

ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage sync checkpoints" ON sync_checkpoints;
CREATE POLICY "Admin manage sync checkpoints" ON sync_checkpoints FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


CREATE TABLE IF NOT EXISTS registered_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  os TEXT,
  app_version TEXT,
  push_token TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON registered_devices(user_id);

ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own devices" ON registered_devices;
CREATE POLICY "Users manage own devices" ON registered_devices FOR ALL
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));


-- ============================================================
-- SECTION 10: LABORATORY EXTRAS
-- ============================================================

CREATE TABLE IF NOT EXISTS lab_specimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_test_id UUID NOT NULL REFERENCES lab_tests(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  specimen_type TEXT NOT NULL CHECK (specimen_type IN ('blood', 'urine', 'stool', 'sputum', 'swab', 'csf', 'tissue', 'other')),
  specimen_code TEXT,
  collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  storage_temperature TEXT,
  volume_ml NUMERIC(6,2),
  condition TEXT DEFAULT 'acceptable' CHECK (condition IN ('acceptable', 'haemolysed', 'lipemic', 'insufficient', 'rejected')),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_specimens_lab_test ON lab_specimens(lab_test_id);
CREATE INDEX IF NOT EXISTS idx_specimens_patient ON lab_specimens(patient_id);

ALTER TABLE lab_specimens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lab staff view specimens" ON lab_specimens;
CREATE POLICY "Lab staff view specimens" ON lab_specimens FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Lab staff manage specimens" ON lab_specimens;
CREATE POLICY "Lab staff manage specimens" ON lab_specimens FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'lab_tech', 'doctor', 'nurse')));


CREATE TABLE IF NOT EXISTS lab_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  tests JSONB NOT NULL DEFAULT '[]',
  category TEXT,
  price NUMERIC(10,2),
  turnaround_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lab_panels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view lab panels" ON lab_panels;
CREATE POLICY "Staff view lab panels" ON lab_panels FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin manage lab panels" ON lab_panels;
CREATE POLICY "Admin manage lab panels" ON lab_panels FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'lab_tech')));

DROP TRIGGER IF EXISTS update_lab_panels_timestamp ON lab_panels;
CREATE TRIGGER update_lab_panels_timestamp BEFORE UPDATE ON lab_panels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 11: PHARMACY EXTRAS
-- ============================================================

CREATE TABLE IF NOT EXISTS drug_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  manufacturer TEXT,
  manufacture_date DATE,
  expiry_date DATE NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  unit_cost NUMERIC(10,2),
  supplier TEXT,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  storage_conditions TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(drug_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_drug_batches_drug ON drug_batches(drug_id);
CREATE INDEX IF NOT EXISTS idx_drug_batches_expiry ON drug_batches(expiry_date);

ALTER TABLE drug_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacy staff view batches" ON drug_batches;
CREATE POLICY "Pharmacy staff view batches" ON drug_batches FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Pharmacy staff manage batches" ON drug_batches;
CREATE POLICY "Pharmacy staff manage batches" ON drug_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));


CREATE TABLE IF NOT EXISTS drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  drug_b_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major', 'contraindicated')),
  description TEXT NOT NULL,
  mechanism TEXT,
  clinical_effect TEXT,
  management TEXT,
  clinical_references TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(drug_a_id, drug_b_id)
);

CREATE INDEX IF NOT EXISTS idx_interactions_drug_a ON drug_interactions(drug_a_id);
CREATE INDEX IF NOT EXISTS idx_interactions_drug_b ON drug_interactions(drug_b_id);

ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view drug interactions" ON drug_interactions;
CREATE POLICY "Staff view drug interactions" ON drug_interactions FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admin manage drug interactions" ON drug_interactions;
CREATE POLICY "Admin manage drug interactions" ON drug_interactions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));


CREATE TABLE IF NOT EXISTS controlled_substance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  drug_batch_id UUID REFERENCES drug_batches(id) ON DELETE SET NULL,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('received', 'dispensed', 'destroyed', 'returned', 'transferred', 'count')),
  quantity NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2) NOT NULL,
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  witnessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controlled_drug ON controlled_substance_log(drug_id);
CREATE INDEX IF NOT EXISTS idx_controlled_at ON controlled_substance_log(created_at DESC);

ALTER TABLE controlled_substance_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacy staff view controlled log" ON controlled_substance_log;
CREATE POLICY "Pharmacy staff view controlled log" ON controlled_substance_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));
DROP POLICY IF EXISTS "Pharmacy staff manage controlled log" ON controlled_substance_log;
CREATE POLICY "Pharmacy staff manage controlled log" ON controlled_substance_log FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));


-- ============================================================
-- SECTION 12: SPECIALIZED CLINICAL SERVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS mortuary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female', 'unknown')),
  admission_number TEXT,
  date_of_death DATE NOT NULL,
  time_of_death TIME,
  cause_of_death TEXT,
  manner_of_death TEXT CHECK (manner_of_death IN ('natural', 'accidental', 'homicide', 'suicide', 'undetermined')),
  attending_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  post_mortem_required BOOLEAN DEFAULT FALSE,
  post_mortem_done BOOLEAN DEFAULT FALSE,
  post_mortem_findings TEXT,
  next_of_kin TEXT,
  next_of_kin_phone TEXT,
  date_released DATE,
  released_to TEXT,
  certificate_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mortuary_hospital ON mortuary_records(hospital_id);
CREATE INDEX IF NOT EXISTS idx_mortuary_dod ON mortuary_records(date_of_death DESC);

ALTER TABLE mortuary_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinical staff view mortuary" ON mortuary_records;
CREATE POLICY "Clinical staff view mortuary" ON mortuary_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'records_officer')));
DROP POLICY IF EXISTS "Clinical staff manage mortuary" ON mortuary_records;
CREATE POLICY "Clinical staff manage mortuary" ON mortuary_records FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'records_officer')));

DROP TRIGGER IF EXISTS update_mortuary_records_timestamp ON mortuary_records;
CREATE TRIGGER update_mortuary_records_timestamp BEFORE UPDATE ON mortuary_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS dental_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  dentist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint TEXT,
  dental_chart JSONB DEFAULT '{}',
  examination_findings TEXT,
  diagnosis TEXT,
  treatment_done TEXT,
  treatment_plan TEXT,
  teeth_treated JSONB DEFAULT '[]',
  x_rays_taken BOOLEAN DEFAULT FALSE,
  x_ray_findings TEXT,
  next_appointment DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dental_patient ON dental_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_dental_date ON dental_records(visit_date DESC);

ALTER TABLE dental_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view dental records" ON dental_records;
CREATE POLICY "Staff view dental records" ON dental_records FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Doctors manage dental records" ON dental_records;
CREATE POLICY "Doctors manage dental records" ON dental_records FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse')));

DROP TRIGGER IF EXISTS update_dental_records_timestamp ON dental_records;
CREATE TRIGGER update_dental_records_timestamp BEFORE UPDATE ON dental_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS physiotherapy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis TEXT,
  session_number INTEGER DEFAULT 1,
  treatment_type TEXT NOT NULL,
  exercises JSONB DEFAULT '[]',
  modalities_used JSONB DEFAULT '[]',
  functional_goals TEXT,
  patient_response TEXT,
  pain_before INTEGER CHECK (pain_before BETWEEN 0 AND 10),
  pain_after INTEGER CHECK (pain_after BETWEEN 0 AND 10),
  home_exercises TEXT,
  progress_notes TEXT,
  next_session_date DATE,
  session_duration_min INTEGER,
  status TEXT DEFAULT 'completed' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_physio_patient ON physiotherapy_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_physio_date ON physiotherapy_sessions(session_date DESC);

ALTER TABLE physiotherapy_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view physio sessions" ON physiotherapy_sessions;
CREATE POLICY "Staff view physio sessions" ON physiotherapy_sessions FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Clinical staff manage physio" ON physiotherapy_sessions;
CREATE POLICY "Clinical staff manage physio" ON physiotherapy_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse')));

DROP TRIGGER IF EXISTS update_physio_sessions_timestamp ON physiotherapy_sessions;
CREATE TRIGGER update_physio_sessions_timestamp BEFORE UPDATE ON physiotherapy_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 13: RECEIPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided BOOLEAN DEFAULT FALSE,
  voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_patient ON receipts(patient_id);
CREATE INDEX IF NOT EXISTS idx_receipts_issued ON receipts(issued_at DESC);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view receipts" ON receipts;
CREATE POLICY "Staff view receipts" ON receipts FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Cashier manage receipts" ON receipts;
CREATE POLICY "Cashier manage receipts" ON receipts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')));


-- ============================================================
-- SECTION 14: DELIVERIES (standalone birth delivery records)
-- ============================================================

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  anc_registration_id UUID REFERENCES anc_registrations(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  delivery_time TIME,
  delivery_mode TEXT NOT NULL DEFAULT 'svd' CHECK (delivery_mode IN ('svd', 'cs', 'vacuum', 'forceps', 'breech')),
  gestational_age_weeks NUMERIC(4,1),
  birth_weight_kg NUMERIC(4,2),
  baby_sex TEXT CHECK (baby_sex IN ('male', 'female', 'indeterminate')),
  apgar_1min INTEGER CHECK (apgar_1min BETWEEN 0 AND 10),
  apgar_5min INTEGER CHECK (apgar_5min BETWEEN 0 AND 10),
  apgar_10min INTEGER CHECK (apgar_10min BETWEEN 0 AND 10),
  cord_blood_group TEXT,
  placenta_complete BOOLEAN DEFAULT TRUE,
  blood_loss_ml NUMERIC(7,1),
  tears TEXT DEFAULT 'none' CHECK (tears IN ('none', 'first_degree', 'second_degree', 'third_degree', 'fourth_degree')),
  episiotomy BOOLEAN DEFAULT FALSE,
  outcome TEXT NOT NULL DEFAULT 'live_birth' CHECK (outcome IN ('live_birth', 'stillbirth', 'neonatal_death', 'twins', 'triplets')),
  mother_condition TEXT DEFAULT 'stable',
  baby_condition TEXT DEFAULT 'good',
  complications TEXT,
  attendant_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_patient ON deliveries(patient_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_hospital ON deliveries(hospital_id);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinical staff view deliveries" ON deliveries;
CREATE POLICY "Clinical staff view deliveries" ON deliveries FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Clinical staff manage deliveries" ON deliveries;
CREATE POLICY "Clinical staff manage deliveries" ON deliveries FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor', 'nurse')));

DROP TRIGGER IF EXISTS update_deliveries_timestamp ON deliveries;
CREATE TRIGGER update_deliveries_timestamp BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- MIGRATION 013 COMPLETE
-- Created 30 tables:
--   roles, permissions, role_permissions,
--   hospital_departments, user_sessions, consent_records, data_access_log,
--   fhir_resource_log, fhir_endpoint_config,
--   dhims2_indicator_mappings, dhims2_reports, integration_endpoints,
--   report_templates, report_runs, ai_suggestions,
--   sync_queue, sync_conflicts, offline_cache_manifest,
--   sync_checkpoints, registered_devices,
--   lab_specimens, lab_panels,
--   drug_batches, drug_interactions, controlled_substance_log,
--   mortuary_records, dental_records, physiotherapy_sessions,
--   receipts, deliveries
-- ============================================================
