-- ============================================
-- CareLink HMS - Referrals Table Setup
-- Author: David Gabion Selorm
-- Email: gabiondavidselorm@gmail.com
-- Date: April 3, 2026
-- ============================================
--
-- This script creates the referrals table for patient referrals
-- between doctors and specialists
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Create New Query
-- 4. Copy and paste this script
-- 5. Click "Run" or press Ctrl+Enter
--
-- ============================================

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  referring_doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referring_doctor_name TEXT,
  referring_doctor_specialty TEXT,
  referred_to_doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_to_doctor_name TEXT,
  referred_to_doctor_specialty TEXT,
  reason TEXT NOT NULL,
  notes TEXT,
  urgency TEXT CHECK (urgency IN ('routine', 'urgent', 'emergency')) DEFAULT 'routine',
  status TEXT CHECK (status IN ('pending', 'accepted', 'completed', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_referrals_patient_id ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referring_doctor_id ON referrals(referring_doctor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_to_doctor_id ON referrals(referred_to_doctor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);

-- Enable Row Level Security
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals table
-- Doctors can view referrals they made or received
CREATE POLICY "Doctors can view their referrals"
ON referrals FOR SELECT
USING (
  auth.uid() IN (referring_doctor_id, referred_to_doctor_id)
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'doctor')
  )
);

-- Doctors can create referrals
CREATE POLICY "Doctors can create referrals"
ON referrals FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'doctor'
  )
);

-- Doctors can update referrals they received (to accept/reject)
CREATE POLICY "Doctors can update received referrals"
ON referrals FOR UPDATE
USING (
  auth.uid() = referred_to_doctor_id
  OR
  auth.uid() = referring_doctor_id
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Admins can view all referrals
CREATE POLICY "Admins can view all referrals"
ON referrals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_referrals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_referrals_updated_at();

-- ============================================
-- VERIFICATION
-- ============================================

-- Check if table was created
SELECT 
  'Referrals Table Created' AS status,
  COUNT(*) AS row_count
FROM referrals;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

-- If you see no errors above, the referrals system is ready!
-- 
-- Features:
-- ✅ Referrals table created
-- ✅ Indexes for performance
-- ✅ Row Level Security enabled
-- ✅ Automatic timestamp updates
--
-- Next steps:
-- 1. Doctors can now refer patients to specialists
-- 2. Referred doctors receive notifications
-- 3. Track referral status (pending → accepted → completed)
--
-- ============================================
