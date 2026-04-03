# 📊 CareLink HMS - Database Setup Guide

This guide explains the CareLink database schema.

For Supabase SQL Editor, use the runnable script in [`database-setup.sql`](./database-setup.sql) instead of pasting this Markdown file.

---

## 🚀 Quick Setup

1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Run [`database-setup.sql`](./database-setup.sql) first
4. Create your owner/admin account in **Authentication -> Users**
5. Create any optional demo/test role accounts you want to use for system checks
6. Run [`setup-users.sql`](./setup-users.sql) to sync the owner account and any test users
7. Then run any module setup scripts your hospital needs
8. Enable Row Level Security (RLS) policies

---

## 📋 Database Tables

### 1. Users Table

Stores user accounts with roles for access control.

```sql
-- Users table for authentication and roles
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'pharmacist', 'nurse', 'cashier', 'records_officer')),
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster email lookups
CREATE INDEX idx_users_email ON users(email);
```

### 2. Patients Table

Core patient information including NHIS and insurance details.

```sql
-- Patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  nhis_number TEXT,
  insurance_type TEXT CHECK (insurance_type IN ('nhis', 'private', 'none')),
  insurance_name TEXT,
  insurance_number TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  blood_group TEXT,
  allergies TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for search optimization
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_nhis ON patients(nhis_number);
CREATE INDEX idx_patients_insurance_number ON patients(insurance_number);
```

### 3. Drugs Table

Drug inventory management.

```sql
-- Drugs/Medicines inventory
CREATE TABLE drugs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'tablets',
  reorder_level INTEGER DEFAULT 10,
  manufacturer TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for drug search
CREATE INDEX idx_drugs_name ON drugs(name);
CREATE INDEX idx_drugs_category ON drugs(category);
CREATE INDEX idx_drugs_stock ON drugs(stock);
```

### 4. Prescriptions Table

Doctor prescriptions for patients.

```sql
-- Prescriptions
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name TEXT,
  diagnosis TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
```

### 5. Prescription Items Table

Individual drugs in a prescription.

```sql
-- Prescription items (line items)
CREATE TABLE prescription_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  drug_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prescription_items_prescription ON prescription_items(prescription_id);
CREATE INDEX idx_prescription_items_drug ON prescription_items(drug_id);
```

### 6. Payments Table

Payment and billing records.

```sql
-- Payments/Billing
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'momo', 'insurance', 'card')),
  momo_provider TEXT CHECK (momo_provider IN ('mtn', 'telecel', 'airteltigo')),
  transaction_reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_patient ON payments(patient_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_method ON payments(payment_method);
```

### 7. Claims Table

Insurance claims management (NHIS & Private).

```sql
-- Insurance Claims
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  insurance_type TEXT NOT NULL CHECK (insurance_type IN ('nhis', 'private')),
  insurance_name TEXT,
  claim_number TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'paid')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_claims_patient ON claims(patient_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_insurance_type ON claims(insurance_type);
```

### 8. Lab Tests Table

Laboratory tests and results.

```sql
-- Laboratory Tests
CREATE TABLE lab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_type TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  result TEXT,
  result_file_url TEXT,
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX idx_lab_tests_status ON lab_tests(status);
```

### 9. Appointments Table

Patient appointment scheduling.

```sql
-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
```

### 10. Audit Log Table (Optional but Recommended)

Track all system changes for security.

```sql
-- Audit log for tracking changes
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

---

## Optional Module Scripts

After the core schema is ready, run the extra scripts that match the hospital workflow you want to enable:

- [`nurse-system-setup.sql`](./nurse-system-setup.sql) for vitals, nurse notes, care tasks, and shift handovers
- [`records-system-setup.sql`](./records-system-setup.sql) for medical records and record requests
- [`referrals-setup.sql`](./referrals-setup.sql) for doctor-to-doctor referrals

These scripts are designed to run after the base tables in this guide exist.

---

## 🔐 Row Level Security (RLS)

Enable RLS for data protection:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all data
CREATE POLICY "Allow authenticated users to read patients"
  ON patients FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read drugs"
  ON drugs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read prescriptions"
  ON prescriptions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read prescription_items"
  ON prescription_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read payments"
  ON payments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read claims"
  ON claims FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read lab_tests"
  ON lab_tests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read appointments"
  ON appointments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert/update most tables
CREATE POLICY "Allow authenticated users to insert patients"
  ON patients FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update patients"
  ON patients FOR UPDATE
  USING (auth.role() = 'authenticated');
```

---

## 📊 Sample Data (Optional)

Insert some test data:

```sql
-- Sample drugs
INSERT INTO drugs (name, category, price, stock, unit) VALUES
('Paracetamol 500mg', 'Analgesics', 2.50, 500, 'tablets'),
('Amoxicillin 500mg', 'Antibiotics', 5.00, 200, 'capsules'),
('Ibuprofen 400mg', 'Anti-inflammatory', 3.00, 300, 'tablets'),
('Metformin 500mg', 'Diabetes', 4.50, 150, 'tablets'),
('Omeprazole 20mg', 'Gastro', 6.00, 100, 'capsules');

-- Sample patient
INSERT INTO patients (name, age, gender, phone, nhis_number, insurance_type) VALUES
('Kwame Mensah', 45, 'male', '0244123456', 'NHIS123456', 'nhis'),
('Ama Serwaa', 32, 'female', '0551234567', 'NHIS789012', 'nhis'),
('Kofi Agyei', 28, 'male', '0209876543', NULL, 'none');
```

---

## ✅ Verification

After setup, verify tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- appointments
- audit_log
- claims
- drugs
- lab_tests
- patients
- payments
- prescription_items
- prescriptions
- users

Optional module tables after their scripts are run:
- medical_records
- nurse_notes
- nurse_tasks
- patient_vitals
- record_requests
- referrals
- shift_handovers

---

## 🔄 Database Functions (Optional)

### Auto-update timestamp function

```sql
-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON drugs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lab_tests_updated_at BEFORE UPDATE ON lab_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 📧 Next Steps

1. ✅ Run all SQL commands above in Supabase SQL Editor
2. ✅ Create your owner/admin Auth user
3. ✅ Create optional test role Auth users if needed
4. ✅ Run [`setup-users.sql`](./setup-users.sql)
5. ✅ Optional: run [`sync-auth-metadata.sql`](./sync-auth-metadata.sql) if you want names and phones to appear in the Supabase Auth dashboard
6. ✅ Test connection from your React app
7. ✅ Insert sample data for testing

---

**Author**: David Gabion Selorm  
**Email**: gabiondavidselorm@gmail.com
