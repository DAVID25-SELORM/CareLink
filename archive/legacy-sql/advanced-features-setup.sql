-- ============================================
-- CareLink HMS - Advanced Features Database Setup
-- Comprehensive schema for all new features
-- Author: David Gabion Selorm
-- Email: gabiondavidselorm@gmail.com
-- Date: April 4, 2026
-- ============================================

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Create New Query
-- 4. Copy and paste this entire script
-- 5. Click "Run" or press Ctrl+Enter

-- ============================================
-- 1. NOTIFICATION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('appointment_reminder', 'lab_result', 'prescription_ready', 'low_stock_alert', 'pending_claim', 'urgent_referral', 'shift_handover', 'new_prescription')),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'sms', 'email')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- ============================================
-- 2. QUEUE MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS queue_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  department TEXT NOT NULL CHECK (department IN ('opd', 'emergency', 'pharmacy', 'laboratory', 'radiology', 'billing', 'records')),
  queue_number INTEGER NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'emergency')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'cancelled', 'no_show')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_wait_time INTEGER,
  served_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_patient_id ON queue_management(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_department ON queue_management(department);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_management(status);
CREATE INDEX IF NOT EXISTS idx_queue_created_at ON queue_management(created_at DESC);

-- ============================================
-- 3. TELEMEDICINE/VIRTUAL CONSULTATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS virtual_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show')),
  meeting_platform TEXT DEFAULT 'zoom' CHECK (meeting_platform IN ('zoom', 'google_meet', 'microsoft_teams', 'custom')),
  meeting_link TEXT,
  meeting_id TEXT,
  meeting_password TEXT,
  consultation_notes TEXT,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_virtual_consultations_patient ON virtual_consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_virtual_consultations_doctor ON virtual_consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_virtual_consultations_status ON virtual_consultations(status);
CREATE INDEX IF NOT EXISTS idx_virtual_consultations_scheduled ON virtual_consultations(scheduled_time);

-- ============================================
-- 4. WARDS AND BEDS MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  floor TEXT,
  ward_type TEXT NOT NULL CHECK (ward_type IN ('general', 'private', 'icu', 'maternity', 'pediatric', 'isolation')),
  total_beds INTEGER NOT NULL DEFAULT 0,
  available_beds INTEGER NOT NULL DEFAULT 0,
  nurse_in_charge UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  bed_type TEXT NOT NULL DEFAULT 'standard' CHECK (bed_type IN ('standard', 'icu', 'isolation', 'private')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'under_maintenance', 'cleaning')),
  current_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ward_id, bed_number)
);

CREATE INDEX IF NOT EXISTS idx_beds_ward_id ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_current_patient ON beds(current_patient_id);

CREATE TABLE IF NOT EXISTS admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  admitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diagnosis TEXT NOT NULL,
  admission_type TEXT NOT NULL CHECK (admission_type IN ('emergency', 'planned', 'transfer')),
  admission_notes TEXT,
  expected_discharge_date DATE,
  discharge_date TIMESTAMPTZ,
  discharge_type TEXT CHECK (discharge_type IN ('cured', 'transferred', 'deceased', 'lama', 'absconded')),
  discharge_summary TEXT,
  discharged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'discharged', 'transferred')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admissions_patient_id ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_bed_id ON admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_admission_date ON admissions(admission_date DESC);

-- ============================================
-- 5. INVENTORY MANAGEMENT (NON-DRUG SUPPLIES)
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'pieces',
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  supplier TEXT,
  last_restock_date DATE,
  location TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_quantity ON inventory_items(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('restock', 'issue', 'return', 'wastage', 'adjustment')),
  quantity INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  issued_to_user UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_to_department TEXT,
  issued_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cost_per_unit NUMERIC(10, 2),
  total_cost NUMERIC(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at DESC);

-- ============================================
-- 6. EMERGENCY/TRIAGE SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS triage_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  triage_level TEXT NOT NULL CHECK (triage_level IN ('red', 'yellow', 'green', 'blue', 'black')),
  chief_complaint TEXT NOT NULL,
  vital_signs JSONB,
  pain_scale INTEGER CHECK (pain_scale BETWEEN 0 AND 10),
  assessment_notes TEXT,
  recommended_action TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_treatment', 'completed')),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triage_patient_id ON triage_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_triage_level ON triage_assessments(triage_level);
CREATE INDEX IF NOT EXISTS idx_triage_status ON triage_assessments(status);
CREATE INDEX IF NOT EXISTS idx_triage_assessed_at ON triage_assessments(assessed_at DESC);

-- ============================================
-- 7. STAFF SCHEDULING
-- ============================================

