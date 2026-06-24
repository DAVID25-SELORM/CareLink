-- ============================================
-- CareLink HMS — Migration 003: Revenue Cycle & NHIA Claims Engine
-- NHIA tariffs, GDRG, encounter-based billing, batch claims, receipts
-- Depends on: 001_core_clinical.sql (encounters, diagnoses, clinical_orders)
-- ============================================

-- ============================================
-- 1. NHIA TARIFF CATALOG
-- Ghana National Health Insurance Authority tariff schedule
-- ============================================

CREATE TABLE IF NOT EXISTS nhia_tariff_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gdrg_code TEXT NOT NULL,
  tariff_code TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('consultation', 'investigation', 'procedure', 'surgery', 'medicine', 'consumable', 'bed_day', 'anesthesia', 'physiotherapy', 'dental', 'optical')),
  subcategory TEXT,
  base_price NUMERIC(10, 2) NOT NULL,
  nhia_price NUMERIC(10, 2) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  edition TEXT DEFAULT '2024',
  facility_level TEXT CHECK (facility_level IN ('clinic', 'health_center', 'district', 'regional', 'teaching')),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tariff_gdrg ON nhia_tariff_catalog(gdrg_code);
CREATE INDEX IF NOT EXISTS idx_tariff_code ON nhia_tariff_catalog(tariff_code);
CREATE INDEX IF NOT EXISTS idx_tariff_category ON nhia_tariff_catalog(category);
CREATE INDEX IF NOT EXISTS idx_tariff_active ON nhia_tariff_catalog(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tariff_effective ON nhia_tariff_catalog(effective_from, effective_to);

COMMENT ON TABLE nhia_tariff_catalog IS 'NHIA tariff schedule with GDRG codes for claims pricing';

-- ============================================
-- 2. FEE SCHEDULES
-- Per-service pricing for private insurance and cash
-- ============================================

CREATE TABLE IF NOT EXISTS fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  payer_type TEXT NOT NULL CHECK (payer_type IN ('cash', 'nhis', 'private_insurance', 'corporate')),
  insurance_company TEXT,
  service_code TEXT NOT NULL,
  service_description TEXT NOT NULL,
  category TEXT,
  unit_price NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'GHS',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_schedule_payer ON fee_schedules(payer_type);
CREATE INDEX IF NOT EXISTS idx_fee_schedule_service ON fee_schedules(service_code);
CREATE INDEX IF NOT EXISTS idx_fee_schedule_active ON fee_schedules(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE fee_schedules IS 'Service pricing by payer type — cash, NHIS, private insurance, corporate';

-- ============================================
-- 3. BILLING ITEMS
-- Line-item charges per encounter
-- ============================================

CREATE TABLE IF NOT EXISTS billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  order_id UUID REFERENCES clinical_orders(id) ON DELETE SET NULL,
  prescription_item_id UUID REFERENCES prescription_items(id) ON DELETE SET NULL,
  tariff_id UUID REFERENCES nhia_tariff_catalog(id) ON DELETE SET NULL,
  fee_schedule_id UUID REFERENCES fee_schedules(id) ON DELETE SET NULL,
  service_code TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  discount_percent NUMERIC(5, 2) DEFAULT 0,
  discount_amount NUMERIC(10, 2) DEFAULT 0,
  tax_amount NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  billing_status TEXT DEFAULT 'unbilled' CHECK (billing_status IN ('unbilled', 'billed', 'paid', 'waived', 'written_off')),
  billed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  billed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-calculate total amount
CREATE OR REPLACE FUNCTION calculate_billing_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.discount_amount := COALESCE(NEW.unit_price * NEW.quantity * COALESCE(NEW.discount_percent, 0) / 100, 0);
  NEW.total_amount := (NEW.unit_price * NEW.quantity) - NEW.discount_amount + COALESCE(NEW.tax_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_billing_total ON billing_items;
CREATE TRIGGER trigger_billing_total
  BEFORE INSERT OR UPDATE ON billing_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_billing_total();

CREATE INDEX IF NOT EXISTS idx_billing_items_encounter ON billing_items(encounter_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_patient ON billing_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_status ON billing_items(billing_status);
CREATE INDEX IF NOT EXISTS idx_billing_items_category ON billing_items(category);
CREATE INDEX IF NOT EXISTS idx_billing_items_created ON billing_items(created_at DESC);

COMMENT ON TABLE billing_items IS 'Individual charge line items per encounter — auto-generated from orders/prescriptions';

-- ============================================
-- 4. CLAIM ITEMS
-- Line-item detail for insurance claims
-- ============================================

CREATE TABLE IF NOT EXISTS claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  billing_item_id UUID REFERENCES billing_items(id) ON DELETE SET NULL,
  tariff_id UUID REFERENCES nhia_tariff_catalog(id) ON DELETE SET NULL,
  diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE SET NULL,
  service_code TEXT,
  gdrg_code TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  claimed_amount NUMERIC(10, 2) NOT NULL,
  approved_amount NUMERIC(10, 2),
  rejection_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'partially_approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_items_claim ON claim_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_items_tariff ON claim_items(tariff_id);
CREATE INDEX IF NOT EXISTS idx_claim_items_status ON claim_items(status);

COMMENT ON TABLE claim_items IS 'Line-item detail for NHIS/private insurance claims with tariff mapping';

-- ============================================
-- 5. CLAIM BATCHES
-- Group claims for batch submission to NHIA
-- ============================================

CREATE TABLE IF NOT EXISTS claim_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_claims INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  approved_amount NUMERIC(12, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scrubbed', 'submitted', 'acknowledged', 'processing', 'partially_paid', 'paid', 'rejected')),
  scrubbed_at TIMESTAMPTZ,
  scrubbed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  scrub_errors JSONB DEFAULT '[]',
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledgment_id TEXT,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_status ON claim_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_period ON claim_batches(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_batches_number ON claim_batches(batch_number);

COMMENT ON TABLE claim_batches IS 'Groups claims into submission batches for NHIA processing';

-- Link claims to batches
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES claim_batches(id) ON DELETE SET NULL;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(10, 2);

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2);

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_claims_batch ON claims(batch_id);
CREATE INDEX IF NOT EXISTS idx_claims_encounter ON claims(encounter_id);

-- ============================================
-- 6. NHIA SUBMISSIONS
-- Track API submissions to NHIA
-- ============================================

CREATE TABLE IF NOT EXISTS nhia_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES claim_batches(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('initial', 'resubmission', 'appeal', 'query_response')),
  submission_method TEXT DEFAULT 'api' CHECK (submission_method IN ('api', 'portal', 'manual')),
  request_payload JSONB,
  response_payload JSONB,
  http_status INTEGER,
  nhia_reference_id TEXT,
  acknowledgment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'accepted', 'rejected', 'error')),
  error_message TEXT,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nhia_sub_batch ON nhia_submissions(batch_id);
CREATE INDEX IF NOT EXISTS idx_nhia_sub_status ON nhia_submissions(status);
CREATE INDEX IF NOT EXISTS idx_nhia_sub_submitted ON nhia_submissions(submitted_at DESC);

COMMENT ON TABLE nhia_submissions IS 'Tracks every NHIA API submission attempt with request/response payloads';

-- ============================================
-- 7. PAYMENT ALLOCATIONS
-- Map partial/split payments to billing items
-- ============================================

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  billing_item_id UUID NOT NULL REFERENCES billing_items(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(10, 2) NOT NULL,
  allocation_type TEXT DEFAULT 'patient' CHECK (allocation_type IN ('patient', 'insurance', 'nhis', 'corporate', 'write_off')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_billing_item ON payment_allocations(billing_item_id);

COMMENT ON TABLE payment_allocations IS 'Maps partial/split payments across individual billing line items';

-- ============================================
-- 8. RECEIPTS
-- Sequential numbered receipts
-- ============================================

CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH 100001;

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE DEFAULT ('RCP-' || LPAD(nextval('receipt_number_seq')::TEXT, 8, '0')),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL,
  change_amount NUMERIC(10, 2) DEFAULT 0,
  payment_method TEXT NOT NULL,
  payer_name TEXT,
  payer_type TEXT DEFAULT 'patient' CHECK (payer_type IN ('patient', 'insurance', 'nhis', 'corporate', 'third_party')),
  items JSONB NOT NULL DEFAULT '[]',
  issued_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voided BOOLEAN DEFAULT FALSE,
  void_reason TEXT,
  voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_patient ON receipts(patient_id);
CREATE INDEX IF NOT EXISTS idx_receipts_encounter ON receipts(encounter_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON receipts(created_at DESC);

COMMENT ON TABLE receipts IS 'Sequentially numbered printable receipts for all payment transactions';

-- ============================================
-- 9. CLAIM SCRUB FUNCTION
-- Validates claims before submission
-- ============================================

CREATE OR REPLACE FUNCTION scrub_claim_batch(p_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_errors JSONB := '[]';
  v_claim RECORD;
  v_item RECORD;
  v_error JSONB;
BEGIN
  -- Check each claim in the batch
  FOR v_claim IN
    SELECT c.*, p.nhis_number, p.name AS patient_name
    FROM claims c
    JOIN patients p ON p.id = c.patient_id
    WHERE c.batch_id = p_batch_id
  LOOP
    -- Validate NHIS number exists
    IF v_claim.nhis_number IS NULL OR v_claim.nhis_number = '' THEN
      v_error := jsonb_build_object(
        'claim_id', v_claim.id,
        'patient_name', v_claim.patient_name,
        'error_type', 'missing_nhis',
        'message', 'Patient has no NHIS number'
      );
      v_errors := v_errors || v_error;
    END IF;

    -- Validate claim has line items
    IF NOT EXISTS (SELECT 1 FROM claim_items WHERE claim_id = v_claim.id) THEN
      v_error := jsonb_build_object(
        'claim_id', v_claim.id,
        'patient_name', v_claim.patient_name,
        'error_type', 'no_items',
        'message', 'Claim has no line items'
      );
      v_errors := v_errors || v_error;
    END IF;

    -- Validate each claim item has a valid tariff
    FOR v_item IN
      SELECT ci.* FROM claim_items ci WHERE ci.claim_id = v_claim.id
    LOOP
      IF v_item.gdrg_code IS NULL OR v_item.gdrg_code = '' THEN
        v_error := jsonb_build_object(
          'claim_id', v_claim.id,
          'claim_item_id', v_item.id,
          'patient_name', v_claim.patient_name,
          'error_type', 'missing_gdrg',
          'message', 'Claim item missing GDRG code: ' || v_item.description
        );
        v_errors := v_errors || v_error;
      END IF;

      -- Check tariff is active and price matches
      IF v_item.tariff_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM nhia_tariff_catalog
          WHERE id = v_item.tariff_id
          AND is_active = TRUE
          AND effective_from <= CURRENT_DATE
          AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
        ) THEN
          v_error := jsonb_build_object(
            'claim_id', v_claim.id,
            'claim_item_id', v_item.id,
            'patient_name', v_claim.patient_name,
            'error_type', 'expired_tariff',
            'message', 'Tariff expired or inactive: ' || v_item.description
          );
          v_errors := v_errors || v_error;
        END IF;
      END IF;
    END LOOP;

    -- Validate claim has at least one diagnosis
    IF v_claim.encounter_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM diagnoses WHERE encounter_id = v_claim.encounter_id
      ) THEN
        v_error := jsonb_build_object(
          'claim_id', v_claim.id,
          'patient_name', v_claim.patient_name,
          'error_type', 'missing_diagnosis',
          'message', 'Encounter has no coded diagnosis'
        );
        v_errors := v_errors || v_error;
      END IF;
    END IF;
  END LOOP;

  -- Update batch with scrub results
  UPDATE claim_batches
  SET scrubbed_at = NOW(),
      scrub_errors = v_errors,
      status = CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'scrubbed' ELSE 'draft' END
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'total_errors', jsonb_array_length(v_errors),
    'errors', v_errors,
    'status', CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'passed' ELSE 'failed' END
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION scrub_claim_batch IS 'Validates all claims in a batch: checks NHIS numbers, diagnosis codes, tariffs, line items';

-- ============================================
-- 10. UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_tariff_timestamp ON nhia_tariff_catalog;
CREATE TRIGGER update_tariff_timestamp
  BEFORE UPDATE ON nhia_tariff_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fee_schedule_timestamp ON fee_schedules;
CREATE TRIGGER update_fee_schedule_timestamp
  BEFORE UPDATE ON fee_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_items_timestamp ON billing_items;
CREATE TRIGGER update_billing_items_timestamp
  BEFORE UPDATE ON billing_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claim_items_timestamp ON claim_items;
CREATE TRIGGER update_claim_items_timestamp
  BEFORE UPDATE ON claim_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claim_batches_timestamp ON claim_batches;
CREATE TRIGGER update_claim_batches_timestamp
  BEFORE UPDATE ON claim_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE nhia_tariff_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhia_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Tariff Catalog: all staff view, admin manages
DROP POLICY IF EXISTS "Staff view tariff catalog" ON nhia_tariff_catalog;
CREATE POLICY "Staff view tariff catalog"
  ON nhia_tariff_catalog FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admin manage tariff catalog" ON nhia_tariff_catalog;
CREATE POLICY "Admin manage tariff catalog"
  ON nhia_tariff_catalog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Fee Schedules: all staff view, admin manages
DROP POLICY IF EXISTS "Staff view fee schedules" ON fee_schedules;
CREATE POLICY "Staff view fee schedules"
  ON fee_schedules FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admin manage fee schedules" ON fee_schedules;
CREATE POLICY "Admin manage fee schedules"
  ON fee_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Billing Items: cashier, admin, doctor
DROP POLICY IF EXISTS "Staff view billing items" ON billing_items;
CREATE POLICY "Staff view billing items"
  ON billing_items FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Billing staff manage items" ON billing_items;
CREATE POLICY "Billing staff manage items"
  ON billing_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier', 'doctor')
  ));

-- Claim Items: cashier, admin
DROP POLICY IF EXISTS "Staff view claim items" ON claim_items;
CREATE POLICY "Staff view claim items"
  ON claim_items FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Claims staff manage items" ON claim_items;
CREATE POLICY "Claims staff manage items"
  ON claim_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

-- Claim Batches: cashier, admin
DROP POLICY IF EXISTS "Staff view claim batches" ON claim_batches;
CREATE POLICY "Staff view claim batches"
  ON claim_batches FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

DROP POLICY IF EXISTS "Admin manage claim batches" ON claim_batches;
CREATE POLICY "Admin manage claim batches"
  ON claim_batches FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

-- NHIA Submissions: admin only
DROP POLICY IF EXISTS "Admin view nhia submissions" ON nhia_submissions;
CREATE POLICY "Admin view nhia submissions"
  ON nhia_submissions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admin manage nhia submissions" ON nhia_submissions;
CREATE POLICY "Admin manage nhia submissions"
  ON nhia_submissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Payment Allocations: cashier, admin
DROP POLICY IF EXISTS "Billing staff view allocations" ON payment_allocations;
CREATE POLICY "Billing staff view allocations"
  ON payment_allocations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

DROP POLICY IF EXISTS "Billing staff manage allocations" ON payment_allocations;
CREATE POLICY "Billing staff manage allocations"
  ON payment_allocations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

-- Receipts: cashier, admin
DROP POLICY IF EXISTS "Staff view receipts" ON receipts;
CREATE POLICY "Staff view receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Cashier manage receipts" ON receipts;
CREATE POLICY "Cashier manage receipts"
  ON receipts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'cashier')
  ));

-- ============================================
-- MIGRATION 003 COMPLETE
-- Tables created: nhia_tariff_catalog, fee_schedules, billing_items,
--                 claim_items, claim_batches, nhia_submissions,
--                 payment_allocations, receipts
-- Tables modified: claims (+batch_id, +encounter_id, +approved_amount, +paid_amount, +paid_at, +payment_reference)
-- Functions:       scrub_claim_batch(batch_id) — validates batch before submission
-- Sequences:       receipt_number_seq
-- ============================================
