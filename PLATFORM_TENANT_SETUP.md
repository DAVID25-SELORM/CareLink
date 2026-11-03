# Platform ownership and dedicated tenant workspaces

CareLink keeps its existing dedicated-project architecture: one Supabase project
and deployment per hospital, plus a separate project/deployment for platform
administration. Do not put multiple hospitals' clinical data in one database.
This change does not convert the clinical schema into shared-database tenancy.

## Access model

- `/platform/login` and `/platform`: platform owners manage the tenant directory
  and onboarding tasks. They have no clinical, billing, staff-management or hospital
  settings access. Owner assignments reference `auth.users`, without requiring a
  hospital membership or a `public.users` row.
- `/login` and `/dashboard`: hospital staff. The existing `admin` role means
  **tenant administrator**, limited to the connected hospital project.
- Platform ownership is assigned explicitly in `platform_owners` by a database
  administrator. Email addresses, Auth user metadata, cached roles and the tenant
  user-management screen cannot grant it.
- `get_carelink_access()` verifies access in the database. Failure or missing setup
  blocks access; there is no fallback to an unverified role.
- The database uses restrictive policies alongside existing clinical role policies.
  Views run with the caller's permissions. Tenant role changes require a tenant admin.
- Platform directory and task changes are audited by database triggers in
  `platform_audit_log`, independently of browser logging.

## Deployment order

1. Back up each existing database. Apply the existing base/module schema first.
2. Apply `migrations/017_platform_tenant_separation.sql` to **every** project before
   deploying the updated app. It defaults to tenant mode and preserves existing
   tenant users and records. PostgreSQL 15+ is required for invoker-security views.
3. Confirm that hospital staff `public.users.id` values match their Auth user IDs.
   Legacy email-only mappings must be reconciled explicitly before rollout; the
   app no longer authorizes by email. Do not automatically rewrite IDs referenced
   by clinical records.
4. In the dedicated platform project, create the real owner's Auth account using
   the Supabase dashboard. In that project's SQL editor, run the following with
   its verified Auth UUID (replace the placeholder):

   ```sql
   BEGIN;
   UPDATE public.carelink_instance SET instance_kind = 'platform' WHERE singleton;
   INSERT INTO public.platform_owners(user_id)
   VALUES ('REPLACE_WITH_OWNER_AUTH_UUID'::uuid) ON CONFLICT DO NOTHING;
   COMMIT;
   ```

5. Keep hospital projects in tenant mode. Create each initial tenant administrator
   through trusted setup with matching Auth/public user IDs. Subsequent staff can
   use the existing User Management flow; staff signup uses a separate auth client
   so the administrator's session remains active.
6. Deploy each frontend with **only its own** `VITE_SUPABASE_URL` and public anon
   key. Never ship service-role keys. Use separate origins for hospital workspaces
   and the platform console. There is no cross-project clinical access or tenant
   impersonation from the platform console.
7. Sign in as owner and tenant admin separately; check direct API access as well
   as navigation. Reapply migration 017 after adding tables/views through older
   module scripts so the new objects receive the boundary policies. Review future
   SECURITY DEFINER functions and materialized views for bypasses before exposing
   them to clients.

An owner formerly using a hospital admin account is not automatically promoted.
Assign ownership in the separate platform project and explicitly review whether
the person's hospital staff account should remain. No existing account is deleted.

## Existing onboarding records

The old `hospitals` table was also used by FHIR/organization modules. New platform
records live in `platform_tenants` and `platform_onboarding_tasks` to avoid mixing
clinical organizations and the platform's customer directory. The migration does
not guess which legacy rows are customers. In the platform project only, review
and copy the old onboarding records to the new tables, preserving IDs and mapping
`created_by`/`completed_by` to valid Auth IDs or null. Keep the source records until
the imported counts and relationships have been verified. Legacy onboarding tasks
are blocked from tenant API access.

## Pausing or suspending a hospital

The directory's `paused` value tracks onboarding only. To suspend actual access,
an authorized operator must execute this in the target hospital's database:

```sql
UPDATE public.carelink_instance SET enabled = false WHERE singleton;
```

Use `enabled = true` to restore access. Database queries are blocked immediately;
the client rechecks its role on the next auth event/reload. Already downloaded
records are not remotely erased. Cross-project provisioning, subscription billing,
automated suspension and support access are not implemented by this migration.

## Validation

- `npm run test:run` and `npm run build`.
- `tests/platform-separation.sql` runs against a disposable PostgreSQL database.
  Copy it, `database-setup.sql`, and migration 017 into `/tmp` of a PostgreSQL 16
  test container, then run `psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/platform-separation.sql`.
  It tests owner access without a tenant membership, direct API isolation, view
  isolation, role escalation, unassigned users, suspension and migration reruns.
  Never run this fixture on a real application database.
