-- ============================================
-- CareLink HMS - Initial Users Setup SQL
-- Author: David Gabion Selorm
-- Email: gabiondavidselorm@gmail.com
-- Date: April 2, 2026
-- ============================================
--
-- INSTRUCTIONS:
-- 1. First create authentication accounts in Supabase Dashboard:
--    Go to Authentication → Users → Add User
--    Create accounts for each email below
--
-- 2. Then run this SQL in Supabase SQL Editor
--    This will assign roles and details to those accounts
--
-- ============================================

-- Create/Update Admin User
INSERT INTO users (email, role, full_name, phone)
VALUES (
  'admin@carelink.com', 
  'admin', 
  'David Gabion Selorm', 
  '+233247654381'
)
ON CONFLICT (email) DO UPDATE 
SET 
  role = 'admin', 
  full_name = 'David Gabion Selorm',
  phone = '+233247654381',
  updated_at = NOW();

-- Create/Update Doctor User
INSERT INTO users (email, role, full_name, phone)
VALUES (
  'doctor@carelink.com', 
  'doctor', 
  'Dr. Sarah Johnson', 
  '+233244555666'
)
ON CONFLICT (email) DO UPDATE 
SET 
  role = 'doctor', 
  full_name = 'Dr. Sarah Johnson',
  phone = '+233244555666',
  updated_at = NOW();

-- Create/Update Pharmacist User
INSERT INTO users (email, role, full_name, phone)
VALUES (
  'pharmacist@carelink.com', 
  'pharmacist', 
  'Michael Mensah', 
  '+233244777888'
)
ON CONFLICT (email) DO UPDATE 
SET 
  role = 'pharmacist', 
  full_name = 'Michael Mensah',
  phone = '+233244777888',
  updated_at = NOW();

-- Create/Update Nurse User
INSERT INTO users (email, role, full_name, phone)
VALUES (
  'nurse@carelink.com', 
  'nurse', 
  'Grace Afful', 
  '+233244999000'
)
ON CONFLICT (email) DO UPDATE 
SET 
  role = 'nurse', 
  full_name = 'Grace Afful',
  phone = '+233244999000',
  updated_at = NOW();

-- ============================================
-- VERIFY USERS CREATED
-- ============================================

SELECT 
  email, 
  role, 
  full_name, 
  phone, 
  created_at,
  updated_at
FROM users 
ORDER BY 
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'doctor' THEN 2
    WHEN 'pharmacist' THEN 3
    WHEN 'nurse' THEN 4
    ELSE 5
  END;

-- ============================================
-- Expected Output:
-- ============================================
-- email                    | role        | full_name           | phone          | created_at | updated_at
-- -------------------------|-------------|---------------------|----------------|------------|------------
-- admin@carelink.com       | admin       | David Gabion Selorm | +233247654381  | ...        | ...
-- doctor@carelink.com      | doctor      | Dr. Sarah Johnson   | +233244555666  | ...        | ...
-- pharmacist@carelink.com  | pharmacist  | Michael Mensah      | +233244777888  | ...        | ...
-- nurse@carelink.com       | nurse       | Grace Afful         | +233244999000  | ...        | ...
-- ============================================
