# Shared-tenancy conversion runbook (NOT executed)

Converts the live CareLink Supabase project from a single-hospital `platform` instance to shared
hospital tenancy. Nothing in this repository applies it. Run it only with the owner's explicit approval,
in a maintenance window, after the checks below.

## Live state inventory (read-only, 2026-11-08)
- `carelink_instance`: `platform`, enabled. `hospital_memberships` table: absent.
- One registry hospital: **Health Medics** `f5987a71-e540-4932-ac22-150ad7e5894b`, lifecycle `onboarding`.
- `hospitals` rows: 0. `patients` rows: 0 (demo data removed 2026-11-05). 11 staff profiles, roles drawn from
  admin/cashier/doctor/nurse/pharmacist/records_officer. 1 platform owner.
- 140 public tables. Column fingerprints and policy counts match `schema-fixture.sql`, which the drafts were
  tested against, except `audit_log` (4 policies live vs 5 in the fixture) because migrations 027/028 were applied.
  Not compared: policy bodies, functions, grants, triggers, storage, realtime. Re-run the comparison on the
  day (query in HANDOVER.md) and stop if anything else differs.

## What the bundle does
`node design/shared-tenancy/build-conversion-bundle.mjs <initial-tenant-uuid> [out.sql]` concatenates drafts
001-016 into one transaction with a preflight and an activation step:
- Preflight refuses to run unless: platform instance, no `hospital_memberships`, the hospital exists, no queued
  or running provisioning jobs, every staff role maps to a hospital role, every staff profile has an auth identity.
- Adds `tenant_id` (NOT NULL, default from request context) to every hospital table, composite keys, restrictive
  `hospital_boundary` policies, per-role policies, audit immutability (016), staff-reference triggers.
- Creates one membership per existing staff profile (same role) in the initial hospital; platform owners get none.
- Switches `carelink_instance` to `shared` and verifies every hospital table has a NOT NULL `tenant_id` and RLS.
- Any error rolls back everything. After COMMIT the only way back is a restore.

`npm run test:conversion` rehearses the bundle on a disposable database seeded like production: it checks one
membership per staff member with unchanged roles, none for the platform owner, no clinical access before launch,
doctor access after launch, and no clinical access for the platform owner.

## Before the window
1. Supabase Pro with point-in-time recovery enabled (the Free plan has neither).
2. Restore the project to a new project and run the bundle there. Confirm the preflight passes and the checks above
   hold. Record the timing.
3. Re-run the drift comparison on the live project. Stop on any new difference.
4. Stop the onboarding worker container and set `ONBOARDING_PROVIDER_MODE` away from production.
5. Build the shared app: `VITE_TENANCY_MODE=shared`. Preview it against the restored copy and walk the browser
   acceptance flow (READINESS.md blockers 1-2) with two hospitals. This has NOT been done.
6. Decide `VITE_REQUIRE_STAFF_MFA` and have every admin and the platform owner enrol first.

## Window
1. Announce downtime. Take a manual backup and note the PITR timestamp.
2. Build the bundle with the live hospital id. Run it with psql (`-v ON_ERROR_STOP=1 -f conversion-bundle.sql`) using
   the direct connection string. The SQL editor cannot run it unchanged because of the `\set` line.
3. Set `VITE_TENANCY_MODE=shared` in the Vercel project that serves production and redeploy the shared build.
4. Staff cannot reach clinical data until the hospital is launched. Open the hospital in the platform console,
   record verification evidence, approve and launch (draft 014 gates). Expected: Health Medics goes active.
5. Smoke test as a hospital admin, a nurse and the platform owner. Register a second test hospital and confirm
   it cannot see the first.

## Rollback
- Failure inside the bundle: nothing changed.
- After COMMIT: restore to the PITR timestamp (or the manual backup), then redeploy the previous build without
  `VITE_TENANCY_MODE`. Data written after the restore point is lost, so keep the window short and read-only.

## Known gaps before this is safe to run
- Browser-level acceptance of invitations, email confirmation and launch is untested (READINESS blocker 1).
- Clinical workflows are not validated against the module-role matrix (blocker 2).
- Storage and realtime are denied in shared mode; offline write queue is disabled (blocker 3).
- `useAuth` skips sign-in/sign-out audit events in shared mode (see READINESS, Audit integrity).
- 6 SECURITY DEFINER functions flagged by the Security Advisor have not been reviewed.