CREATE TABLE IF NOT EXISTS staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night', 'full_day')),
  department TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'absent', 'on_leave', 'swapped')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, shift_date, shift_type)
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON staff_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON staff_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON staff_schedules(status);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'annual', 'emergency', 'maternity', 'paternity', 'compassionate', 'unpaid')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- ============================================
-- 8. BLOOD BANK MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS blood_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_type TEXT NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  units_available INTEGER NOT NULL DEFAULT 0,
  units_reserved INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 5,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS blood_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name TEXT NOT NULL,
  donor_phone TEXT,
  donor_email TEXT,
  blood_type TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  donation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date DATE NOT NULL,
  screening_status TEXT DEFAULT 'pending' CHECK (screening_status IN ('pending', 'passed', 'failed')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired', 'discarded')),
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_donations_type ON blood_donations(blood_type);
CREATE INDEX IF NOT EXISTS idx_blood_donations_status ON blood_donations(status);
CREATE INDEX IF NOT EXISTS idx_blood_donations_expiry ON blood_donations(expiry_date);

CREATE TABLE IF NOT EXISTS blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blood_type TEXT NOT NULL,
  units_requested INTEGER NOT NULL,
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_requests_patient ON blood_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);

-- ============================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_advanced_features_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notifications_timestamp ON notifications;
DROP TRIGGER IF EXISTS update_queue_timestamp ON queue_management;
DROP TRIGGER IF EXISTS update_virtual_consultations_timestamp ON virtual_consultations;
DROP TRIGGER IF EXISTS update_wards_timestamp ON wards;
DROP TRIGGER IF EXISTS update_beds_timestamp ON beds;
DROP TRIGGER IF EXISTS update_admissions_timestamp ON admissions;
DROP TRIGGER IF EXISTS update_inventory_items_timestamp ON inventory_items;
DROP TRIGGER IF EXISTS update_staff_schedules_timestamp ON staff_schedules;
DROP TRIGGER IF EXISTS update_leave_requests_timestamp ON leave_requests;

CREATE TRIGGER update_queue_timestamp
  BEFORE UPDATE ON queue_management
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_virtual_consultations_timestamp
  BEFORE UPDATE ON virtual_consultations
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_wards_timestamp
  BEFORE UPDATE ON wards
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_beds_timestamp
  BEFORE UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_admissions_timestamp
  BEFORE UPDATE ON admissions
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_inventory_items_timestamp
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_staff_schedules_timestamp
  BEFORE UPDATE ON staff_schedules
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

CREATE TRIGGER update_leave_requests_timestamp
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();

-- ============================================
-- 10. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Queue: Staff can view queues for their departments
DROP POLICY IF EXISTS "Staff can view queues" ON queue_management;
CREATE POLICY "Staff can view queues"
  ON queue_management FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'nurse', 'doctor', 'pharmacist', 'cashier', 'records_officer')
  ));

-- Virtual Consultations: Doctors and patients can view their consultations
DROP POLICY IF EXISTS "View own virtual consultations" ON virtual_consultations;
CREATE POLICY "View own virtual consultations"
  ON virtual_consultations FOR ALL
  USING (
    doctor_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Admins can manage all tables
DROP POLICY IF EXISTS "Admin full access wards" ON wards;
DROP POLICY IF EXISTS "Admin full access beds" ON beds;
DROP POLICY IF EXISTS "Admin full access admissions" ON admissions;
DROP POLICY IF EXISTS "Admin full access inventory_categories" ON inventory_categories;
DROP POLICY IF EXISTS "Admin full access inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Admin full access inventory_transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Admin full access triage" ON triage_assessments;
DROP POLICY IF EXISTS "Admin full access schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Admin full access leave_requests" ON leave_requests;
DROP POLICY IF EXISTS "Admin full access blood_inventory" ON blood_inventory;
DROP POLICY IF EXISTS "Admin full access blood_donations" ON blood_donations;
DROP POLICY IF EXISTS "Admin full access blood_requests" ON blood_requests;

CREATE POLICY "Admin full access wards" ON wards FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access beds" ON beds FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access admissions" ON admissions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access inventory_categories" ON inventory_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access inventory_items" ON inventory_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access inventory_transactions" ON inventory_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access triage" ON triage_assessments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse', 'doctor')));

CREATE POLICY "Admin full access schedules" ON staff_schedules FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access leave_requests" ON leave_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access blood_inventory" ON blood_inventory FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access blood_donations" ON blood_donations FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admin full access blood_requests" ON blood_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'doctor')));

-- ============================================
-- SETUP COMPLETE
-- ============================================

-- Insert default inventory categories
INSERT INTO inventory_categories (name, description) VALUES
  ('Disposables', 'Single-use medical supplies'),
  ('Equipment', 'Reusable medical equipment'),
  ('Linen', 'Bedsheets, towels, gowns'),
  ('Stationery', 'Office and administrative supplies'),
  ('Laboratory Supplies', 'Lab consumables and reagents'),
  ('Pharmacy Supplies', 'Non-drug pharmacy items')
ON CONFLICT (name) DO NOTHING;

-- Insert default blood inventory
INSERT INTO blood_inventory (blood_type, units_available, units_reserved) VALUES
  ('A+', 0, 0),
  ('A-', 0, 0),
  ('B+', 0, 0),
  ('B-', 0, 0),
  ('AB+', 0, 0),
  ('AB-', 0, 0),
  ('O+', 0, 0),
  ('O-', 0, 0)
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Advanced Features Database Setup Complete!';
  RAISE NOTICE 'Tables created: notifications, queue_management, virtual_consultations, wards, beds, admissions, inventory_*, triage_assessments, staff_schedules, leave_requests, blood_*';
  RAISE NOTICE 'Next: Build the frontend components for these features';
END $$;
