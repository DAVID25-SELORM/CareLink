# CareLink browser test script

Run this on a **staging deploy or a restored copy** of the `conversion-readiness` branch, never first on production data.
Use made-up patients only. Tick each line; write down anything that differs under "Notes". Allow about 90 minutes.

**Before you start**
- Migrations 029, 030, 031 are applied (and `date_of_birth` exists on `patients`).
- You have one login for each role: admin, doctor, nurse, pharmacist, cashier. Use a second hospital's admin for section 9 if the shared conversion is active.
- Open the browser developer console (F12) and keep it visible. **Any red error that appears while you click is a failure**; copy it into Notes.
- Create two test patients: **Test Adult** (age 40, phone `0244000001`) and **Test Baby** (born about 4 months ago, phone `0244000002`).

---

## 1. Registration and consent
Login: nurse or records officer.
1. Register Test Adult. Tick treatment and data-processing consent and "agrees to SMS". Save. **Expect:** saved, no error.
2. Open Test Adult's page. **Expect:** "Agrees to SMS reminders" is ticked. Untick, tick again. **Expect:** no error.
3. Register Test Baby with the birth date set and without SMS consent. **Expect:** saved.
4. Try to save a registration with data-processing consent unticked. **Expect:** it is refused with a clear message.
5. On Test Adult's page click **Print wristband**. **Expect:** a small landscape label with name, ID, age, sex and "no known allergies recorded". Add an allergy "Penicillin" in the clinical record and print again. **Expect:** `ALLERGY: PENICILLIN`.

## 2. Queue ticket
Login: nurse or receptionist.
1. Queue Management: add Test Adult to OPD. **Expect:** appears with a queue number.
2. Click **Ticket**. **Expect:** a small ticket with the hospital name, big number, first name only, time. No diagnosis or full name.

## 3. Prescribing safety
Login: doctor.
1. Record a penicillin allergy for Test Adult. Prescribe amoxicillin. **Expect:** a warning naming the allergy and asking you to confirm. Cancel, then confirm once. **Expect:** it saves only after confirming; the audit log shows `prescribe_safety_override`.
2. Prescribe two drugs with a known serious interaction (for example warfarin with an NSAID). **Expect:** an interaction warning.

## 4. Laboratory
Login: lab technician.
1. Enter a haemoglobin result of 4 g/dL for Test Adult. **Expect:** flagged as **critical**, not just abnormal.
2. Enter 13 g/dL. **Expect:** normal. Enter the same for Test Baby. **Expect:** the range shown matches a child, not an adult.

## 5. Pharmacy and stock
Login: pharmacist.
1. Pharmacy, **Batches** tab: add two batches of one drug, one expiring in 10 days and one in 6 months. **Expect:** both listed.
2. Add a batch that is already expired. Try to dispense that drug when it is the only stock. **Expect:** blocked.
3. Dispense from the drug with both batches. **Expect:** the batch expiring first is used first, and a near-expiry warning appears for the 10-day batch.
4. **Expect:** a banner or alert listing near-expiry and expired stock.

