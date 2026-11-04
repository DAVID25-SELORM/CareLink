# CareLink onboarding worker

This is a separate process from the browser. It claims jobs through the service-only RPCs in migration 020, checkpoints each stage, and finishes only while its lease token is valid. Provider adapters are deliberately disabled by default. For local contract testing, set `ONBOARDING_PROVIDER_MODE=simulation`; this records stage execution without creating infrastructure.

Required server environment variables are `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service key through Vite variables, job payloads, logs, or browser responses. Configure provider credentials only in the worker secret store after the Supabase organization, Vercel team, region and spending limit have been approved.
