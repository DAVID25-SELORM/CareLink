-- ============================================
-- CareLink HMS — Migration 005: Interoperability Layer
-- FHIR R4 resource logging, DHIMS2 reporting, integration endpoints,
-- multi-tenant hospital support, RBAC, security hardening
-- Depends on: 001-004 migrations
-- ============================================

-- ============================================
-- 1. HOSPITALS (Multi-Tenant)
-- ============================================

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  license_number TEXT UNIQUE,
  nhia_provider_id TEXT UNIQUE,
  edition TEXT NOT NULL DEFAULT 'district' CHECK (edition IN ('clinic', 'district', 'regional', 'teaching')),
  facility_type TEXT CHECK (facility_type IN ('clinic', 'health_center', 'polyclinic', 'district_hospital', 'regional_hospital', 'teaching_hospital', 'psychiatric', 'maternity_home')),
  bed_capacity INTEGER DEFAULT 0,
  region TEXT,
  district TEXT,
  town TEXT,
  address TEXT,
  gps_latitude NUMERIC(10, 7),
  gps_longitude NUMERIC(10, 7),
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1E40AF',
  accent_color TEXT DEFAULT '#3B82F6',
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'expired', 'cancelled')),
  subscription_plan TEXT CHECK (subscription_plan IN ('free', 'basic', 'professional', 'enterprise')),
  subscription_expires_at DATE,
  features_enabled JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  working_hours JSONB DEFAULT '{"mon": {"start": "08:00", "end": "17:00"}, "tue": {"start": "08:00", "end": "17:00"}, "wed": {"start": "08:00", "end": "17:00"}, "thu": {"start": "08:00", "end": "17:00"}, "fri": {"start": "08:00", "end": "17:00"}}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_name ON hospitals(name);
CREATE INDEX IF NOT EXISTS idx_hospitals_nhia ON hospitals(nhia_provider_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_region ON hospitals(region);
CREATE INDEX IF NOT EXISTS idx_hospitals_edition ON hospitals(edition);
CREATE INDEX IF NOT EXISTS idx_hospitals_status ON hospitals(subscription_status);

COMMENT ON TABLE hospitals IS 'Multi-tenant hospital registry — each facility gets isolated data';

-- Hospital Departments
CREATE TABLE IF NOT EXISTS hospital_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  head_of_department UUID REFERENCES users(id) ON DELETE SET NULL,
  location TEXT,
  phone_extension TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hosp_dept_hospital ON hospital_departments(hospital_id);

-- ============================================
-- 2. RBAC (Roles & Permissions)
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'export', 'approve', 'submit')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Seed system roles
INSERT INTO roles (name, display_name, description, is_system_role, permissions) VALUES
  ('super_admin', 'Super Administrator', 'Platform-level administrator with access to all hospitals', TRUE, '["*"]'),
  ('hospital_admin', 'Hospital Administrator', 'Full access within a single hospital', TRUE, '["hospital.*"]'),
  ('doctor', 'Doctor', 'Clinical access — encounters, orders, prescriptions, diagnoses', TRUE, '["encounters.*", "diagnoses.*", "orders.*", "prescriptions.*", "lab_tests.read", "vitals.read"]'),
  ('nurse', 'Nurse', 'Nursing access — vitals, MAR, assessments, care plans', TRUE, '["vitals.*", "mar.*", "nursing_assessments.*", "care_plans.*", "handover.*", "encounters.read"]'),
  ('pharmacist', 'Pharmacist', 'Pharmacy access — drugs, dispensing, controlled substances', TRUE, '["drugs.*", "prescriptions.read", "prescriptions.update", "drug_batches.*", "controlled_substance_log.*"]'),
  ('cashier', 'Cashier', 'Billing access — payments, receipts, claims', TRUE, '["payments.*", "billing_items.*", "receipts.*", "claims.*"]'),
  ('records_officer', 'Records Officer', 'Medical records access — patients, encounters history, reports', TRUE, '["patients.*", "encounters.read", "reports.*"]'),
  ('lab_technician', 'Lab Technician', 'Laboratory access — tests, specimens, results', TRUE, '["lab_tests.*", "lab_specimens.*", "lab_test_catalog.read"]'),
  ('radiologist', 'Radiologist', 'Radiology access — orders, results, reports', TRUE, '["radiology_orders.*", "radiology_results.*"]')
