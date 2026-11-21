# CareLink go-live plan

The order of everything between today and the first real patient, who does each step, and the check that must pass
before moving on. **Do not skip a gate.** Nothing here has been executed except where marked "done".

The detailed conversion procedure is in [design/shared-tenancy/CONVERSION_RUNBOOK.md](design/shared-tenancy/CONVERSION_RUNBOOK.md).
This plan sequences it with the rest. The honest state of the product is in [HANDOVER.md](HANDOVER.md).

## Where things stand
- Production app: `main` (older build). New work: `conversion-readiness`, not merged.
- Live database: `platform` mode (hospital staff cannot use clinical data until the conversion).
- Migrations 029, 030, 031 and `patients.date_of_birth`: applied on the live database (verified 2026-11-18).
- Edge Functions `send-sms` and `send-appointment-reminders`: you ran the deploy commands; not confirmed, never tested.
- Nothing has been tried in a browser. No backups beyond the Free plan. No restore rehearsal.

---

## Gate 1: Staging browser test  (you or a trainer; about 90 min)
1. Create a **staging copy**: restore the live project into a new Supabase project (Gate 2 gives the method) or use a
   new empty project with the migrations applied. Point a separate Vercel preview of `conversion-readiness` at it.
2. Work through [BROWSER_TEST_SCRIPT.md](BROWSER_TEST_SCRIPT.md) with made-up patients.
3. Send the failures (step number and console text) back to be fixed. Repeat until **no blocking failures**.

**Gate:** zero blocking failures in the script.

## Gate 2: Backups and a restore rehearsal  (you; about 1 hour)
1. Supabase dashboard > your project > Settings > Billing: upgrade to Pro and enable **point-in-time recovery**.
   (The Free plan has neither. Check Supabase's current pricing page for the exact add-on name.)
2. Dashboard > Database > Backups: take a manual backup, note the time, then **restore to a new project**
   (feature names and availability depend on the plan; follow the current Supabase documentation).
3. In the **restored** project's SQL editor, run this and keep the numbers. They must equal the live numbers:

```sql
SELECT
  (SELECT count(*) FROM public.patients)        AS patients,
  (SELECT count(*) FROM public.users)           AS staff_profiles,
  (SELECT count(*) FROM auth.users)             AS auth_users,
  (SELECT count(*) FROM public.audit_log)       AS audit_rows,
  (SELECT count(*) FROM public.immunizations)   AS immunizations,
  (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS public_tables;
```

4. Log in to the restored app as a known user. Confirm that you can open a patient.
5. Delete the rehearsal project when finished (it costs money while it exists) after recording how long the restore took.

**Gate:** restored numbers match the live ones, and a login works on the restored copy.
(`design/shared-tenancy/restore-verify.sql` checks a test fixture, not live data; do not run it on a real restore.)

## Gate 3: Conversion rehearsal on the restored copy  (you with me; about 2 hours)
Follow "Before the window" and "Window" in the conversion runbook, but on the **restored copy**:
1. Run the drift check against the copy: `live-drift-fingerprint.sql` in the SQL editor, export as CSV, then
   `node design/shared-tenancy/drift-compare.mjs <file.csv>`. Expected: `audit_log` differences only. Anything else: stop.
2. Build the bundle with the copy's hospital id and run it with `psql -v ON_ERROR_STOP=1 -f conversion-bundle.sql`.
3. Build the app with `VITE_TENANCY_MODE=shared`, point a preview at the copy, and repeat section 9 of the browser script
   (two hospitals cannot see each other) plus sections 6 to 8.
4. Record the time the bundle took. That is the length of your downtime.

**Gate:** bundle completes, two-hospital isolation holds, role access matches the script.

## Gate 4: Merge to `main`  (you decide; I do it only when you say)
1. Open the pull request from `conversion-readiness` and read the summary.
2. Merge only after Gates 1 to 3 are clean. Merging deploys to Vercel. The shared-mode code stays inactive until
   `VITE_TENANCY_MODE=shared` is set, so existing behaviour does not change at this step.

**Gate:** Vercel deploy succeeds and the login page loads.

## Gate 5: Production conversion window  (you approve; I run only with your explicit go-ahead)
Use the runbook's "Window" and "Rollback" sections. In short:
1. Announce downtime. Take a manual backup and note the PITR timestamp.
2. Stop the onboarding worker; run the bundle with the direct connection string.
3. Set `VITE_TENANCY_MODE=shared` in the production Vercel project and redeploy.
4. Launch the hospital in the platform console. Smoke test as hospital admin, nurse and platform owner.
5. Rollback is a restore to the noted time; data entered after that is lost, so keep the window short.

**Gate:** smoke test passes; second test hospital cannot see the first.

## Gate 6: First clinic  (you and the clinic)
Before the first real patient, check the in-app **Go-live Checklist** (`/go-live`) shows every item ticked and the
manual sign-offs are confirmed: lab ranges and critical limits, immunisation schedule, consent wording,
training done with the guides in `training/`, paper downtime procedure, backups on, one named support person.
Start with **SMS off**. Switch it on after the SMS test has passed (below).

### SMS test (can be done any time before Gate 6, independent of the rest)
1. Confirm the functions exist: Supabase dashboard > Edge Functions should list `send-sms` and `send-appointment-reminders`.
2. Confirm the secrets exist (values hidden): `SITE_URL`, `SMS_PROVIDER`, `SMS_SENDER_ID`, `SMS_API_KEY`.
3. Send one message to your own phone from the SMS page. If it fails, read the function logs and send me the error.

---

## First week after go-live
Check every day for the first week, then weekly:
- **Cashier day close:** closed daily; every difference explained. Compare takings with the wallet and card reports.
- **Refund requests:** no old pending requests; reasons look sensible.
- **Audit log (admin):** unusual `prescribe_safety_override`, `refund_payment`, `export_patient_register` entries.
- **Pharmacy:** nothing expired on the shelf; batches match physical stock.
- **Duplicates:** patients registered twice; fix with the administrator, never by deleting.
- **Errors:** Sentry (when set up) or staff reports. Keep a shared list of every problem, however small.
- **Backups:** the latest backup is recent; PITR is on.
- **Staff accounts:** one login each; leavers removed.
- **Staff feedback:** ask each role one question: "What slowed you down today?"

## Stop conditions
Pause go-live and tell me if any of these happen: a patient sees or is sent another patient's data; a total does not
match what was taken; a critical lab result is not flagged; any user can open a page their role should not; the
restore rehearsal fails; the conversion bundle errors.
