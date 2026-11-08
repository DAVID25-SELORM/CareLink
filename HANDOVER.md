# CareLink production audit — handover (2026-11-08)

**Verdict: not ready for real patient data yet.** The code-level blockers are fixed and tested. What remains
needs account decisions (plans, Sentry, MFA), a rehearsed database conversion, and browser acceptance testing.
**Nothing from this work is committed.** Review `git status`, then commit in logical groups.

## 1. State of the live systems (read-only checks, 2026-11-08)
| Area | State |
|---|---|
| Supabase project `CareLink` (`wjlpywztfjruqnavwsvr`, eu-west-1) | **Free plan**, no point-in-time recovery. Security Advisor: 0 errors, 59 warnings |
| Migrations 027, 028 | Applied by the owner (027 confirmed via policy list; 028 reported applied, **re-verify** with the query below) |
| Instance | `platform` mode, one hospital registered (Health Medics, onboarding), 0 patients, 11 staff, 1 platform owner |
| Schema vs tested fixture | 140 tables; columns and policy counts match, except `audit_log` (expected) |
| Vercel | Team `david25-selorms-projects`, **Hobby plan**; two CareLink projects (`care-link`, `care-link-l6u9`); `care-link-l6u9` has only the two Supabase variables, **no `VITE_SENTRY_DSN`**, billing address missing |

Verify 028: `select policyname from pg_policies where tablename='audit_log' order by 1;` should return only
`audit_log_insert_self`, `audit_log_no_updates`, `audit_log_select_admin_or_self`, `carelink_tenant_boundary`.

## 2. What changed in the repository
**Fixed**
- 12 failing tests (stale mocks) → 36 Vitest tests pass, 3 new for MFA. Lint, build, 44 worker Node tests, 20 shared-client Node tests pass.
- Dependencies: Vite 7, React Router 7, `npm audit fix`; unused `xlsx` and `src/utils/excelExport.js` removed. `npm audit --omit=dev --audit-level=high` passes (6 moderate build-tool findings remain).
- `vercel.json`: Content-Security-Policy, HSTS, Permissions-Policy, COOP (verified in Chrome against a local server using these headers; not yet on a real deployment).
- CI (`.github/workflows/ci-cd.yml`): Node 22, runs worker/shared Node tests, secret scan now fails the build, production-only audit.
- `src/components/MfaGate.jsx`: optional TOTP step-up and enrolment (Settings card). `VITE_REQUIRE_STAFF_MFA=true` forces enrolment. Client-side gate only; server-side enforcement would need `aal2` checks in RLS.
- Sign-out (and the existing 30-minute idle timeout) clears cached clinical data in the browser; unsynced queued writes are kept.
- 25 loose root SQL scripts moved to `archive/legacy-sql/` (do not run). `/migrations` remains the schema source, **but the live database has drifted from it** (policies created by hand, `audit_log` only existed in a legacy script).

**Migrations**
- `027_audit_and_function_hardening.sql` (applied): `audit_log` created in migrations, audit/report inserts must be attributable, audit rows append-only, `search_path` pinned on 9 functions.
- `028_drop_legacy_audit_policies.sql` (applied per owner): drops three hand-made policies that let all staff read/forge/delete audit rows.

**Shared tenancy (drafts, not applied)** in `design/shared-tenancy/`
- `016_audit_immutability.sql` + `audit-scope-test.sql`: members append only their own audit events, admins read their hospital's trail, no update/delete. Test fails without 016 (verified).
- `build-conversion-bundle.mjs`, `conversion-preflight.sql`, `conversion-activate.sql`: one atomic conversion file (drafts 001–016 + staff memberships + shared mode switch + postflight checks).
- `conversion-rehearsal*.sql`, `test-docker.mjs --rehearse-conversion` (`npm run test:conversion`): rehearses the bundle on a disposable database seeded like production. Passes.
- `CONVERSION_RUNBOOK.md`: live inventory, steps, rollback, known gaps. `READINESS.md` updated.

## 3. Can I create different hospitals from the UI?
- **Today: no, not working isolated hospitals.** The console registers a hospital record; provisioning then targets the old
  dedicated-project design, which runs in simulation and is unfinished.
- **After the shared conversion and a shared-mode build** (`VITE_TENANCY_MODE=shared`): yes. The console supports workspace
  preparation, administrator invitation, verification evidence, owner approval and launch (drafts 012–014, SQL-tested).
  Browser-level acceptance has not been done.

## 4. Open items, in order
**You (accounts/legal)**
1. Supabase Pro + point-in-time recovery; restore into a new project to prove it. Vercel Pro + billing address.
2. Create a Sentry project; set `VITE_SENTRY_DSN` in Vercel (no error monitoring in production today).
3. Pick the production Vercel project; delete the other CareLink project.
4. Decide MFA enforcement (`VITE_REQUIRE_STAFF_MFA`) after all admins and the platform owner enrol.
5. Rotate `worker.env`'s Supabase management token if it was ever shared; scope it narrowly. Stop the onboarding worker for shared hospitals.
6. Ghana Data Protection Commission registration, data-processing agreement per hospital, privacy notice, breach plan, cross-border (eu-west-1) review.

**Engineering**
7. Re-run the drift query on the day; extend it to policy bodies, functions, grants, triggers; bring `/migrations` in line with live.
8. Review the 6 `SECURITY DEFINER` functions the advisor flags as publicly executable (names not captured).
9. Browser acceptance of shared mode with two hospitals (registration, email confirmation, invitation, launch, role matrix).
10. Shared-mode gaps: sign-in/out audit events skipped, storage/realtime denied, offline writes disabled.
11. Hospital data lifecycle: no backup/retention step before deleting a tenant (HealthFlow's `delete_tenant` is the pattern to avoid).
12. Remaining moderate audit findings are in Workbox build tooling only.

## 5. Commands
```bash
npm run lint && npx vitest run                 # app tests
npm run test:shared                            # shared-client + 5 SQL suites (needs Docker)
node design/shared-tenancy/test-docker.mjs --full-schema   # all drafts, two hospitals
node design/shared-tenancy/test-docker.mjs --restore       # dump/restore rehearsal
npm run test:conversion                        # conversion bundle rehearsal
node design/shared-tenancy/build-conversion-bundle.mjs <hospital-uuid> conversion-bundle.sql
VITE_TENANCY_MODE=shared npm run build         # shared-mode build
```
The Docker suites occasionally time out on a slow machine (60 s per Docker call); re-run once.

## 6. Reference: how HealthFlow Pharmacy creates tenants
Single shared project, `organization_id` on every table, `*_same_org` RLS, super-admin Edge Function `tenant-signup`
(org → branch → admin login → profile → owner → settings → seed → readiness check, compensating deletes on failure).
Worth copying: readiness gate and cleanup. Worth fixing there: admin-set passwords, hard-coded delete list with no backup/retention,
an `audit_logs_insert_all` policy that allows forged audit rows.

## 7. Tooling left behind
Two Chrome tabs opened for the Supabase checks may still be open (closing them timed out). The `.claude/launch.json`
preview entry I added was removed. Scratch files live under the session scratchpad only.
