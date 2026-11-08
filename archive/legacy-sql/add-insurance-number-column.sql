-- ============================================
-- CareLink HMS - Add Insurance Number Column
-- Migration to add insurance_number field to patients table
-- Author: David Gabion Selorm
-- Date: April 3, 2026
-- ============================================

-- Add insurance_number column to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS insurance_number TEXT;

-- Add index for insurance number lookups
CREATE INDEX IF NOT EXISTS idx_patients_insurance_number ON patients(insurance_number);

-- Add comment
COMMENT ON COLUMN patients.insurance_number IS 'Policy or membership number for private health insurance';

-- Verification query
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patients' 
  AND column_name = 'insurance_number';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

/*
INSTRUCTIONS:
1. Run this script in Supabase SQL Editor
2. Verify the column was added successfully
3. Existing patient records will have NULL for insurance_number
4. New registrations will capture insurance numbers when provided

USAGE:
- This field stores the insurance policy/membership number
- Appears when "Private Insurance" is selected during registration
- Examples: HI-2024-123456, POL-789012, MEM-456789
- Optional field (can be null)
*/
