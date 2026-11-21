-- 029: Record patient consent on the patient row (Data Protection Act, 2012, Act 843).
-- Columns only: no new table, so existing RLS and the shared-tenancy hospital boundary apply unchanged.
-- History of changes is kept by the audit log (the app writes a 'record_consent' event).
-- Idempotent. Apply BEFORE deploying the app version that sends these columns.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS consent_treatment boolean,
  ADD COLUMN IF NOT EXISTS consent_data_processing boolean,
  ADD COLUMN IF NOT EXISTS consent_sms boolean,
  ADD COLUMN IF NOT EXISTS consent_notice_version text,
  ADD COLUMN IF NOT EXISTS consent_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_recorded_by text;

COMMENT ON COLUMN public.patients.consent_treatment IS 'Patient (or guardian) agreed to treatment and care';
COMMENT ON COLUMN public.patients.consent_data_processing IS 'Patient (or guardian) was given the privacy notice and agreed to processing of health data';
COMMENT ON COLUMN public.patients.consent_sms IS 'Optional: agreed to appointment and result reminders by SMS';
