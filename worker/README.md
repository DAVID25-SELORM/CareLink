# CareLink onboarding worker

This is a separate process from the browser. It claims jobs through the service-only RPCs in migration 020, checkpoints each stage, and finishes only while its lease token is valid. Provider adapters are deliberately disabled by default. For local contract testing, set `ONBOARDING_PROVIDER_MODE=simulation`; this records stage execution without creating infrastructure.

An unset mode also selects simulation. Real execution requires both
`ONBOARDING_PROVIDER_MODE=production` and `ONBOARDING_PROVISIONING_APPROVED=true`.
Set these only after the owner approves the target organization, team and spending.
The worker checks its lease before and after provider methods and before checkpoint
or completion writes. A failed renewal stops further guarded operations; an already
accepted remote request may still finish and must be reconciled on recovery.

Run the worker tests with `node --test worker/*.node-test.mjs worker/providers/*.node-test.mjs`.

Required server environment variables are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MANAGEMENT_TOKEN`, `SUPABASE_ORGANIZATION`, `VERCEL_TOKEN`, and `VERCEL_TEAM_ID`. For deployment, set `VERCEL_GIT_REPO`, `ONBOARDING_DEPLOY_REF`, and provide the tenant SQL through the worker secret/config store as `TENANT_SCHEMA_SQL`. Never expose any management, secret, or service key through Vite variables, job payloads, logs, or browser responses. Configure provider credentials only in the worker secret store after the Supabase organization, Vercel team, region and spending limit have been approved.

Recovery pins the schema checksum and deployment commit in a provisioning_identity
checkpoint before provider writes. Changing either requires explicit reconciliation;
legacy jobs without this checkpoint cannot resume automatically. Health is checked
again on resume. This protects against changed inputs but does not constitute remote
schema verification or complete exactly-once provisioning.