ON CONFLICT DO NOTHING;

-- Seed core permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('patients', 'create', 'Register new patients'),
  ('patients', 'read', 'View patient records'),
  ('patients', 'update', 'Update patient information'),
  ('patients', 'delete', 'Delete patient records'),
  ('patients', 'export', 'Export patient data'),
  ('encounters', 'create', 'Start new encounters'),
  ('encounters', 'read', 'View encounter history'),
  ('encounters', 'update', 'Update encounter details'),
  ('diagnoses', 'create', 'Add diagnoses'),
  ('diagnoses', 'read', 'View diagnoses'),
  ('prescriptions', 'create', 'Create prescriptions'),
  ('prescriptions', 'read', 'View prescriptions'),
  ('prescriptions', 'update', 'Dispense/cancel prescriptions'),
  ('lab_tests', 'create', 'Order lab tests'),
  ('lab_tests', 'read', 'View lab results'),
  ('lab_tests', 'update', 'Enter lab results'),
  ('payments', 'create', 'Process payments'),
  ('payments', 'read', 'View payment history'),
  ('claims', 'create', 'Create insurance claims'),
  ('claims', 'read', 'View claims'),
  ('claims', 'submit', 'Submit claims to NHIA'),
  ('claims', 'approve', 'Approve/reject claims'),
  ('reports', 'read', 'View reports'),
  ('reports', 'export', 'Export reports'),
  ('users', 'create', 'Create staff accounts'),
  ('users', 'read', 'View staff list'),
  ('users', 'update', 'Update staff accounts'),
  ('users', 'delete', 'Deactivate staff accounts'),
  ('settings', 'read', 'View hospital settings'),
  ('settings', 'update', 'Update hospital settings')
ON CONFLICT DO NOTHING;

-- Add hospital_id to users for multi-tenancy
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_hospital ON users(hospital_id);

-- ============================================
-- 3. SESSION MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- 4. CONSENT MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('data_processing', 'treatment', 'research', 'disclosure', 'telemedicine', 'marketing')),
  purpose TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  consent_method TEXT CHECK (consent_method IN ('written', 'verbal', 'electronic', 'guardian')),
  witness_id UUID REFERENCES users(id) ON DELETE SET NULL,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_patient ON consent_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_type ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_granted ON consent_records(granted);

COMMENT ON TABLE consent_records IS 'Patient consent tracking for Ghana Data Protection Act compliance';

-- ============================================
-- 5. DATA ACCESS LOG (Enhanced Audit)
-- ============================================

CREATE TABLE IF NOT EXISTS data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'create', 'update', 'delete', 'export', 'print')),
  access_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_log_user ON data_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_access_log_patient ON data_access_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_access_log_resource ON data_access_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_access_log_created ON data_access_log(created_at DESC);

-- Partitioning hint: for production, partition data_access_log by month
COMMENT ON TABLE data_access_log IS 'Forensic-grade access logging — every PHI view/edit is recorded';

-- ============================================
-- 6. FHIR RESOURCE LOG
-- ============================================

CREATE TABLE IF NOT EXISTS fhir_resource_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  fhir_version TEXT DEFAULT 'R4',
  version INTEGER DEFAULT 1,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'read', 'update', 'delete', 'search', 'batch')),
  source_system TEXT,
  target_system TEXT,
  payload JSONB NOT NULL,
  response_code INTEGER,
  error_message TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fhir_log_type ON fhir_resource_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_fhir_log_resource_id ON fhir_resource_log(resource_id);
CREATE INDEX IF NOT EXISTS idx_fhir_log_direction ON fhir_resource_log(direction);
CREATE INDEX IF NOT EXISTS idx_fhir_log_hospital ON fhir_resource_log(hospital_id);
CREATE INDEX IF NOT EXISTS idx_fhir_log_created ON fhir_resource_log(created_at DESC);

