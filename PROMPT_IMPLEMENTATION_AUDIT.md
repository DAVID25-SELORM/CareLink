# Prompt Implementation Audit

This document maps the original prompt history to the current `CareLink HMS` codebase.

Status keys:

- `Done`: implemented in the current web app or supporting docs
- `Partial`: present, but incomplete or only documented
- `Missing`: not implemented in the current repo

## Phase 1: Starter Project

| Requirement | Status | Notes |
| --- | --- | --- |
| React + Vite project | Done | Vite app is configured in `package.json` and `vite.config.js`. |
| Folder structure with `components`, `pages`, `hooks`, `layouts` | Done | Present under `src/`. |
| Folder structure with `services` | Done | `src/services/auditLog.js` is present and used by the app. |
| Supabase client via env vars | Done | `src/supabaseClient.js` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| Email/password auth | Done | Implemented in `src/hooks/useAuth.jsx`. |
| Role-based access | Partial | Role-aware sidebar and route guards exist, but deeper feature-level authorization still depends on backend/RLS. |
| Protected routes | Done | Implemented in `src/components/ProtectedRoute.jsx` and `src/App.jsx`. |
| Login page | Done | `src/pages/Login.jsx`. |
| Dashboard page | Done | `src/pages/Dashboard.jsx`. |
| Patient registration page | Done | `src/pages/PatientRegistration.jsx`. |
| Patient list page | Done | `src/pages/Patients.jsx`. |
| Fetch and insert patient data in Supabase | Done | Registration and listing are implemented. |
| Loading and error states | Done | Present across main pages. |
| Toast notifications | Done | Uses `react-toastify`. |
| Basic validation | Partial | HTML-level validation exists, but no schema-based validation library is used. |
| Simple hospital-style UI with Tailwind | Done | Tailwind is configured and used throughout. |
| Sidebar with Dashboard and Patients | Done | Expanded beyond the starter scope. |

## Phase 2: Pharmacy, Billing, Claims

| Requirement | Status | Notes |
| --- | --- | --- |
| Pharmacy dashboard | Done | `src/pages/Pharmacy.jsx`. |
| List prescriptions | Done | Pharmacy page fetches prescriptions and linked items. |
| Mark prescription as dispensed | Done | Updates prescription status and deducts stock. |
| Automatic stock deduction | Done | Implemented in `src/pages/Pharmacy.jsx`. |
| Drug management page | Done | `src/pages/DrugManagement.jsx`. |
| Add new drug form | Done | Implemented in drug management. |
| Show stock levels | Done | Drug inventory page shows stock and low-stock state. |
| Billing system | Done | `src/pages/Billing.jsx`. |
| Calculate bill from prescription | Done | Billing totals prescription item prices. |
| Payment methods: cash, momo, insurance | Done | Billing page supports those modes. |
| Claims record created for insurance payments | Done | Claim creation is handled in `src/pages/Billing.jsx`. |
| Claims page with status updates | Done | `src/pages/Claims.jsx`. |
| Sidebar with pharmacy, billing, claims | Done | Added in `src/layouts/DashboardLayout.jsx`. |
| When bill is paid, update payment status | Done | Payments are inserted with `status: completed`. |
| NHIS support in patient records | Done | Patient registration/list pages include NHIS fields. |
| MoMo provider support (MTN, Telecel, AirtelTigo) | Partial | Schema supports `momo_provider`, but the UI does not collect or manage provider details yet. |
| Stock alerts if stock < 10 | Done | Reflected in dashboard and drug inventory UI. |
| Doctor-facing prescription entry | Done | `src/pages/Prescriptions.jsx` creates prescriptions and prescription items for pharmacy and billing. |

## Phase 3: Mobile App

| Requirement | Status | Notes |
| --- | --- | --- |
| React Native / Expo app | Missing | No mobile project exists in this repo. |
| Mobile auth | Missing | Not implemented. |
| Bottom-tab mobile navigation | Missing | Not implemented. |
| Mobile patients screen | Missing | Not implemented. |
| Mobile prescription screen | Missing | Not implemented. |
| Mobile dashboard | Missing | Not implemented. |
| Shared Supabase mobile setup | Missing | Not implemented. |

## Phase 4: Production, Security, Reports, Branding

| Requirement | Status | Notes |
| --- | --- | --- |
| Reports dashboard | Done | `src/pages/Reports.jsx` with charts and analytics. |
| Claims summary in reports | Done | Implemented in reports analytics. |
| Revenue trends | Done | Implemented in reports analytics. |
| Vercel deployment config/docs | Done | `vercel.json`, `DEPLOYMENT.md`, `QUICKSTART.md`. |
| Pitch deck / product docs | Done | `PITCH_DECK.md` and supporting docs are present. |
| RLS guidance | Done | Documented in `DATABASE_SETUP.md`. |
| RLS actually configured in backend | Partial | Documented, but depends on the real Supabase project being configured. |
| Automatic backups | Partial | Mentioned in docs, not verifiable from the repo alone. |
| HTTPS in production | Partial | Covered by Vercel if deployed, but live deployment is not confirmed here. |
| Real Vercel deployment | Partial | Deployment config exists, but a live deployed instance is not confirmed in this repo. |
| Product branding colors/name/tagline | Done | Reflected in docs and Tailwind theme. |
| Real logo asset | Missing | No `public/logo.png` or equivalent branding asset exists. |

## Advanced Features Prompt

| Requirement | Status | Notes |
| --- | --- | --- |
| Lab module | Done | `src/pages/Laboratory.jsx`. |
| Appointment system | Done | `src/pages/Appointments.jsx`. |
| Claims workflow with timestamps | Done | Claims support pending/submitted/approved timestamps. |
| Reports page added to sidebar | Done | Implemented. |
| Basic notification system in UI | Partial | Toast notifications exist, but no dedicated notification center or alert feed. |
| Alerts for new prescriptions | Missing | No dedicated alert workflow yet. |
| Alerts for low drug stock | Partial | Low stock is visible in UI, but not emitted as a notification feed. |
| Analytics for revenue, drugs, claims | Done | Reports page covers these. |
| Audit log in database schema | Done | `audit_log` table is documented in `DATABASE_SETUP.md`. |
| Audit log writes from app code | Done | Core create/update flows now attempt to write to `audit_log` through `src/services/auditLog.js`. |

## Business / Product Prompt

| Requirement | Status | Notes |
| --- | --- | --- |
| CareLink branding docs | Done | Present in docs and metadata. |
| Pitch deck content | Done | `PITCH_DECK.md`. |
| Sales / deployment narrative | Done | Several markdown docs cover positioning and rollout. |
| Logo design asset | Missing | Not present in the repo. |
| Demo script | Missing | No dedicated demo script file found. |

## Current Technical Blockers

- The app is still using placeholder Supabase credentials in `.env`.
- No live Supabase backend connection is confirmed from this repo.
- `npm run lint` is not usable because there is no ESLint config file.

## Highest-Value Next Steps

1. Replace `.env` placeholders with real Supabase project values.
2. Configure the real Supabase project using `DATABASE_SETUP.md`, including RLS.
3. Enable `audit_log` insert policies in Supabase so the new client-side audit writes can succeed.
4. Add a proper notification center for low stock, new prescriptions, and appointments.
5. Add MoMo provider selection for `cash / momo / insurance / card` payment flows.
6. Build the separate Expo mobile app if Phase 3 is still in scope.
