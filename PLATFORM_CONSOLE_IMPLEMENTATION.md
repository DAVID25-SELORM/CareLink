# Platform console implementation

## Audit and compatibility

The app is React 18 / Vite with React Router, Tailwind, Toastify and Recharts.
Hospital workspaces use dedicated Supabase projects. Migration 017 introduced a
platform directory, onboarding tasks, owner assignments and restrictive clinical
boundaries. The existing platform UI is a single onboarding page. There are no
Edge Functions, payment integrations, cross-project provisioning workers, backup
workers or platform billing tables in the repository.

Keep migrations 001–017 immutable. Add migration 018 after 017, and a separately
deployed server worker for external operations. Do not share hospital service keys
with the frontend. Existing clinical routes and tables retain their behavior.
An expanded console must never interpret a directory status as proof that a remote
hospital was suspended or provisioned. Requested and confirmed operations remain
distinct until an authorized server integration completes them.

## Implementation sequence

1. Shared console shell, scoped design tokens, accessible navigation, states and
   reusable forms. Reuse React Router, Toastify and Recharts.
2. Add platform RBAC, operational tables, audited RPC commands and typed domain
   calculations. Preserve original owner accounts and tenant isolation.
3. Dashboard, hospital CRUD/detail tabs and retry-safe onboarding. Keep remote
   provisioning actions in an explicit jobs queue with outcomes.
4. Plans, subscriptions, invoices, payments, reminders and financial reports.
5. Team invitations, tickets, incidents, notifications, aggregate monitoring,
   integration metadata, backups, settings, activity and exports.
6. Backend worker contracts, payment-provider verification adapters, deployment
   instructions and tests covering isolation, permissions and state transitions.

## Boundaries and deployment risks

- Production migration execution requires explicit user approval. No new SQL is
  applied to the live database during this implementation.
- Apply 018 before deploying the new UI; a missing schema must show a setup error,
  not made-up totals or a falsely healthy dashboard.
- Cross-project workers need separately configured credentials and explicit
  allowlists. Without these, actions remain queued/blocked and are never reported
  as successful. Remote restore requires an explicit confirmation and backup ID.
- Existing directory records are preserved. Existing onboarding phases are reused.
- Currency totals are grouped by currency. Annual subscriptions normalize to one
  twelfth of their recurring amount; trials/cancelled accounts are not paid MRR.
- Platform staff never gain clinical access. Support access is metadata-only;
  clinical impersonation is not part of this change.
- The existing HMIS is JavaScript. New domain models/calculations use TypeScript
  with a dedicated typecheck; avoid an unrelated full-app conversion.

## Validation and delivery log

Record completed features, verification results and remaining external setup here
as each phase is finished. Local tests do not prove production integrations are
configured or that a remote hospital operation has completed.

## Current delivery

Phase 1 is implemented in the shared platform shell, including responsive sidebar
navigation, mobile navigation, search dialog, breadcrumb, theme preference, profile
menu, notification entry point, focus states, tables, skeletons, empty/error states,
forms, confirmation text and toast handling. Phase 3 now has a database-backed
overview, hospital directory CRUD, registration checklist and queued idempotent
operations. Read-only views for subscriptions, plans, invoices, support, monitoring,
integrations, backups, team, notifications, audit, analytics and settings are wired
to migration 018 tables and show an explicit setup error until those tables exist.

Migration 018 provides the platform roles, permission matrix, plans, subscriptions,
invoices, payments, tickets, incidents, usage, health metadata, integrations, jobs,
backups, notifications, settings and audited transactional RPCs. Paystack,
Flutterwave, remote provisioning, support worker execution and hospital usage
collection remain server-worker integrations; the browser only requests jobs and
never receives provider secrets.
