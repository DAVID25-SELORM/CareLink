# CareLink production handover (2026-11-12)

**Verdict: still not ready for real patient data.** The code, the conversion bundle and the rehearsals are ready.
The blockers that remain are account actions only you can take, plus two checks I could not run from here.
**Nothing in this work was applied to production.** The live database, Supabase settings and Vercel settings are unchanged.

## 1. What I could and could not do

| Phase | Result |
|---|---|
| 0 Accounts (Supabase Pro + PITR, SMTP, Sentry, MFA decision) | **Yours.** Needs your billing and DNS. Not done. |
| 1 Restore rehearsal on a copy | **Not done.** Needs Pro/PITR and your Supabase access. The conversion bundle was rehearsed on a Docker database seeded like production instead (passes). |
| 1 Live drift check | **Not done.** The Chrome I control is signed into a different Supabase organisation (it shows HealthFlow Pharmacy, not the CareLink project), so it cannot open the CareLink project. Tooling is ready: see section 4. |
| 1 SECURITY DEFINER review | **Not done.** The 6 flagged functions' names are not in any file I have. A read-only query is ready: `definer-exposure.sql`. |
| 2 Shared-mode regressions | **Fixed in code** (section 2). |
| 2 Browser acceptance with two hospitals | **Not done.** Needs a running Supabase (auth + API); only the SQL layer is tested in Docker. |
| 3 Production conversion window | **Not done, deliberately.** Gated on Phase 0 and 1 and your explicit approval. |
| 4 Admin creation | **Built, not deployed** (section 2). |

## 2. What changed in the repository (branch `conversion-readiness`, uncommitted)

- **Shared mode crash fixed.** `NotificationCenter` and `QueueManagement` called `supabase.channel(...)`, which shared mode
  forbids by throwing, so those components would have crashed on render. New `src/services/liveUpdates.js` uses realtime
  in dedicated mode and polls every 20 seconds in shared mode. Tests in `src/__tests__/liveUpdates.test.js`.
- **Shared-mode audit events.** Sign-in is now audited after a hospital is chosen, and sign-out is audited when a
  hospital is selected (`src/hooks/useAuth.jsx`). Previously both were skipped. Not covered by an automated test.
- **Create administrator from the console.** Button text is now "Create administrator login and send invitation"
  (`src/components/SharedHospitalOperations.jsx`). It registers the invitation, then calls the Edge Function
  `supabase/functions/invite-hospital-admin`, which uses the service key to email an invite link to the hospital's
  **registered owner email only**. Only a platform owner can call it. The invite link lands on `/reset-password` to set a password.
  Tests: `tests/invite-hospital-admin.node-test.mjs` (6) and `src/__tests__/SharedHospitalOperations.test.jsx` (3).
  **Not deployed and never run against a real Supabase project.**
- **Drift tooling.** `design/shared-tenancy/live-drift-fingerprint.sql`, `drift-compare.mjs` and `drift-expected.tsv`
  (812 fingerprints from the tested fixture: 407 policies, 45 functions, 79 triggers, 141 grants, 140 RLS flags).
- `design/shared-tenancy/definer-exposure.sql` for the SECURITY DEFINER review.

## 3. Verified in Docker (disposable databases, no provider access)

- `npm run test:conversion`: PASS (conversion bundle on a production-shaped seed).
- `node design/shared-tenancy/test-docker.mjs --full-schema`: PASS (all drafts, two hospitals).
- Edge Function handler: 6 node tests pass. Test results for the app suites are in section 6.

## 4. Do these next, in order

**You (accounts)**
1. Supabase **Pro + point-in-time recovery** on the CareLink project. Then restore it into a new project and tell me.
2. **Custom SMTP** (Resend or Brevo): Authentication, Emails, SMTP. Add `https://care-link-l6u9.vercel.app/reset-password` to the redirect allow-list (done) and raise the email rate limit. The invite and password-reset emails both need this.
3. Sentry project and `VITE_SENTRY_DSN` in Vercel. Decide `VITE_REQUIRE_STAFF_MFA` after the owner and the Health Medics admin enrol.
4. Pick one production Vercel project (`care-link-l6u9` vs `care-link`) and remove the double deploy.

**You, with me (needs a Chrome signed into the CareLink Supabase account)**
5. Run `design/shared-tenancy/live-drift-fingerprint.sql` in the CareLink SQL editor, export the result as CSV, then
   `node design/shared-tenancy/drift-compare.mjs <file.csv>`. Expected differences: `audit_log` only (migrations 027 and 028).
   Anything else: stop and tell me.
6. Run `definer-exposure.sql` and send me the rows.
7. Verify 028: `select policyname from pg_policies where tablename='audit_log' order by 1;` should return only
   `audit_log_insert_self`, `audit_log_no_updates`, `audit_log_select_admin_or_self`, `carelink_tenant_boundary`.

**Then**
8. Deploy the function: `supabase functions deploy invite-hospital-admin`, and set the secret `SITE_URL=https://care-link-l6u9.vercel.app`.
9. Restore a copy, run the conversion bundle there, build with `VITE_TENANCY_MODE=shared`, and walk the browser flow with two
   hospitals (register, invite, accept, launch, role matrix, hospital A cannot see hospital B). I have not done this.
10. Only then follow `design/shared-tenancy/CONVERSION_RUNBOOK.md` for the window. Ask me before any production step.

## 5. Important corrections and limits

- **The live database is in `platform` mode, so hospital staff logins cannot access clinical data until the conversion.**
  Earlier I suggested creating the Health Medics admin directly in Supabase; that login would be denied. Do not rely on that path.
- The go-live gate (platform console) lists blockers that cannot be recorded in the current mode: deployment, admin
  acceptance, account protection and support evidence. They become available in shared mode. The gate was not weakened.
- Realtime and storage remain denied in shared mode. Queue and notifications now poll instead. Offline writes are still disabled.
- Password-reset emails do not arrive for most users until SMTP is configured (Supabase's built-in sender only reaches your team).
- `.claude/` is untracked and was left alone.

## 6. Test results

- Lint: clean. Production build and `VITE_TENANCY_MODE=shared` build: both pass.
- Node tests (app, worker, shared client, Edge Function handler): 50 of 50 pass.
- Vitest: all files pass. 12 files (40 tests) passed in the main run. `Login.test.jsx` and `MfaGate.test.jsx` could not
  start in that run (worker timeout, about 0.5 GB of 12 GB memory free), so they were re-run alone with `--maxWorkers=1`
  once memory was available: 2 files, 8 tests pass.

Commands that reproduce these:

```bash
npm run lint && npx vitest run --maxWorkers=2     # app tests (this machine is busy: default workers time out)
node --test tests/*.node-test.mjs worker/*.node-test.mjs worker/providers/*.node-test.mjs
npm run test:conversion
node design/shared-tenancy/test-docker.mjs --full-schema
node design/shared-tenancy/drift-compare.mjs expected   # regenerate drift-expected.tsv (Docker)
```

## 7. Branches and deployment state

- `origin/main` = `c25db42` (password reset page, go-live blocker clarity), deployed by Vercel.
- `conversion-readiness` holds this work. Merging it to `main` changes the production app (the shared-mode code only
  activates with `VITE_TENANCY_MODE=shared`; the dedicated-mode behaviour is unchanged apart from audit and polling wrappers).
