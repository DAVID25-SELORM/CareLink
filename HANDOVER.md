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

## 8. Product review for real facilities (2026-11-17)

About 50 modules exist (patients, appointments, queue, triage, OPD encounters, nursing, MAR, wards and beds, lab, radiology,
pharmacy, theatre, maternity, blood bank, billing, cashier, claims, DHIMS2 export, HR, procurement, portal, telemedicine).
Breadth is not the blocker. Depth, safety and operations are.

**Built in this pass**
- Prescribing safety (`src/lib/drugSafety.js`, wired into `Prescriptions.jsx`): checks recorded drug allergies (including
  drug classes) and common serious interactions before saving; the prescriber must confirm, and overrides are audited.
  It is a curated list, not a full drug database. Verified by a direct Node run and lint. The Vitest file
  `src/__tests__/drugSafety.test.js` could not start (worker timeout, low memory), so it is unrun.

**Gaps to build next (priority order)**
1. Pre-launch blockers: shared-mode conversion on a restored copy, Pro and PITR backups, SMTP, Sentry.
2. Patient consent and privacy notice capture (Data Protection Act 2012, Act 843, treats health data as special personal data). Only 1 file mentions consent today.
3. SMS appointment and result reminders (3 files mention it; no confirmed provider).
4. Mobile money payment collection at the cashier (Ghana norm; no provider integration confirmed).
5. Printable receipts, wristbands and queue tickets; CSV export for finance and stock reports.
6. Lab reference ranges with critical-value alerts; expiry and low-stock alerts in pharmacy.
7. Immunisation schedule and child welfare; chronic care recall lists.
8. Day-close cash reconciliation, refunds and voids with approval.
9. Staff training material and a facility go-live checklist.

**Market note.** The Ministry of Health has named GHIMS as the authorised system for public facilities (eligibility,
billing, NHIA claims, referrals). CareLink is best aimed at private hospitals and clinics until its position for public
facilities is confirmed with NHIA/MoH. Sources: Graphic Online and MyJoyOnline coverage of the GHIMS rollout.

