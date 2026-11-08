# Shared tenancy readiness — 2026-11-06

Status: local implementation in progress; not approved for production activation.
Do not apply these drafts individually to production. Applied migrations 017–026
are unchanged. No provider resources, charges, production settings or data were
changed during this validation.

## Implemented and checked locally

- Hospital selection, request scoping, membership roles and per-user hospital caches.
- Clinical table tenant boundaries and composite references in conversion drafts.
- Shared staff screen uses audited membership commands rather than global role edits.
- Draft 010 rejects dedicated worker jobs in shared mode and blocks activation
  while queued or running jobs remain. Workers must also be stopped externally.
- Draft 011 scopes natural uniqueness to hospitals, allowing identical catalog
  names across hospitals while rejecting duplicates within one hospital.
- Draft 012 prepares hospital/profile configuration transactionally using the
  saved requirements revision. Retries do not duplicate the workspace. It does
  not set verified provisioning timestamps or launch approval.
- Platform hospital operations show shared configuration preparation instead of
  dedicated provider provisioning when VITE_TENANCY_MODE=shared.

## Validation

- 19 Node scope/session/cache/sync/review tests passed.
- Five Docker SQL suites passed (membership, isolation, membership commands,
  clinical keys and role policies).
- Full-schema Docker suite passed through draft 012. Includes cross-hospital
  references, staff-role derivation, blocked global-role writes, natural-key
  isolation, owner clinical denial, retry safety and stale-revision rejection.
- New staff and shared-operations components passed ESLint.
- Shared-mode Vite build passed; browserslist data is stale.

The database fixture contains catalog-derived schema and synthetic data, not a
production backup. Its grants intentionally exercise broad client access;
this is not proof that deployed grants match the intended release.

## Remaining release blockers

1. Verify administrator registration, email confirmation, invitation acceptance
   and launch through the browser. Shared invitation and launch commands and
   onboarding integration are now implemented and SQL-tested (details below).
2. Validate every clinical workflow against the proposed module-role matrix,
   including legacy hospital_id relationships, conflict targets used by upserts,
   and staff references. Compilation alone does not establish these workflows.
3. Storage/realtime are denied in shared mode. Offline forms, background pull
   and audited reconciliation of held writes are not enabled.
4. Produce and rehearse the atomic conversion, explicit retained-catalog mapping,
   backup restoration and rollback. Verify schema drift before release.
5. Obtain approval for that tested release, then verify deployed RLS, onboarding,
   tenant isolation and health. Production is not yet ready for shared onboarding.

## Invitation and launch integration update

Draft 013 binds owner-issued invitations to a verified auth email and saved
requirements revision. Acceptance is audited and retry-safe; wrong recipients,
unverified emails, expiry and stale revisions are tested. Suspended memberships
cannot be reactivated by accepting an invitation. Invitations are shown after
sign-in; registering one does not send mail. The login screen provides account
registration using existing Supabase Auth; verification mail depends on existing
provider settings and delivery has not been tested.

Draft 014 adds shared readiness and owner-only launch. Subscription eligibility,
licensed modules, accepted administrator invitation, checklist and all eight
evidence types are required. Recording changed verification evidence invalidates
approval. Tests reject missing prerequisites, missing approval, invalidated
approval and non-owner launch; approved launch and repeat launch pass. Evidence
fixtures are synthetic. No real deployment, restoration, training or clinical
verification is claimed. Owner recording of verification references is an
attestation, not an automated test.

The wizard exposes workspace preparation, verification references, approval and
launch. Profile, payroll, notification and theatre upserts use hospital-scoped
conflict targets. Branding cache is cleared on hospital-session reset and late
unmounted responses cannot repopulate it. Targeted lint passes. The shared build
passes; all 19 Node tests and the five foundation SQL suites remain passing;
the full-schema suite includes invitation and launch tests through draft 014.

## Restore rehearsal and session concurrency

`node design/shared-tenancy/test-docker.mjs --restore` passed in an isolated
PostgreSQL container. It creates synthetic patients in two hospitals and an auth
identity, dumps the converted database with pg_dump, restores to a second database,
and verifies row preservation, membership, RLS read isolation and rejection of
cross-hospital foreign references. This validates the local schema's restore path;
it does not verify Supabase-managed Auth configuration, storage objects, provider
backups or a production restore. Production backup/rollback rehearsal is still
required before rollout.

Hospital session cleanup is now serialized across overlapping resets, preventing
an earlier asynchronous cleanup from finishing after a later hospital opens.
The regression test passes; all 20 shared-client Node tests pass.

## Staff reference isolation

Draft 015 adds database triggers to hospital-scoped tables referencing users.
New or changed staff references require active membership in that same hospital;
unchanged historical attribution survives staff suspension. Platform creation
and security audit attribution are excluded. Existing user foreign keys remain
intact. The full-schema test passes with foreign-hospital assignment denied,
same-hospital assignment accepted, suspended assignment denied and historical
record updates preserved. This checks hospital membership, not professional
credentialing or specialty eligibility. Draft 015 has not been applied remotely.

## Browser verification blocker

Attempted local Vite preview on 127.0.0.1:4173. Chrome inventory was reachable,
but both creating a local test tab and binding that returned tab failed with
`Cannot read properties of undefined (reading 'timeoutMs')`. Native Windows
automation also failed: `Computer Use native pipe is unavailable` (os error 2).
No authenticated browser workflow was exercised and no production UI was changed.
Browser automation must be restored, or a human must execute the acceptance
workflow, before those checks can be marked complete. Repeating SQL suites does
not substitute for this validation.

## Audit integrity (draft 016)

Production migrations 027/028 fixed audit_log forgery and cross-user reads for the current
single-hospital instance. The shared design needs its own rule because 008 made audit_log and
data_access_log admin-only for both read and write, with UPDATE granted. Consequences in shared mode:
audit events raised by nurses/doctors/cashiers would be rejected (the app swallows the error, so
they are silently lost), and an admin could attribute rows to another user or rewrite history.
Draft 016 lets any active member append events about their own actions in the selected hospital,
lets hospital admins read that hospital's trail (members read only their own rows), and removes
UPDATE/DELETE. report_runs rows must be attributed to the creating user.
audit-scope-test.sql (run by full-schema-test.sql) passes with 016 and fails without it
(nurse audit insert rejected). Cross-hospital reads and inserts, including a forged hospital
header, are denied. Draft 016 has not been applied remotely.

Open: `useAuth` skips sign-in/sign-out audit events when shared mode is on, and sign-in happens
before a hospital is selected, so those events have no hospital to belong to. Decide whether to
record them in a platform-level log or after hospital selection before activating shared mode.
