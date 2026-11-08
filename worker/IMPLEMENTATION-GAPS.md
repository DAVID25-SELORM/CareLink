# Centralized hospital infrastructure: implementation audit

Reviewed 2026-11-04. This is a code audit, not live-provider certification.
Ownership remains with the existing CareLink Supabase organization and Vercel
account. Each hospital requires separate resources. Existing production resources
must not be modified. Spending authorization is zero; live creation needs approval.

| Requirement | Current evidence and remaining gap |
| --- | --- |
| 1 Central service | Docker worker and server configuration exist; management access and exact account scope remain unverified. |
| 2 Real adapters | HTTP adapters exist; live contracts, ownership lookup now rejects foreign/unknown/ambiguous matches; live contracts and timeout recovery still need validation. |
| 3 Unique names | Name plus truncated tenant UUID exists; immutable full-identity mapping and collision handling remain. |
| 4 Resource records | Binding and checkpoint tables exist; migration 025 preserves omitted statuses and permits explicit error clearing; Docker regression passed. |
| 5 Tenant migrations | SQL submission and local checksum exist; approved manifest, remote checksum verification and interrupted replay remain. |
| 6 Tenant mode | Tenant identity is checked; schema/configuration must actually establish tenant mode. Frontend environment key mismatch corrected in this phase. |
| 7 Invitations | Tenant Auth request exists; retry reconciliation, administrator role assignment and acceptance verification remain. |
| 8 Durable execution | Leases, checkpoints and revision guards exist; migration 024 fences metadata writes. Remote operation intents and reconciliation after ambiguous failures remain. |
| 9 Independent licensing | Per-hospital drafts/subscriptions exist; real apply_modules operation is unsupported. |
| 10 Costs and monitoring | Tables and configured estimates exist; provider cost ingestion and recurring health monitoring remain. |
| 11 Hospital updates | No verified targeted update/rollback workflow exists. |
| 12 Clinical access | Tenant separation migration exists; complete live isolation verification and separately authorized audited support-access workflow remain. |
| 13 Secrets | Server-only provider configuration exists; comprehensive error/checkpoint redaction and permission audit remain. |
| 14 Operations UI | Status, identifiers, blockers and retry controls exist; operation buttons now check role permissions and warn about simulation; full inspect/resume behavior remains. |
| 15 Verified launch | Evidence and owner approval gates exist; real go_live operation is unsupported. End-to-end acceptance remains. |

## Phases and acceptance

1. Correct application configuration and health validation; run existing worker tests.
2. Harden account ownership, durable operation intents, partial writes and retry recovery;
   test wrong-account, duplicate, interrupted and expired-lease cases locally.
3. Implement approved schema replay, tenant setup, invitation reconciliation and
   per-hospital updates; test without production access.
4. Complete monitoring, cost reporting and operations UI; ensure simulation cannot
   satisfy verified launch requirements. Test launch and tenant access boundaries.
5. After read-only account/capacity validation and explicit approval, validate one
   disposable hospital with real providers, including restore and recovery.

Neither mock tests nor applied platform migrations establish production readiness.
No new organization, team or integration is required. No real provisioning is
authorized by this document. Migration 024 requires separate deployment approval.

## Latest local verification

- 15 worker tests passed, including ownership reconciliation and health rejection.
- Migrations 024 and 025 applied only in the disposable local Docker database.
- 025 replay succeeded.
- tests/worker-metadata.sql passed and rolled back its synthetic fixtures: partial
  status preservation, explicit error clearing, wrong lease, cross-hospital write,
  stale revision, browser privilege denial and direct worker RPC denial.
- Chrome lists the account tabs but page reads fail with a timeoutMs integration
  error. Hosted variable names, provider permissions and free capacity remain unverified.
- Production migrations and real resource creation remain unauthorized.

## Verified account and staging constraints

Read-only Management API verification on 2026-11-04:
- Existing organization: DAVID25-SELORM's Org, slug hrfmmbuajnxkkkfuuhys, Free plan.
- Organization details and project listing return HTTP 200 after token permissions updated.
- CareLink and Healthconnectgh.com are ACTIVE_HEALTHY; Event Management System is INACTIVE.
- Supabase documents two active free projects (https://supabase.com/docs/guides/platform/billing-on-supabase).
  The observed active projects consume that allowance. Do not create a third project,
  pause existing applications, upgrade billing or change organization under the zero budget.
- Existing project wjlpywztfjruqnavwsvr is the platform, not a disposable hospital.
- Vercel worker access and scope remain unverified. Supabase token grants no Vercel access.
- Build completed successfully. Fork-based frontend test runs failed to start most
  test workers, even serially; they are not passing acceptance evidence.

## Deployment retry follow-up

- 20 worker tests pass. Matching queued, initializing, building and ready deployments
  are reused on retry; a different commit is not reused. This does not yet resolve
  ambiguous creation timeouts or environment-change identity.
- Migration 026 removes direct authenticated reads of financial binding columns;
  authorized billing RPC access remains. Docker execution is still awaiting completion,
  so do not treat this migration as validated or approved for production yet.
- The frontend thread-pool retry also failed: 4 tests passed, 8 worker-start errors.
  Neither fork nor thread pool results establish frontend acceptance.

## Transport safety follow-up

22 worker tests pass. Transient GET failures schedule durable retries; ambiguous
writes remain failed pending reconciliation. Provider network errors and platform
RPC errors do not retain response bodies. Docker build context excludes worker.env
and other environment files. Docker database commands remain unresponsive; migration
026 validation is still pending. The six work packages are not complete.

## Deployed permission verification after user-applied 026

Read-only Management API catalog query on 2026-11-04 returned:
- authenticated direct cost and currency SELECT: false
- authenticated operational status SELECT and status RPC EXECUTE: true
- anon status RPC EXECUTE: false
- service_role direct binding RPC EXECUTE: false
- service_role fenced write RPC EXECUTE: true
- bindings RLS enabled: true

This verifies deployed grants only. No database mutations or clinical record reads
were performed. The user reports 026 applied; retain it unchanged. Docker behavioral
validation and complete onboarding acceptance remain outstanding.