**Added after review (2026-11-17, uncommitted)**
- Patient consent: registration now requires treatment and privacy consent (optional SMS consent), records notice version, time and recorder, and audits it. Stored as columns on `patients` by `migrations/029_patient_consent.sql` (no new table, so shared-tenancy policies and drift baseline are unaffected). **Apply 029 before deploying.** Until then the app registers without consent fields and warns the user. Existing patients have no consent recorded.
- Receipts: Cashier "Completed" tab has Print and Download per payment (`generatePaymentReceiptPDF`, amount taken from the payment). Fixed the Billing receipt number (was a full UUID) and the hospital phone/email missing from PDF headers. Not tested in a browser; the PDF table step could not run in Node, the build and lint pass.
- Not verified: new Vitest file for drug safety; migration 029 not run in Docker (it is plain ALTER TABLE ADD COLUMN IF NOT EXISTS).
- Lab critical values (`src/lib/labCritical.js`): adult panic limits for Hb, platelets, WBC, potassium, sodium, glucose, calcium and creatinine, applied only when the unit is recognised. Used in Laboratory and Sample Tracking. A critical result shows a red banner, a persistent toast, an urgent notification to the ordering doctor, an audit event, and `result_flag` critical_low/critical_high (already allowed by migration 014). Limits are common adult defaults: have the facility lab lead confirm them. Not tested in a browser; unit logic verified by a direct Node run. `src/__tests__/labCritical.test.js` is unrun (worker timeout).
- Pharmacy (`src/lib/drugAlerts.js`, `Pharmacy.jsx`): the low-stock and expiry tabs already existed. New: dispensing is now blocked for expired stock, near-expiry (30 days) needs confirmation and is audited, and the overview shows a red banner for expired and out-of-stock drugs. Expiry is per drug record, not per batch: if a facility holds several batches of one drug, record the earliest expiry. Per-batch stock is a larger change still to build. Logic verified by direct Node run; `src/__tests__/drugAlerts.test.js` unrun (worker timeout); lint and build pass.
- Per-batch stock (`src/lib/drugBatches.js`, `src/components/DrugBatches.jsx`, Pharmacy "Batches" tab): uses the existing `drug_batches` table (already in the live schema and the shared-tenancy manifest, writable by admin and pharmacist), so no migration and no catalog change. Receive a delivery as a batch (opening batch created from existing unbatched stock the first time), see every batch, quarantine, release or recall. Dispensing takes first-expiry-first-out for drugs that have batches, blocks when in-date stock is short, and keeps `drugs.stock` as the total and `drugs.expiry_date` as the earliest live batch. Drugs without batches behave as before. Known limits: client-side sequence with best-effort rollback of batch quantities, not one database transaction (a failure after some drug-stock updates can leave drugs.stock out of step; reconcile in Manage); quarantined stock still counts in `drugs.stock`; no supplier or purchase-order link in the receive form yet; no browser test; `src/__tests__/drugBatches.test.js` unrun (worker timeout), logic verified by direct Node run; lint and build pass.
- Correction: a `consent_records` table already exists (migration 005/013, in the tenancy manifest) with consent type, method, witness and revoke dates. Registration consent was built as columns on `patients` (029) for a simple required check. If you want withdrawal, witness and per-purpose history, move to `consent_records` later.
- SMS appointment reminders: Edge Function `supabase/functions/send-appointment-reminders` (handler + 6 passing node tests), button "SMS tomorrow's reminders" on Appointments, and an "Agrees to SMS reminders" tick on the patient page. Texts only patients with recorded SMS consent, reads the phone from the patient record (never from the caller), sends only for scheduled appointments, and never twice (`appointments.reminder_sent_at`, migration 030). The SMS key lives in Edge Function secrets, not the database. **To go live:** apply migrations 029 and 030, create an SMS provider account (Arkesel adapter written; check its current API docs), register a sender ID, set secrets `SITE_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`, run `supabase functions deploy send-appointment-reminders`, then send one test reminder to your own number. Never run against a real provider from here: the provider call is untested. Existing patients have no SMS consent until staff tick it. No automatic daily schedule yet (staff click the button); a Supabase scheduled call can be added later. Whether the hospital header reaches the function in shared mode is unverified.
- SMS settings page rebuilt (`NotificationSettings.jsx`): provider keys can no longer be entered in the browser (the old page stored them in `notification_settings`, which the browser could read, and never sent anything). It now has Send SMS (patient must have SMS consent; number comes from the patient record), a Sent log (from the audit log: who, when, type and length, never the message text) and a Gateway page explaining the server secrets. New Edge Function `send-sms` (5 node tests) shares a provider adapter and phone helper with the reminder function under `supabase/functions/_shared`. Removed: WhatsApp, templates and the old notification_* tables from this page (they are bound to the old `hospitals`/`users.hospital_id` model and do not fit either mode). Deploy: `supabase functions deploy send-sms` with the same secrets. **Cleanup to do on the live database:** any real keys previously typed into `notification_settings` should be treated as exposed: rotate them, then clear the table. Unverified: provider call, shared-mode header, browser behaviour. The page is admin-only; the function also allows doctor, nurse, records and reception.
- Lab reference ranges by age and sex (`src/lib/labRanges.js`): haemoglobin, haematocrit, RBC, WBC, creatinine (mg/dL and µmol/L), uric acid, ALT, GGT, ALP and HDL now use child/male/female ranges, applied in Laboratory and Sample Tracking; the report shows the basis, e.g. "12 - 15.5 g/dL (female)". A range is replaced only when the unit matches and the patient's age and/or sex is known; otherwise the catalog default stays. Values are common textbook ranges: **each facility's lab lead must confirm them** against their analyser. Critical-value limits (labCritical) are still adult limits, so children's critical values are not covered. Neonates and pregnancy are not handled. Logic verified by direct Node run (10 checks); `src/__tests__/labRanges.test.js` unrun (worker timeout); lint and build pass; not tried in a browser.
- **Possible live-schema problem to check:** the schema snapshot of the live database has no `patients.date_of_birth` column, but registration always sends it, and migration 009 is what adds it. If 009 was never applied live, patient registration fails with a column error. Run `select column_name from information_schema.columns where table_name='patients' and column_name='date_of_birth';` on the live project. If empty, apply migration 009. Lab ranges use `age` when date_of_birth is missing, so they work either way.
- Child welfare and immunisation (`/child-welfare`, `src/pages/ChildWelfare.jsx`, `src/lib/epiSchedule.js`, **migration 031 adds the `immunizations` table**): Ghana GHS schedule (BCG, OPV, Hep B birth, Penta, PCV, Rota, IPV, malaria vaccine, MR, yellow fever, Men A, vitamin A to 5 years, HPV at 9) read from ghs.gov.gh/immunisation on 2026-11-17. Per child: due dates from birth date, status (given, due, due soon, overdue after 28 days, rotavirus past age limit), record a dose (date, batch, site, notes; one row per vaccine per child; audited), weight entries with a drop alert, and an overdue list for children under 5 with guardian phone for tracing. Needs `patients.date_of_birth` (migration 009); if missing, children show "no birth date" and saving one fails with a message. **The source page repeated the 6-week doses under "At birth"; I treated birth as BCG, OPV0, Hep B only. Have your immunisation lead confirm the whole schedule.** Not built: weight-for-age growth scoring (needs official WHO tables), recording doses given elsewhere with source, SMS recall to guardians (could reuse send-sms), catch-up minimum intervals.
- Shared-tenancy bookkeeping for the new table: added `immunizations` to the 007 manifest, 008 role list, module-permissions, table-inventory, empty-database check, schema and access catalogs; regenerated the fixture and drift baseline (818 fingerprints, +6). Docker: full-schema test and conversion rehearsal both PASS with it. The live drift check will report these 6 as missing until migration 031 is applied. The Docker harness timeout is now configurable (`DOCKER_TIMEOUT_MS`) because it failed at 60s on this memory-starved PC. Node tests 37/37, lint and build pass; `src/__tests__/epiSchedule.test.js` unrun (worker timeout); page not tried in a browser.


### Immunisation SMS recall
The Overdue list on the Child Welfare page can text a guardian ("Send SMS") or all eligible guardians ("Text all eligible"). It reuses the `send-sms` function, so consent and the phone number come from the patient record on the server. The text never names vaccines. Each send is audited as `send_sms` with kind `immunisation_recall`; children texted in the last 14 days are skipped or need a confirm. No database change. Recall consent is the SMS consent on the child record (guardian phone), which staff must confirm is the guardian's number. `src/__tests__/immunisationRecall.test.js` is unrun in Vitest (worker timeout); the same logic was checked in Node. Not tried in a browser; needs `send-sms` deployed with provider secrets.


### Mobile money at the cashier
Mobile money and card payments now require a transaction ID/receipt number (6-30 letters/digits, normalised to upper case) and a mobile money network; a reference already on another payment is refused (`src/lib/paymentReference.js`, `Cashier.jsx`). Payments are still **confirmed by the cashier** against the provider confirmation SMS or wallet statement; no provider API (MTN MoMo, Hubtel, Paystack) is connected, so there is no automatic prompt-to-pay or reconciliation. The duplicate check is application-side only (two cashiers saving the same reference at the same instant could both pass); a unique index would need existing data checked first. `src/__tests__/paymentReference.test.js` unrun in Vitest; same logic checked in Node. Not tried in a browser.