COMMENT ON TABLE fhir_resource_log IS 'Logs every FHIR resource exchanged — audit trail for interoperability';

-- ============================================
-- 7. FHIR ENDPOINT CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS fhir_endpoint_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  fhir_version TEXT DEFAULT 'R4',
  auth_type TEXT DEFAULT 'bearer' CHECK (auth_type IN ('none', 'basic', 'bearer', 'oauth2', 'smart')),
  auth_credentials JSONB DEFAULT '{}',
  supported_resources JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_ms": 1000}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fhir_endpoints_hospital ON fhir_endpoint_config(hospital_id);
CREATE INDEX IF NOT EXISTS idx_fhir_endpoints_enabled ON fhir_endpoint_config(enabled) WHERE enabled = TRUE;

COMMENT ON TABLE fhir_endpoint_config IS 'Configuration for external FHIR server connections';
-- NOTE: auth_credentials should be encrypted at rest via pgcrypto in production

-- ============================================
-- 8. DHIMS2 REPORTING
-- ============================================

CREATE TABLE IF NOT EXISTS dhims2_indicator_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_code TEXT NOT NULL UNIQUE,
  indicator_name TEXT NOT NULL,
  dhims2_data_element_id TEXT NOT NULL,
  dhims2_category_option TEXT,
  source_table TEXT NOT NULL,
  source_query TEXT NOT NULL,
  aggregation_type TEXT DEFAULT 'count' CHECK (aggregation_type IN ('count', 'sum', 'average', 'min', 'max')),
  filter_conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dhims2_indicators_code ON dhims2_indicator_mappings(indicator_code);
CREATE INDEX IF NOT EXISTS idx_dhims2_indicators_active ON dhims2_indicator_mappings(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE dhims2_indicator_mappings IS 'Maps CareLink data fields to DHIMS2 indicator codes for aggregate reporting';

CREATE TABLE IF NOT EXISTS dhims2_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('monthly_opd', 'monthly_ipd', 'disease_surveillance', 'maternal_health', 'child_health', 'nutrition', 'family_planning', 'mortality')),
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'submitted', 'accepted', 'rejected')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dhims2_response JSONB,
  submission_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, report_type, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_dhims2_reports_hospital ON dhims2_reports(hospital_id);
CREATE INDEX IF NOT EXISTS idx_dhims2_reports_type ON dhims2_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_dhims2_reports_period ON dhims2_reports(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_dhims2_reports_status ON dhims2_reports(status);

COMMENT ON TABLE dhims2_reports IS 'DHIMS2 aggregate reports for GHS submission';

-- ============================================
-- 9. INTEGRATION ENDPOINTS (General)
-- ============================================

CREATE TABLE IF NOT EXISTS integration_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  endpoint_type TEXT NOT NULL CHECK (endpoint_type IN ('nhia_eclaims', 'dhims2', 'fhir', 'sms_gateway', 'payment_gateway', 'email', 'momo', 'custom')),
  base_url TEXT NOT NULL,
  api_version TEXT,
  auth_type TEXT DEFAULT 'api_key' CHECK (auth_type IN ('none', 'api_key', 'basic', 'bearer', 'oauth2')),
  auth_config JSONB DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  timeout_ms INTEGER DEFAULT 30000,
  retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_ms": 1000}',
  enabled BOOLEAN DEFAULT TRUE,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'down', 'unknown')),
  last_health_check TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_hospital ON integration_endpoints(hospital_id);
CREATE INDEX IF NOT EXISTS idx_integration_type ON integration_endpoints(endpoint_type);
CREATE INDEX IF NOT EXISTS idx_integration_enabled ON integration_endpoints(enabled) WHERE enabled = TRUE;

COMMENT ON TABLE integration_endpoints IS 'Configuration for all external API integrations (NHIA, DHIMS2, SMS, MoMo)';

