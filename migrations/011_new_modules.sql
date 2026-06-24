-- Migration 011: Theatre, Maternity, Dietary, Notifications, HR & Payroll, Ambulance, Patient Portal
-- Run this on your Supabase SQL editor

-- ==================== THEATRE MANAGEMENT ====================

CREATE TABLE IF NOT EXISTS theatre_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  procedure_name TEXT NOT NULL,
  surgeon TEXT NOT NULL,
  anaesthetist TEXT,
  ot_room TEXT,
  surgery_type TEXT DEFAULT 'elective' CHECK (surgery_type IN ('elective', 'emergency', 'urgent')),
  anaesthesia_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed')),
  pre_op_notes TEXT,
  consent_obtained BOOLEAN DEFAULT FALSE,
  consent_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theatre_pre_op (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES theatre_sessions(id) ON DELETE CASCADE,
  assessment_notes TEXT,
  fasting_confirmed BOOLEAN DEFAULT FALSE,
  allergies TEXT,
  blood_group TEXT,
  consent_obtained BOOLEAN DEFAULT FALSE,
  pre_op_medication TEXT,
  anaesthesia_type TEXT DEFAULT 'general',
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theatre_operation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES theatre_sessions(id) ON DELETE CASCADE,
  operation_notes TEXT NOT NULL,
  findings TEXT,
  complications TEXT,
  blood_loss_ml NUMERIC,
  duration_minutes INTEGER,
  implants_used TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theatre_post_op (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES theatre_sessions(id) ON DELETE CASCADE,
  post_op_notes TEXT,
  recovery_status TEXT DEFAULT 'stable',
  pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
  instructions TEXT,
  discharged_to TEXT DEFAULT 'ward',
  discharge_time TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE theatre_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_pre_op ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_operation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_post_op ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_theatre_sessions" ON theatre_sessions FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_theatre_pre_op" ON theatre_pre_op FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_theatre_op_notes" ON theatre_operation_notes FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_theatre_post_op" ON theatre_post_op FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== MATERNITY ====================

CREATE TABLE IF NOT EXISTS anc_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_date DATE NOT NULL,
  gestational_age_weeks NUMERIC,
  weight_kg NUMERIC,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  fundal_height_cm NUMERIC,
  fetal_heart_rate INTEGER,
  presentation TEXT DEFAULT 'cephalic',
  edd DATE,
  blood_group TEXT,
  hb_level NUMERIC,
  urine_protein TEXT DEFAULT 'negative',
  urine_glucose TEXT DEFAULT 'negative',
  tetanus_dose TEXT,
  iron_folate_given BOOLEAN DEFAULT FALSE,
  ipt_given BOOLEAN DEFAULT FALSE,
  llin_given BOOLEAN DEFAULT FALSE,
  notes TEXT,
  next_visit_date DATE,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maternity_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  delivery_date DATE NOT NULL,
  delivery_time TIME,
  delivery_mode TEXT DEFAULT 'svd' CHECK (delivery_mode IN ('svd', 'cs', 'assisted', 'breech')),
  gestational_age_weeks NUMERIC,
  birth_weight_kg NUMERIC,
  baby_sex TEXT CHECK (baby_sex IN ('male', 'female')),
  apgar_1min INTEGER,
  apgar_5min INTEGER,
  placenta_complete BOOLEAN DEFAULT TRUE,
  blood_loss_ml NUMERIC,
  episiotomy BOOLEAN DEFAULT FALSE,
  tears TEXT DEFAULT 'none',
  attendant TEXT,
  complications TEXT,
  outcome TEXT DEFAULT 'live_birth' CHECK (outcome IN ('live_birth', 'stillbirth', 'neonatal_death', 'twins')),
  mother_condition TEXT DEFAULT 'good',
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS postnatal_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_date DATE NOT NULL,
  days_postpartum INTEGER,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  temperature NUMERIC,
  uterus_involution TEXT DEFAULT 'normal',
  lochia TEXT DEFAULT 'normal',
  breast_condition TEXT DEFAULT 'normal',
  breastfeeding BOOLEAN DEFAULT TRUE,
  family_planning_counselled BOOLEAN DEFAULT FALSE,
  family_planning_method TEXT,
  baby_condition TEXT DEFAULT 'good',
  immunizations_given TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE anc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE maternity_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE postnatal_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_anc_visits" ON anc_visits FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_deliveries" ON maternity_deliveries FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_postnatal" ON postnatal_visits FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== DIETARY SERVICES ====================

CREATE TABLE IF NOT EXISTS diet_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  admission_id UUID REFERENCES admissions(id),
  diet_type TEXT NOT NULL,
  special_instructions TEXT,
  allergies TEXT,
  fluid_restriction_ml INTEGER,
  meal_frequency INTEGER DEFAULT 3,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed')),
  notes TEXT,
  ordered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE diet_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospital_diet_orders" ON diet_orders FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== NOTIFICATIONS ====================

CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL UNIQUE REFERENCES hospitals(id) ON DELETE CASCADE,
  sms_provider TEXT DEFAULT 'arkesel',
  sms_api_key TEXT,
  sms_sender_id TEXT,
  whatsapp_provider TEXT DEFAULT 'twilio',
  whatsapp_account_sid TEXT,
  whatsapp_auth_token TEXT,
  whatsapp_from_number TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('SMS', 'WhatsApp')),
  template_text TEXT NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, event_type, channel)
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  channel TEXT NOT NULL,
  event_type TEXT,
  message TEXT,
  recipient_phone TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  provider_response JSONB,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_notification_settings" ON notification_settings FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_notification_templates" ON notification_templates FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_notification_logs" ON notification_logs FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== HR & PAYROLL ====================

