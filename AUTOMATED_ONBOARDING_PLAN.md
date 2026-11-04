# Automated hospital onboarding implementation plan

## Decision and scope

Use dedicated hospital instances initially: one Supabase project and one Vercel deployment per hospital, managed by the central CareLink platform. Do not introduce shared clinical tenancy in this milestone. The platform stores configuration, approvals, billing and operational metadata, not patient records.

This is an implementation plan, not authorization to create paid infrastructure, send invitations, or run production migrations.

## Existing foundation

Migrations 017 and 018 provide instance separation, platform roles, the hospital registry, onboarding tasks, subscriptions, billing RPCs and queued jobs. Registration is centralized in Hospitals and leads to the same hospital's onboarding checklist. Most commercial and operational views are currently read-only. No functioning external provisioning worker has been verified.

Keep applied migrations immutable. Introduce new, separately reviewed migrations for the platform and tenant agent as needed; do not replay the platform console migration on hospital projects as a provisioning shortcut. Establish and test an explicit tenant migration manifest first.

## Milestone 1: wizard and durable configuration

Extend the existing hospital record instead of creating a parallel registration system. Provide eight resumable steps:

1. Registration: identity, location, facility type and administrator contact.
2. Requirements: selected modules, contacts and branding.
3. Commercial approval: plan, cycle, trial and authorized subscription assignment.
4. Provisioning: approved infrastructure request and stage-by-stage progress.
5. Configuration: administrator invitation, modules, hospital settings and tariffs.
6. Verification: automated checks and recorded manual workflow results.
7. Training: responsible person, completion evidence and outstanding work.
8. Go-live review: readiness summary and explicit authorized approval.

Persist drafts with a revision number to prevent concurrent editors overwriting each other. Validate transitions on the server and return specific blockers. Store requested modules separately from confirmed deployed modules. Separate onboarding, infrastructure, operational and subscription status. Changing checklist progress must not imply deployment success.

Deliver permission-gated UI for the billing and configuration commands needed by the pilot. Show unsupported operations explicitly rather than presenting queue acceptance as completion.

## Milestone 2: provisioning worker

Run a separately deployed server worker, independent of the browser and short-lived page requests. Reuse platform_jobs, extending it with durable step records, resource bindings, next retry time and sanitized job events.

Implement atomic job claiming, expiring leases, heartbeats and lease-token-checked completion. Serialize conflicting operations per hospital. Revalidate authorization, approval revision and hospital eligibility at execution time, including retries.

Stages:

1. Validate approved configuration and provider prerequisites.
2. Discover or create the dedicated Supabase project.
3. Wait for project readiness.
4. Apply the versioned tenant schema manifest and verify migration checksums.
5. Configure tenant identity, modules and initial settings.
6. Discover or create the Vercel project and configure server-managed environment values.
7. Deploy a pinned, tested application revision and wait for readiness.
8. Verify deployment identity, tenant mode and required database capabilities.
9. Record confirmed resources and mark ready for administrator setup/review.

Persist provider resource IDs after each stage. When creation times out, reconcile with the provider before retrying; never blindly create another project. Retry transient failures with bounded exponential backoff and jitter. Treat invalid credentials, unsupported capabilities and quota exhaustion as operator-action blockers.

Preserve partial infrastructure after failure. Provide explicit recovery instructions and a separately approved cleanup procedure. Never automatically delete a hospital database.

## Milestone 3: secure configuration and invitations

Keep provider credentials in the worker's secret store; never in VITE variables, job payloads, audit JSON or browser responses. Restrict provider accounts, organizations, project bindings and deployment origins to server-managed allowlists. Use the narrowest supported credentials and document rotation.

Provision the administrator only in the bound hospital Auth project. Use invitation acceptance, not an emailed or browser-visible generated password. Verify tenant administrator membership after acceptance. Handle existing accounts and retries without promoting unrelated accounts or repeatedly sending invitations.

Use a restricted tenant operations interface for configuration and aggregate health reporting. The platform owner's session must not confer access to clinical records. Verify module licensing on the server before deployment.

## Milestone 4: commercial automation

Connect plan editing, subscription assignment, invoice generation and manual reconciliation to the existing authorized commands. Add server-side scheduled reminders and due-state evaluation. Integrate one payment provider first, with signature verification, provider-side payment verification, amount/currency matching and duplicate-event handling.

Overdue billing creates notices and review tasks. It must not automatically suspend essential clinical workflows. Operational suspension remains a distinct, explicitly approved action.

## Milestone 5: readiness and pilot launch

Go-live requires all of the following:

- Confirmed dedicated resource bindings and successful deployment.
- Expected schema version and tenant instance identity.
- Administrator invitation accepted and required account protection verified.
- Approved subscription and module configuration.
- Automated access-isolation tests and human clinical workflow sign-off.
- Successful backup and demonstrated restoration in an isolated recovery environment.
- Training evidence, support contact and rollback/recovery instructions.
- An authorized approval tied to the current configuration revision.

Deploy one explicitly designated test hospital using synthetic data. Do not count queue submission or a successful HTTP response as an end-to-end pilot.

## Validation and acceptance

Test worker restart after every stage, expired leases, concurrent workers, duplicate requests, provider timeouts after resource creation, migration failures, invitation retries and revoked permissions. Verify that each case resumes safely without duplicate infrastructure or false success.

Test wizard draft reload, back navigation, validation messages, role permissions and stale approval invalidation. Test provider adapters with contract fixtures, then validate actual management capabilities in the designated provider accounts.

The pilot passes when registration through approved launch is completed through CareLink, failures and retries are visible, the administrator can use the dedicated HMIS, isolation checks pass, and a second pilot repeats the same workflow without manual SQL or dashboard provisioning.

## External setup required before live provisioning

Confirm the Supabase organization, permitted region, project capacity and spending limit; Vercel team, deployment permissions and project capacity; worker hosting; secret storage; invitation email delivery; backup capabilities; and the test hospital's authorized administrator. Check current provider management API capabilities before implementing adapters. Never request credentials in chat; configure them through the chosen server secret store.

## Delivery order

Deliver and test the wizard/schema additions first, then the worker and provider adapters, then administrator/configuration flows, commercial controls and go-live gates. Each change must have migration instructions and rollback/recovery notes. Production SQL execution and real infrastructure creation remain distinct from source-code delivery.