-- ============================================
-- 10. REPORTING ENGINE
-- ============================================

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  report_code TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('clinical', 'financial', 'operational', 'regulatory', 'custom')),
  description TEXT,
  query_template TEXT NOT NULL,
  parameters JSONB DEFAULT '[]',
  output_format TEXT DEFAULT 'table' CHECK (output_format IN ('table', 'chart', 'pdf', 'excel', 'csv')),
  schedule TEXT,
  is_system_report BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_hospital ON report_templates(hospital_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);

CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  parameters_used JSONB DEFAULT '{}',
  row_count INTEGER,
  execution_time_ms INTEGER,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  file_url TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_runs_template ON report_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_hospital ON report_runs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_created ON report_runs(created_at DESC);

-- Seed standard report templates
INSERT INTO report_templates (report_name, report_code, category, description, query_template, is_system_report) VALUES
  ('OPD Daily Register', 'OPD_DAILY', 'clinical', 'Daily outpatient attendance register', 'SELECT e.*, p.name, p.patient_id, d.icd10_code, d.icd10_description FROM encounters e JOIN patients p ON p.id = e.patient_id LEFT JOIN diagnoses d ON d.encounter_id = e.id WHERE e.encounter_type = ''outpatient'' AND e.created_at::date = :report_date ORDER BY e.created_at', TRUE),
  ('IPD Census', 'IPD_CENSUS', 'clinical', 'Inpatient daily census by ward', 'SELECT w.name AS ward, COUNT(*) AS patients, SUM(CASE WHEN a.status = ''admitted'' THEN 1 ELSE 0 END) AS current_admissions FROM admissions a JOIN wards w ON w.id = a.ward_id WHERE a.status = ''admitted'' GROUP BY w.name', TRUE),
  ('Disease Surveillance Top 20', 'DISEASE_TOP20', 'regulatory', 'Top 20 diagnoses by ICD-10 code for the period', 'SELECT d.icd10_code, d.icd10_description, COUNT(*) AS cases FROM diagnoses d WHERE d.created_at BETWEEN :start_date AND :end_date GROUP BY d.icd10_code, d.icd10_description ORDER BY cases DESC LIMIT 20', TRUE),
  ('Revenue Summary', 'REVENUE_SUMMARY', 'financial', 'Revenue summary by payment method and department', 'SELECT payment_method, SUM(amount) AS total, COUNT(*) AS transactions FROM payments WHERE status = ''completed'' AND created_at BETWEEN :start_date AND :end_date GROUP BY payment_method', TRUE),
  ('Claims Aging Report', 'CLAIMS_AGING', 'financial', 'Claims aging by status and submission date', 'SELECT status, COUNT(*) AS claims, SUM(amount) AS total_amount, AVG(EXTRACT(DAY FROM NOW() - created_at)) AS avg_days FROM claims WHERE created_at BETWEEN :start_date AND :end_date GROUP BY status', TRUE),
  ('Lab TAT Report', 'LAB_TAT', 'operational', 'Laboratory turnaround time metrics', 'SELECT test_name, AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) AS avg_tat_hours, COUNT(*) AS total_tests FROM lab_tests WHERE status = ''completed'' AND created_at BETWEEN :start_date AND :end_date GROUP BY test_name ORDER BY avg_tat_hours DESC', TRUE),
  ('Pharmacy Stock Valuation', 'PHARMA_STOCK', 'financial', 'Current pharmacy stock with valuation', 'SELECT name, category, stock, price, (stock * price) AS total_value, reorder_level, CASE WHEN stock <= reorder_level THEN ''LOW'' ELSE ''OK'' END AS stock_status FROM drugs ORDER BY total_value DESC', TRUE),
  ('Blood Bank Status', 'BLOOD_BANK', 'operational', 'Current blood bank inventory and recent activity', 'SELECT blood_type, units_available, units_reserved, reorder_level FROM blood_inventory ORDER BY blood_type', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- 11. AI SUGGESTIONS LOG
-- ============================================

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('diagnosis', 'drug_interaction', 'dosage_verification', 'lab_interpretation', 'readmission_risk', 'clinical_alert')),
  context JSONB NOT NULL,
  suggestion TEXT NOT NULL,
  confidence_score NUMERIC(3, 2),
  model_name TEXT,
  model_version TEXT,
  accepted BOOLEAN,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  rejection_reason TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_encounter ON ai_suggestions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created ON ai_suggestions(created_at DESC);