CREATE TABLE IF NOT EXISTS hr_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  department TEXT,
  role TEXT,
  employment_type TEXT DEFAULT 'Full-time',
  phone TEXT,
  email TEXT,
  hire_date DATE,
  basic_salary NUMERIC DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  national_id TEXT,
  ssnit_number TEXT,
  tin_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated', 'suspended')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, employee_id)
);

CREATE TABLE IF NOT EXISTS hr_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'off')),
  check_in TIME,
  check_out TIME,
  notes TEXT,
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, staff_id, date)
);

CREATE TABLE IF NOT EXISTS hr_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  applied_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES hr_staff(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM
  basic_salary NUMERIC DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  gross_salary NUMERIC DEFAULT 0,
  ssnit_deduction NUMERIC DEFAULT 0,
  income_tax NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'cancelled')),
  notes TEXT,
  generated_by UUID REFERENCES auth.users(id),
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, staff_id, month)
);

ALTER TABLE hr_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_hr_staff" ON hr_staff FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_hr_attendance" ON hr_attendance FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_hr_leaves" ON hr_leaves FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_hr_payroll" ON hr_payroll FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== AMBULANCE MANAGEMENT ====================

CREATE TABLE IF NOT EXISTS ambulance_fleet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  vehicle_type TEXT DEFAULT 'Basic Life Support',
  make_model TEXT,
  year INTEGER,
  driver_name TEXT,
  driver_phone TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'dispatched', 'maintenance', 'standby')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, registration_number)
);

CREATE TABLE IF NOT EXISTS ambulance_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  ambulance_id UUID NOT NULL REFERENCES ambulance_fleet(id),
  caller_name TEXT,
  caller_phone TEXT,
  incident_location TEXT NOT NULL,
  incident_type TEXT DEFAULT 'Medical Emergency',
  patient_name TEXT,
  dispatcher_notes TEXT,
  status TEXT DEFAULT 'en_route' CHECK (status IN ('en_route', 'on_scene', 'returning', 'completed', 'cancelled')),
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dispatched_by UUID REFERENCES auth.users(id)
);

ALTER TABLE ambulance_fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulance_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_ambulance_fleet" ON ambulance_fleet FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hospital_ambulance_dispatches" ON ambulance_dispatches FOR ALL USING (hospital_id = (SELECT hospital_id FROM users WHERE id = auth.uid()));

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_theatre_sessions_hospital ON theatre_sessions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_theatre_sessions_patient ON theatre_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_patient ON anc_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_patient ON maternity_deliveries(patient_id);
CREATE INDEX IF NOT EXISTS idx_postnatal_patient ON postnatal_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_diet_orders_hospital ON diet_orders(hospital_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_hospital ON notification_logs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_patient ON notification_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_hr_staff_hospital ON hr_staff(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON hr_attendance(hospital_id, date);
CREATE INDEX IF NOT EXISTS idx_ambulance_dispatches_status ON ambulance_dispatches(hospital_id, status);
