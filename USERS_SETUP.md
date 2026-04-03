# 👥 CareLink HMS - Users Setup Guide

Complete guide to create initial users for your CareLink Hospital Management System.

**Author**: David Gabion Selorm  
**Date**: April 2, 2026

---

## 📋 Overview

CareLink supports **4 user roles**:

| Role | Access Level | Capabilities |
|------|--------------|--------------|
| 🔑 **Admin** | Full System | All modules, reports, user management |
| 🩺 **Doctor** | Clinical | Patients, prescriptions, appointments, lab tests |
| 💊 **Pharmacist** | Pharmacy | Drug inventory, dispensing, billing |
| 🏥 **Nurse** | Patient Care | Patient registration, appointments, records |

---

## 🚀 Quick Setup (2 Steps)

### Step 1: Create Authentication Accounts

Go to **Supabase Dashboard** → **Authentication** → **Users**

Create these accounts:

| Email | Password | Role |
|-------|----------|------|
| `owner.carelink@gmail.com` | (strong password) | Owner/Admin |
| `doctor@carelink.com` | (strong password) | Doctor |
| `pharmacist@carelink.com` | (strong password) | Pharmacist |
| `nurse@carelink.com` | (strong password) | Nurse |

**Note**: Save these passwords securely!

---

### Step 2: Assign Roles in Database

Go to **Supabase Dashboard** → **SQL Editor** → **New Query**

Copy and run this SQL:

```sql
-- ============================================
-- CareLink HMS - Initial Users Setup
-- Author: David Gabion Selorm
-- Date: April 2, 2026
-- ============================================

-- 1. ADMIN USER
INSERT INTO users (email, role, full_name, phone)
VALUES (
  'owner.carelink@gmail.com', 
  'admin', 
  'David Gabion Selorm', 
  '+233247654381'
)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin', 
    full_name = 'David Gabion Selorm',
    phone = '+233247654381',
    updated_at = NOW();

-- 2. DOCTOR USER
INSERT INTO users (email, role, full_name, phone)
VALUES (
  'doctor@carelink.com', 
  'doctor', 
  'Dr. Sarah Johnson', 
  '+233244555666'
)
ON CONFLICT (email) DO UPDATE 
SET role = 'doctor', 
    full_name = 'Dr. Sarah Johnson',
    phone = '+233244555666',
    updated_at = NOW();

-- 3. PHARMACIST USER
INSERT INTO users (email, role, full_name, phone)
VALUES (
  'pharmacist@carelink.com', 
  'pharmacist', 
  'Michael Mensah', 
  '+233244777888'
)
ON CONFLICT (email) DO UPDATE 
SET role = 'pharmacist', 
    full_name = 'Michael Mensah',
    phone = '+233244777888',
    updated_at = NOW();

-- 4. NURSE USER
INSERT INTO users (email, role, full_name, phone)
VALUES (
  'nurse@carelink.com', 
  'nurse', 
  'Grace Afful', 
  '+233244999000'
)
ON CONFLICT (email) DO UPDATE 
SET role = 'nurse', 
    full_name = 'Grace Afful',
    phone = '+233244999000',
    updated_at = NOW();

-- Verify users were created
SELECT email, role, full_name, phone, created_at 
FROM users 
ORDER BY role;
```

---

## ✅ Verification

After running the SQL, you should see:

```
email                      | role        | full_name           | phone
---------------------------|-------------|---------------------|---------------
owner.carelink@gmail.com  | admin       | David Gabion Selorm | +233247654381
doctor@carelink.com       | doctor      | Dr. Sarah Johnson   | +233244555666
nurse@carelink.com        | nurse       | Grace Afful         | +233244999000
pharmacist@carelink.com   | pharmacist  | Michael Mensah      | +233244777888
```

---

## 🔐 Default Login Credentials

Use these to test your system:

### Admin Login
```
Email: owner.carelink@gmail.com
Password: (the one you set in Step 1)
```

### Doctor Login
```
Email: doctor@carelink.com
Password: (the one you set in Step 1)
```

### Pharmacist Login
```
Email: pharmacist@carelink.com
Password: (the one you set in Step 1)
```

### Nurse Login
```
Email: nurse@carelink.com
Password: (the one you set in Step 1)
```

---

## 📱 Production Setup

For **production deployment**, create users with:

1. **Real emails** from your hospital staff
2. **Strong passwords** (minimum 12 characters)
3. **Actual names** and phone numbers
4. Enable **email verification** in Supabase

### Example Production Users:

```sql
-- Production example
INSERT INTO users (email, role, full_name, phone)
VALUES 
  ('drgabion@hospital.com', 'admin', 'Dr. David Gabion Selorm', '+233247654381'),
  ('dr.ama@hospital.com', 'doctor', 'Dr. Ama Mensah', '+233501234567'),
  ('pharm.kwame@hospital.com', 'pharmacist', 'Kwame Osei', '+233201234567'),
  ('nurse.akua@hospital.com', 'nurse', 'Akua Asante', '+233241234567');
```

---

## 🔧 Additional Users

To add more users later:

### Via Supabase Dashboard:

1. **Authentication** → **Users** → **Add User**
2. Enter email and password
3. **SQL Editor** → Run:

```sql
INSERT INTO users (email, role, full_name, phone)
VALUES ('newemail@hospital.com', 'doctor', 'Full Name', '+233XXXXXXXXX');
```

### Via Application (Future Feature):

A user management page can be added to allow admins to:
- Create new users
- Update user roles
- Deactivate users
- Reset passwords

---

## 🛡️ Security Best Practices

1. ✅ Use unique, strong passwords for each user
2. ✅ Enable Two-Factor Authentication (2FA) in Supabase
3. ✅ Regularly review user access logs
4. ✅ Deactivate users who leave the organization
5. ✅ Never share admin credentials
6. ✅ Use email verification for new users

---

## 🆘 Troubleshooting

### "User exists but role not found"
- Make sure you ran the SQL to insert the user in the `users` table
- Check that the email matches exactly (case-sensitive)

### "Invalid login credentials"
- Verify the password in Supabase Authentication
- Check if email is verified (if required)

### "Permission denied"
- Ensure RLS policies are set up correctly
- Verify user has correct role in `users` table

---

## 📞 Support

**Developer**: David Gabion Selorm  
**Email**: gabiondavidselorm@gmail.com  
**Phone**: +233247654381

---

**Next Steps**: 
1. ✅ Create users following this guide
2. ✅ Test login with each role
3. ✅ Add sample patients and drugs
4. ✅ Deploy to Vercel (see DEPLOYMENT.md)
