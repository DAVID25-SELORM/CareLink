# Nurse System Guide

## Overview
CareLink HMS includes a nurse workflow for bedside care, documentation, and shift continuity. The nurse module supports:

- patient vitals recording
- nurse notes
- care tasks
- shift handovers

The role used for this module is `nurse`. Nurse specialty values currently supported in user management are:

- `General Nurse`
- `Midwife`

## What Is Included

### Dashboard
The nurse dashboard is available at `/nurse-dashboard`.

Main areas:

- `Recent Vitals`
- `Medications`
- `My Notes`
- `Care Tasks`
- `Shift Handovers`

Main actions:

- record patient vitals
- add a nurse note
- create a care task
- submit a shift handover

### Database Objects
Running [`nurse-system-setup.sql`](./nurse-system-setup.sql) creates:

- `patient_vitals`
- `nurse_notes`
- `nurse_tasks`
- `shift_handovers`

It also adds:

- indexes for common lookups
- `updated_at` triggers
- row level security policies

## Access Model

### Nurses
Nurses can:

- open the nurse dashboard
- record vitals
- add and update their own nurse notes
- create and complete their own care tasks
- create and update their own handovers
- view records allowed by the configured nurse policies

### Doctors
Doctors can:

- view nurse vitals
- view nurse notes
- view nurse tasks
- view shift handovers

### Admins
Admins have full access to the nurse module data through the SQL policies.

## Setup Steps

### 1. Run the SQL
In Supabase SQL Editor:

1. Open [`nurse-system-setup.sql`](./nurse-system-setup.sql)
2. Copy the full script
3. Paste and run it

Expected result:

- all four nurse tables exist
- RLS policies are created
- triggers are created without errors

### 2. Create Nurse Users
From the app:

1. Sign in as an admin
2. Open `Users`
3. Add a new user with role `nurse`
4. Choose specialty `General Nurse` or `Midwife`

### 3. Test the Workflow
Recommended smoke test:

1. Sign in as a nurse
2. Confirm redirect to `/nurse-dashboard`
3. Record vitals for a patient
4. Add a nurse note
5. Create a care task
6. Mark a task complete
7. Submit a shift handover

## Verification Queries
Run these in Supabase if you want a quick confirmation:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('patient_vitals', 'nurse_notes', 'nurse_tasks', 'shift_handovers')
order by table_name;

select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('patient_vitals', 'nurse_notes', 'nurse_tasks', 'shift_handovers')
order by tablename, policyname;
```

## Operational Notes

- `nurse_tasks` is intended for bedside and follow-up work, not long-term project tracking.
- `shift_handovers` is shared across nurses and doctors for care continuity.
- Medication items shown in the nurse dashboard come from `prescriptions` joined to `prescription_items`.

## Files Involved

- [src/pages/NurseDashboard.jsx](./src/pages/NurseDashboard.jsx)
- [src/pages/UserManagement.jsx](./src/pages/UserManagement.jsx)
- [src/pages/Dashboard.jsx](./src/pages/Dashboard.jsx)
- [src/App.jsx](./src/App.jsx)
- [src/layouts/DashboardLayout.jsx](./src/layouts/DashboardLayout.jsx)
- [nurse-system-setup.sql](./nurse-system-setup.sql)