## 6. Cashier: payment, mobile money, refund, day close
Login: cashier (steps 1 to 4), then admin (step 5), then cashier (step 6). Cashiers only see their own refund requests; admins see all.
1. Pay a pending bill by **cash**. **Expect:** saved; a receipt prints and downloads with a receipt number.
2. Pay another by **Mobile Money**. Leave the network empty. **Expect:** blocked. Choose MTN, leave the reference empty. **Expect:** blocked. Enter `AB12` (too short). **Expect:** blocked with a message. Enter `MP2611180001`. **Expect:** saved; receipt shows MOBILE MONEY (MTN) and the reference.
3. Pay a third bill by mobile money using the **same** reference `MP2611180001`. **Expect:** refused as already used.
4. As cashier, open Completed. **Expect:** no direct Refund button, only **Request refund**. Click it on the cash payment with an empty reason. **Expect:** refused. Give a reason. **Expect:** request saved; the payment stays in Completed. Open the **Refund requests** tab. **Expect:** your request shows as pending.
5. As admin, open **Refund requests**. **Expect:** the cashier's request is listed. Click **Decline** with a reason. **Expect:** it shows as declined and the payment is unchanged. Ask for it again as cashier, then as admin click **Approve**. **Expect:** the payment leaves Completed; the prescription is back in Pending; the audit log has `refund_request` and `refund_payment`. Also try the direct **Refund** button on another payment, and a payment whose medicine was already dispensed. **Expect:** refused.
6. Cashier, **Day close**, today. **Expect:** totals by method match what you took, refund shown separately and not counted. Enter counted cash equal to expected, record. **Expect:** "cash balanced". Enter a different amount with no note. **Expect:** blocked. Add a note. **Expect:** saved, shown under Recent closes with the difference.

## 7. Child welfare and SMS recall
Login: nurse.
1. Child Welfare, pick Test Baby. **Expect:** schedule with due dates from the birth date; birth doses overdue; 6, 10 and 14 week doses overdue or due; 9-month doses upcoming.
2. Click **Record dose** on BCG, today, batch `B123`. **Expect:** shows Given. Try recording BCG again. **Expect:** "already recorded".
3. Try a given date before the birth date. **Expect:** refused.
4. Record a weight of 6.0 kg, then 5.5 kg. **Expect:** a "weight has dropped" alert.
5. **Overdue list** tab. **Expect:** Test Baby appears with the overdue vaccines. The Recall column says "No SMS consent" for Test Baby.
6. Tick "Agrees to SMS reminders" on Test Baby, return, click **Send SMS**.
   - If `send-sms` is deployed with secrets: **Expect:** the text arrives on your own test phone (use your own number as the phone). It must not name any vaccine. Sending again within 14 days asks for confirmation.
   - If not deployed: **Expect:** a clear error and nothing marked as sent. Note which.

## 8. Chronic care, export, SMS page, go-live
Login: doctor, then admin.
1. As doctor, record hypertension (I10) for Test Adult in a visit, then set up the test so the last visit is older than your chosen limit (choose "30 days" if needed, or use an older test patient). Open **Chronic Care**. **Expect:** Test Adult is listed with "Hypertension". Click **Export CSV**. **Expect:** a file opens in Excel with correct columns.
2. As admin, Patients: **Export CSV**. **Expect:** a confirmation, then a file with the register. Open the audit log. **Expect:** an `export_patient_register` entry.
3. Notifications / SMS page: **Expect:** Send SMS, Sent log and Gateway tabs; no place to type a provider key. Sent log lists what you sent in section 7.
4. Appointments: book one for tomorrow for Test Adult (with SMS consent), click **SMS tomorrow's reminders**. **Expect:** one sent, and a second click sends none (already reminded).
5. As admin open **Go-live Checklist**. **Expect:** items correct for your test data (for example "A test SMS has been sent" ticks only after a real send). Tick a manual item, reload. **Expect:** it stays ticked in the same browser.

## 9. Two-hospital separation (only if the shared conversion is active)
1. Log in as admin of hospital A; note a patient name. Log in as admin of hospital B. **Expect:** that patient is not visible anywhere (patients, queue, cashier, chronic care, child welfare, exports, day close totals).
2. Run a day close in each hospital. **Expect:** totals never include the other's payments.

## 10. Roles
1. Cashier tries `/child-welfare`, `/chronic-care`, `/go-live`. **Expect:** not allowed.
2. Nurse tries `/go-live` and the Refund button. **Expect:** not allowed.
3. Pharmacist tries `/cashier`. **Expect:** not allowed.

---

## Result
- Total failures: ____
- Blocking (do not onboard until fixed): ____
- Date, tester, deploy URL: ____________________

Send the failures, with the browser console text and which step, back to be fixed.