COMMENT ON TABLE ai_suggestions IS 'Logs all AI-generated clinical suggestions with acceptance/rejection tracking';

-- ============================================
-- 12. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_hospitals_timestamp ON hospitals;
CREATE TRIGGER update_hospitals_timestamp
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hosp_dept_timestamp ON hospital_departments;
CREATE TRIGGER update_hosp_dept_timestamp
  BEFORE UPDATE ON hospital_departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_timestamp ON roles;
CREATE TRIGGER update_roles_timestamp
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consent_timestamp ON consent_records;
CREATE TRIGGER update_consent_timestamp
  BEFORE UPDATE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fhir_endpoints_timestamp ON fhir_endpoint_config;
CREATE TRIGGER update_fhir_endpoints_timestamp
  BEFORE UPDATE ON fhir_endpoint_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dhims2_indicators_timestamp ON dhims2_indicator_mappings;
CREATE TRIGGER update_dhims2_indicators_timestamp
  BEFORE UPDATE ON dhims2_indicator_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dhims2_reports_timestamp ON dhims2_reports;
CREATE TRIGGER update_dhims2_reports_timestamp
  BEFORE UPDATE ON dhims2_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_endpoints_timestamp ON integration_endpoints;
CREATE TRIGGER update_integration_endpoints_timestamp
  BEFORE UPDATE ON integration_endpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_templates_timestamp ON report_templates;
CREATE TRIGGER update_report_templates_timestamp
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 13. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir_resource_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir_endpoint_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dhims2_indicator_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dhims2_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Hospital-scoped policies (users can only see their hospital's data)
DROP POLICY IF EXISTS "Users view own hospital" ON hospitals;
CREATE POLICY "Users view own hospital"
  ON hospitals FOR SELECT
  TO authenticated
  USING (
    id = (SELECT hospital_id FROM users WHERE users.id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "Admin manage hospitals" ON hospitals;
CREATE POLICY "Admin manage hospitals"
  ON hospitals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Generic authenticated read for reference tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'hospital_departments', 'roles', 'permissions', 'role_permissions',
      'consent_records', 'fhir_resource_log', 'fhir_endpoint_config',
      'dhims2_indicator_mappings', 'dhims2_reports', 'integration_endpoints',
      'report_templates', 'report_runs', 'ai_suggestions'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %I" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Authenticated read %I" ON %I FOR SELECT TO authenticated USING (TRUE)', tbl, tbl);
  END LOOP;
END $$;

-- Admin write for configuration tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'hospital_departments', 'roles', 'role_permissions',
      'fhir_endpoint_config', 'dhims2_indicator_mappings',
      'integration_endpoints', 'report_templates'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin manage %I" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Admin manage %I" ON %I FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ''admin''))', tbl, tbl);
  END LOOP;
END $$;

-- User sessions: users can only see their own
DROP POLICY IF EXISTS "Users view own sessions" ON user_sessions;
CREATE POLICY "Users view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Data access log: admin only
DROP POLICY IF EXISTS "Admin view access log" ON data_access_log;
CREATE POLICY "Admin view access log"
  ON data_access_log FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "System insert access log" ON data_access_log;
CREATE POLICY "System insert access log"
  ON data_access_log FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- ============================================
-- MIGRATION 005 COMPLETE
-- Tables created: hospitals, hospital_departments, roles, permissions,
--                 role_permissions, user_sessions, consent_records,
--                 data_access_log, fhir_resource_log, fhir_endpoint_config,
--                 dhims2_indicator_mappings, dhims2_reports,
--                 integration_endpoints, report_templates, report_runs,
--                 ai_suggestions
-- Tables modified: users (+hospital_id, +role_id)
-- Seed data:      9 system roles, 30 core permissions, 8 report templates
-- ============================================
