# CareLink HMS - Hospital Onboarding Checklist

Use this checklist each time you onboard a new hospital onto CareLink HMS.

Optional internal tracking:

- Run [hospital-onboarding-setup.sql](./hospital-onboarding-setup.sql) in your own CareLink owner instance
- Then use the in-app `/hospital-onboarding` page to track rollout status, tasks, and go-live readiness
- This tracks implementations; it does not automatically provision Supabase or Vercel

---

## Current Deployment Model

CareLink currently works best as a dedicated deployment per hospital:

- one Supabase project per hospital
- one Vercel project per hospital
- one set of environment variables per hospital
- one hospital database per deployment

This is the safest onboarding model for now because the app is not yet built as a shared multi-tenant platform.

---

## Phase 1: Client Intake

- [ ] Confirm hospital legal/business name
- [ ] Confirm hospital contact person
- [ ] Confirm admin/owner email for first login
- [ ] Confirm hospital phone and address
- [ ] Confirm preferred public URL or subdomain
- [ ] Confirm branding assets:
  - logo
  - favicon
  - primary brand color
  - secondary brand color
- [ ] Confirm which modules the hospital wants at go-live:
  - patients
  - appointments
  - laboratory
  - pharmacy
  - billing
  - claims
  - nurse dashboard
  - records dashboard
  - referrals
- [ ] Confirm expected go-live date
- [ ] Confirm whether sample/demo data is allowed in their environment

---

## Phase 2: Technical Provisioning

- [ ] Create a fresh Supabase project for the hospital
- [ ] Create a fresh Vercel project for the hospital
- [ ] Add environment variables in Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- [ ] Add production site URL in Supabase Auth URL Configuration
- [ ] Add redirect URLs for:
  - `/`
  - `/login`
  - `/dashboard`
- [ ] Confirm Email provider is enabled in Supabase Auth

---

## Phase 3: Database Setup

- [ ] Run [database-setup.sql](./database-setup.sql)
- [ ] Create the owner/admin Auth user in Supabase Authentication
- [ ] Run [setup-users.sql](./setup-users.sql)
- [ ] Confirm `ids_match = true` for the owner account
- [ ] Run [hospital-profile-setup.sql](./hospital-profile-setup.sql)
- [ ] Run optional module scripts only if the hospital needs them:
  - [nurse-system-setup.sql](./nurse-system-setup.sql)
  - [records-system-setup.sql](./records-system-setup.sql)
  - [referrals-setup.sql](./referrals-setup.sql)
- [ ] Do not run [sample-data.sql](./sample-data.sql) in production unless the hospital explicitly wants a sandbox/demo environment

---

## Phase 4: Account Onboarding

Use this rule:

- `setup-users.sql` is for the owner account and optional test users
- real hospital staff should be created from the in-app User Management screen after the owner logs in

Checklist:

- [ ] Login with owner/admin account
- [ ] Create real hospital staff from User Management
- [ ] Confirm required roles exist:
  - admin
  - doctor
  - pharmacist
  - nurse
  - cashier
  - records_officer
- [ ] Confirm doctor specialties are assigned where needed
- [ ] Confirm nurse type is assigned where needed
- [ ] Remove or disable any unused demo/test accounts before go-live

---

## Phase 5: Branding and Configuration

- [ ] Open `/hospital-profile` as the hospital admin and set the hospital name
- [ ] Confirm login, sidebar, and dashboard show the hospital name under the CareLink parent brand
- [ ] Update site title
- [ ] Update logo and favicon
- [ ] Confirm CareLink branding vs hospital branding approach
- [ ] Confirm hospital-specific insurance workflow requirements
- [ ] Confirm payment methods enabled:
  - cash
  - momo
  - insurance
  - card

---

## Phase 6: Functional Go-Live Test

- [ ] Owner/admin login works
- [ ] Patient registration works
- [ ] Appointment booking works
- [ ] Prescription creation works
- [ ] Pharmacy dispensing works
- [ ] Billing works
- [ ] Insurance claim creation works
- [ ] Laboratory request and result flow works
- [ ] Nurse dashboard works if enabled
- [ ] Records dashboard works if enabled
- [ ] Referrals work if enabled
- [ ] Reports page loads without permission errors
- [ ] Mobile layout is usable on phone width

---

## Phase 7: Data and Security Review

- [ ] Confirm no demo/test patients remain in production
- [ ] Confirm no sample drugs remain unless approved
- [ ] Confirm only real staff accounts remain active
- [ ] Confirm RLS is enabled on required tables
- [ ] Confirm Supabase backup settings are reviewed
- [ ] Confirm owner/admin password is strong
- [ ] Confirm no secret keys are stored in the repo

---

## Phase 8: Training and Handover

- [ ] Train admin/owner
- [ ] Train doctor workflow
- [ ] Train pharmacist workflow
- [ ] Train cashier workflow
- [ ] Train nurse workflow if enabled
- [ ] Train records officer workflow if enabled
- [ ] Share [USER_GUIDE.md](./USER_GUIDE.md)
- [ ] Share support contact details
- [ ] Confirm first support review date

---

## Go-Live Signoff

- Hospital name: ______________________
- Production URL: ______________________
- Supabase project: ______________________
- Go-live date: ______________________
- Owner/admin email: ______________________
- Modules enabled: ______________________
- Approved by hospital: ______________________
- Completed by CareLink: ______________________
