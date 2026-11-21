-- 031: Child immunisation register (one row per dose given), for the Child Welfare / EPI screen.
-- Follows the same access pattern as other clinical tables: staff read, admin/doctor/nurse write,
-- plus the restrictive tenant boundary. Idempotent. Apply before deploying the Child Welfare page.
CREATE TABLE IF NOT EXISTS public.immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  vaccine_code TEXT NOT NULL,
  given_date DATE NOT NULL,
  batch_number TEXT,
  site TEXT,
  given_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT immunizations_patient_vaccine_key UNIQUE (patient_id, vaccine_code),
  CONSTRAINT immunizations_not_future CHECK (given_date <= CURRENT_DATE + 1)
);

CREATE INDEX IF NOT EXISTS idx_immunizations_patient ON public.immunizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_immunizations_given_date ON public.immunizations(given_date);

ALTER TABLE public.immunizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinical staff manage immunizations" ON public.immunizations;
CREATE POLICY "Clinical staff manage immunizations" ON public.immunizations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['admin','doctor','nurse'])));

DROP POLICY IF EXISTS "Staff view immunizations" ON public.immunizations;
CREATE POLICY "Staff view immunizations" ON public.immunizations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS carelink_tenant_boundary ON public.immunizations;
CREATE POLICY carelink_tenant_boundary ON public.immunizations AS RESTRICTIVE FOR ALL
  USING (public.is_tenant_user()) WITH CHECK (public.is_tenant_user());

DROP TRIGGER IF EXISTS update_immunizations_timestamp ON public.immunizations;
CREATE TRIGGER update_immunizations_timestamp BEFORE UPDATE ON public.immunizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.immunizations IS 'One row per vaccine dose given to a patient (Ghana EPI schedule codes, see src/lib/epiSchedule.js)';
