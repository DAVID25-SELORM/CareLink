-- ============================================================
-- CareLink HMS — Migration 008: Procurement & Ward Transfers
-- Adds: suppliers, purchase_orders, purchase_order_items
--       patient_transfers (if not already created)
--       encounter_id on queue_management
-- ============================================================

-- ── Suppliers ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_hospital ON suppliers(hospital_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ── Purchase Orders ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ordered'
    CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  total_cost NUMERIC(12, 2) DEFAULT 0,
  expected_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_hospital ON purchase_orders(hospital_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);

-- ── Purchase Order Items ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poi_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_drug ON purchase_order_items(drug_id);

-- ── Patient Transfers ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id UUID REFERENCES admissions(id) ON DELETE SET NULL,
  from_ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  from_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  to_ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  to_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  reason TEXT,
  transferred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  transfer_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_patient ON patient_transfers(patient_id);
CREATE INDEX IF NOT EXISTS idx_transfers_admission ON patient_transfers(admission_id);

-- ── encounter_id on queue_management ────────────────────────

ALTER TABLE queue_management
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL;

ALTER TABLE queue_management
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_queue_encounter ON queue_management(encounter_id);

-- ── Updated-at triggers ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_suppliers_timestamp ON suppliers;
CREATE TRIGGER update_suppliers_timestamp
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_orders_timestamp ON purchase_orders;
CREATE TRIGGER update_purchase_orders_timestamp
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read suppliers" ON suppliers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manage suppliers" ON suppliers FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));

CREATE POLICY "Authenticated read purchase_orders" ON purchase_orders FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manage purchase_orders" ON purchase_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));

CREATE POLICY "Authenticated read purchase_order_items" ON purchase_order_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manage purchase_order_items" ON purchase_order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'pharmacist')));

CREATE POLICY "Authenticated read patient_transfers" ON patient_transfers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Nurse manage patient_transfers" ON patient_transfers FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'nurse', 'doctor')));

-- ============================================================
-- Migration 008 complete
-- New tables: suppliers, purchase_orders, purchase_order_items, patient_transfers
-- Altered:    queue_management (+encounter_id, +reason)
-- ============================================================
