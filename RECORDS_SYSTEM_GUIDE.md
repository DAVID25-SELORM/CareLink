# Records System Guide

## Overview
CareLink HMS includes a records-office workflow for managing indexed medical records and access requests. The role used for this module is `records_officer`.

The records dashboard is available at `/records`.

## What Is Included

### Dashboard Features

- searchable patient records view
- record creation with file number and category
- archive and restore actions
- record request review and approval flow
- patient list with quick record-add action

### Database Objects
Running [`records-system-setup.sql`](c:/Users/RealTimeIT/Desktop/CareLink/records-system-setup.sql) creates:

- `medical_records`
- `record_requests`

It also adds:

- indexes for search and status lookups
- `updated_at` triggers
- row level security policies

## Access Model

### Records Officers
Records officers can:

- open `/records`
- create medical records
- archive and restore records
- process record requests

### Doctors
Doctors can:

- view medical records
- view record requests
- create record requests if needed

### Nurses
Nurses can:

- view medical records through the current SQL policy

### Admins
Admins can:

- open the records dashboard
- manage records and requests through the same protected route and SQL policies

## Setup Steps

### 1. Run the SQL
In Supabase SQL Editor:

1. Open [`records-system-setup.sql`](c:/Users/RealTimeIT/Desktop/CareLink/records-system-setup.sql)
2. Copy the full script
3. Paste and run it

Expected result:

- both records tables exist
- RLS policies are created
- triggers are created without errors

### 2. Create a Records Officer User
From the app:

1. Sign in as admin
2. Open `Users`
3. Add a user with role `records_officer`

### 3. Test the Workflow
Recommended smoke test:

1. Sign in as a records officer
2. Confirm redirect to `/records`
3. Add a new medical record for a patient
4. Archive that record
5. Restore that record
6. Review a pending request in the requests tab

## Verification Queries

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('medical_records', 'record_requests')
order by table_name;

select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('medical_records', 'record_requests')
order by tablename, policyname;
```

## Operational Notes

- `file_number` should be treated as the hospital’s indexed filing reference.
- `record_requests` is for request tracking and approval state, not binary file storage.
- If a hospital wants uploaded documents later, this module can be extended with Supabase Storage and a file URL field strategy.

## Files Involved

- [src/pages/RecordsDashboard.jsx](c:/Users/RealTimeIT/Desktop/CareLink/src/pages/RecordsDashboard.jsx)
- [src/pages/UserManagement.jsx](c:/Users/RealTimeIT/Desktop/CareLink/src/pages/UserManagement.jsx)
- [src/pages/Dashboard.jsx](c:/Users/RealTimeIT/Desktop/CareLink/src/pages/Dashboard.jsx)
- [src/App.jsx](c:/Users/RealTimeIT/Desktop/CareLink/src/App.jsx)
- [src/layouts/DashboardLayout.jsx](c:/Users/RealTimeIT/Desktop/CareLink/src/layouts/DashboardLayout.jsx)
- [records-system-setup.sql](c:/Users/RealTimeIT/Desktop/CareLink/records-system-setup.sql)
