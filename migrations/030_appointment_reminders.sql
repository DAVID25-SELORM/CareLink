-- 030: Remember which appointments have already been sent an SMS reminder, so a second click never texts twice.
-- Column only (no new table), so existing RLS and the shared-tenancy hospital boundary apply unchanged.
-- Idempotent. Apply BEFORE deploying the send-appointment-reminders function.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN public.appointments.reminder_sent_at IS 'When the SMS appointment reminder was handed to the SMS provider';
