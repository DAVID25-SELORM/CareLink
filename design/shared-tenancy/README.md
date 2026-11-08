# Shared-tenancy foundation (not for production execution)

This directory holds conversion drafts outside the deployable migration sequence.
Applied migrations 017–026 remain unchanged.

001 adds protected hospital memberships and a membership-derived role helper.
It intentionally grants no browser membership mutations, does not assign legacy
records, does not alter clinical RLS, and does not enable shared mode. The current
instance constraint does not permit shared mode, so the helper currently denies
access. Introducing that mode is part of the later atomic conversion, not a
standalone production operation.

Existing global users.role must not be used to authorize shared-hospital access.
Every clinical policy and privileged RPC needs explicit hospital authorization.
Membership administration will require audited commands with owner/admin checks;
no direct browser grant is a substitute for those commands.

Next validation gates:
- inventory and classify all deployed tables, views, functions and storage policies;
- explicitly map legacy rows to hospital tenants;
- add tenant keys and composite foreign keys before enabling shared access;
- replace instance-wide clinical boundaries atomically;
- isolate frontend hospital selection, caches, exports and synchronization;
- verify two-hospital read/write/link denial, suspended membership, and platform
  user denial without a separately granted hospital membership.

This foundation alone does not make existing clinical data multitenant.

## Deployed inventory

Read-only catalog inspection found 140 public tables, all with RLS enabled.
126 have no tenant_id column. This count includes platform and shared-reference
objects, so it is not a list of 126 tables to modify automatically. Existing
hospital_id columns require explicit mapping and policy review.
See table-inventory.json. No row contents were read.

membership-test.sql is a self-contained EMPTY disposable database test harness.
It creates mock auth/registry tables and tests membership denial, self-promotion,
suspension and disabled shared-mode behavior. Never run that harness in production.

## Executed validation

Run `npm run test:shared` with Docker running and the local postgres:16-alpine
image available. The runner creates a uniquely named disposable container with
no network or published ports, runs all SQL suites, then removes that container.
It never reads provider credentials or connects to the deployed database.

All four SQL suites passed on PostgreSQL 16:
- membership-test.sql: missing/forged context, self-promotion, suspended membership,
  suspended hospital and disabled shared mode are denied;
- clinical-isolation-test.sql: two-hospital reads, writes and composite references
  stay isolated, including a user belonging to both hospitals;
- membership-commands-test.sql: audited administrator changes, last-admin
  protection, cross-hospital denial, nurse self-promotion denial and no implicit
  clinical access for a platform owner.
- clinical-keys-test.sql: actual core key-conversion draft rejects cross-hospital
  prescription references and hospital reassignment despite permissive legacy
  policies, while preserving original patient-deletion cascades.

004_clinical_keys.sql adds mandatory hospital keys, restrictive boundaries and
composite foreign keys to the seven cleared core clinical tables. It refuses
populated tables rather than guessing record ownership. This remains outside the
deployable migration sequence: the other hospital-owned tables, global-role
policies, functions, storage and frontend must be converted before activation.
access-catalog.json captures the deployed policy/function/view definitions from
a read-only catalog query (407 policies, 45 functions, one view).

Fourteen Node tests cover request scope, hospital selection and cache partitioning: concurrent hospital
contexts, spoofed headers, user changes, logout, disposal and malformed identifiers.
The prepared createHospitalDatabase factory exposes only database methods and uses
the main auth session without creating another login session. It is not yet wired
into legacy clinical screens. Old offline caches must not be used in shared mode.

005_hospital_session.sql returns only the current authenticated user, validated
hospital and membership-derived role. The clinical key suite tests both its valid
context response and missing-context denial. hospitalSession.mjs disposes the old
database client, invokes cache clearing before verifying a new hospital, and uses
a revision counter to reject stale selection responses. It is a tested controller,
not yet integrated into the clinical UI or IndexedDB cache implementation.

The selection controller now awaits asynchronous cache cleanup and denies the new
session if cleanup fails. openHospitalCache in offlineDB.js supplies an IndexedDB
adapter for hospitalCache.mjs, using a separate database per hospital and user.
It rejects unscoped/foreign rows and denies calls after disposal. The cache tests
use an in-memory storage adapter; browser IndexedDB behavior has not yet been
validated. Legacy screens and the sync queue still require conversion before
shared mode can be enabled. No legacy cache data is imported into the new cache.

These are foundation and fixture tests, not certification of the deployed clinical
schema. Production conversion and actual clinical-table/RPC/storage tests remain
required. 003_membership_commands.sql is also a draft: the final shared-mode
conversion must preserve the protected platform owner authorization helper.

## Application integration (disabled until rollout)

006_core_role_policies.sql replaces the seven core tables' legacy global-role
policies with membership-derived permissions while retaining their restrictive
hospital boundary. All active hospital members can read these core records;
write roles are explicitly listed per table. Generic browser deletion is revoked.
This proposed permission matrix needs workflow validation before rollout; modules
outside these seven tables are not converted by this draft. core-roles-test.sql
checks one user's different roles in two hospitals and denied clinical deletion.

`VITE_TENANCY_MODE=shared` enables hospital selection in AuthProvider. The chooser
uses hospital_choices and verifies the selected identity through hospital_session.
Clinical from/RPC calls capture the selected immutable database client. Switching
unmounts the clinical tree and disposes the previous scope. Platform calls and
authentication keep their original client. Unconverted storage/realtime/schema
paths are denied in shared mode. Leave this flag unset on the current deployment.

The shared sync branch captures the selected database/cache and never reads the
legacy sync queue. Queued mutations include hospital/user identity, enforce a
core-table allowlist and scope updates/deletes by hospital and record. Writes are
acknowledged only after exactly one matching returned row. Dispatch atomically
changes a queue entry from pending to sending before contacting the database.
Failed or interrupted dispatches remain held in sending for review; they are not
automatically replayed. A reconciliation/review UI is still required to resolve
these held entries safely.

HospitalQueueReview now lists held operation metadata in the selected hospital's
workspace. It excludes clinical payloads and filters by hospital and user. It is
inspection-only: reconciliation, verified resolution and audited retry commands
remain outstanding. Refresh is explicit; no resend or discard action is exposed.
The metadata-filtering test and targeted UI/service lint passed; this component
has not yet been verified in a browser.

The organization provider uses the verified hospital session's ID/name in shared
mode rather than the legacy users.hospital_id relationship. Both the ordinary
production build and a local VITE_TENANCY_MODE=shared build pass. All five Docker
SQL suites pass after the session response change. This is compilation and fixture
validation, not a live browser or production rollout. The shared build flag was
set only for the local build process; no server environment was changed.
Queue access is available through the auth context's hospitalCache. Existing
forms remain online forms; offline editing and background pull replication are
not enabled by this change. The legacy offline indicator is hidden in shared mode.

Validation: 18 Node tests and four Docker SQL suites passed. Browser UI, IndexedDB
queue persistence and full clinical workflow verification remain outstanding.
