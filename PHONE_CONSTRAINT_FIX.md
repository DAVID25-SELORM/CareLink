# Phone Constraint Issue - RESOLVED

## Problem
The `users` table had a UNIQUE constraint on the `phone` column (`users_phone_key`), which caused errors when trying to add multiple users with the same phone number.

**Error Message:**
```
ERROR: 23505: duplicate key value violates unique constraint "users_phone_key"
DETAIL: Key (phone)=(+233247654381) already exists.
```

## Why This Occurred
- A UNIQUE constraint was created on the `phone` column (likely manually added)
- Phone numbers should NOT be unique because:
  - Multiple staff members may share a department phone
  - Staff may share a mobile phone number
  - Phone numbers can change
  - Email is the proper unique identifier for users

## Solution

### Step 1: Remove the Phone Constraint (RUN THIS FIRST)
In Supabase SQL Editor, run:

**File:** `remove-phone-unique-constraint.sql`

This will:
- ✅ Drop the `users_phone_key` UNIQUE constraint
- ✅ Drop any unique indexes on the phone column
- ✅ Create a regular (non-unique) index for performance
- ✅ Verify the constraint is removed

### Step 2: Fix Owner Account (RUN THIS SECOND)
After removing the constraint, run:

**File:** `fix-owner-account.sql`

This will:
- ✅ Sync `owner.carelink@gmail.com` between `auth.users` and `public.users`
- ✅ Set proper role (admin), name, and phone
- ✅ Update auth metadata for dashboard display

### Step 3: Setup Other Users (RUN THIS THIRD)
Finally, run:

**File:** `setup-users.sql`

This will create test accounts for all roles:
- admin@carelink.com
- doctor@carelink.com
- pharmacist@carelink.com
- nurse@carelink.com
- cashier@carelink.com
- records@carelink.com

## Prevention
The database schema in `database-setup.sql` does NOT include a UNIQUE constraint on phone. The constraint must have been added manually or through a migration.

**Correct Schema:**
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,  -- Email is unique ✅
  role TEXT NOT NULL,
  specialty TEXT,
  full_name TEXT,
  phone TEXT,  -- Phone is NOT unique ✅
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Files Created
1. **remove-phone-unique-constraint.sql** - Permanently removes phone UNIQUE constraint
2. **fix-owner-account.sql** - Updated with robust constraint removal
3. **PHONE_CONSTRAINT_FIX.md** - This documentation file

## Verification
After running `remove-phone-unique-constraint.sql`, the verification queries should show:
- ✅ 0 UNIQUE constraints on phone column
- ✅ Only a regular index `idx_users_phone` exists

## Author
David Gabion Selorm  
Email: gabiondavidselorm@gmail.com  
Phone: +233247654381  
Date: April 3, 2026
