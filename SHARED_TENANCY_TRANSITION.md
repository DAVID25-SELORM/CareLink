# Shared hospital tenancy — architecture decision

The user superseded the dedicated-project design: all hospitals share the existing
CareLink Supabase project and Vercel deployment. No hospital provider project,
separate provider account, or per-hospital deployment is required.

This decision is not authorization to migrate existing production data.

## Existing-data verification

The owner reported one hospital and no clinical records. A subsequent read-only
existence check on 2026-11-05 found rows in patients, appointments, lab_tests,
prescriptions, prescription_items, payments and referrals, among other tables.
Only table-level existence booleans were retrieved; no clinical contents were read.
See design/shared-tenancy/empty-database-check.json for the complete result.

The owner subsequently confirmed these were demo records and explicitly authorized
deleting only the demo clinical records while preserving accounts and configuration.
The owner ran demo-cleanup-approved.sql after the API lacked deletion permission.
A read-only verification on 2026-11-05 confirmed all seven targeted tables empty
(42 previous records removed) and unchanged row counts in all 133 other public
tables. See design/shared-tenancy/demo-cleanup-result.json.

The prior demo-clinical-record mapping blocker is resolved. Reference catalogs,
inventory, hospital profile and accounts remain populated; their ownership and
authorization still require explicit handling during shared-tenancy conversion.
Recheck data at conversion time rather than assuming this snapshot stays current.

## Existing incompatibilities found

- Core patients, drugs, prescriptions and prescription items have no tenant key.
- public.users has one global role and globally unique email. It cannot represent
  different roles for the same identity in different hospitals.
- Migration 017 distinguishes platform and tenant at the whole-instance level.
  Its restrictive policies do not implement row-level hospital separation.
- Existing clinical hospital_id columns must be mapped explicitly: the hospitals
  table is not automatically the same registry as platform_tenants.
- Worker provision currently creates remote Supabase and Vercel projects. This
  workflow must not be used for shared hospital onboarding.

## Target model

- Retain platform_tenants as the hospital registry, configuration and subscriptions.
- Add hospital memberships keyed by (tenant_id, user_id), with hospital role/status.
  Authentication is shared; authorization and invitations are hospital-scoped.
- Every hospital-owned clinical/operational row carries a non-null tenant_id.
- Membership-based RLS applies to reads and writes, in addition to clinical roles.
  A platform role alone never grants clinical access.
- Composite foreign keys (tenant_id, referenced_id) prevent cross-hospital links.
- Tenant context is validated server-side; a client hospital ID is not authority.
- Audit storage policies, SECURITY DEFINER functions, views, reports, background
  tasks, exports and offline caches as well as ordinary table queries.
- Registration creates registry, settings, subscription and invitation records.
  Activation requires verified isolation, readiness evidence and owner approval.
- Application releases are shared. Hospital feature configuration remains separate;
  schema changes must be backward-compatible across all hospitals.

## Conversion order

1. Inventory every table/function/view/storage bucket and classify ownership.
2. Build membership and tenant context foundations in an isolated test database.
3. Prepare explicit legacy-data mapping; never assign all existing rows to a
   guessed hospital. Validate orphan/cross-hospital references before constraints.
4. Add tenant keys, constraints, policies and scoped RPCs; exercise two-hospital
   read/write/reference denial tests, including users with multiple memberships.
5. Update application authentication, hospital selection, queries, caches and UI.
6. Replace infrastructure provisioning with shared hospital registration/activation.
7. Test backup/restore and rollback, then seek approval for the concrete production
   data migration. Preserve applied migrations 017–026 unchanged.

The previously observed free-project limit does not block this design because
onboarding adds no Supabase project. Shared resource quotas and operating costs
still apply. No claim of production-ready isolation is made by this document.
