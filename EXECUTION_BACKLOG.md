# CareLink Ghana HMS — 12-Epic Execution Backlog

> Generated from the Ghana National Care Operations Platform Blueprint
> Mapped against the current CareLink repo (April 2026)

---

## Epic 1 · Encounter-Based Clinical Workflow
**Priority:** P0 — Foundation  
**Phase:** 1 (Core Clinical)  
**Depends on:** —  
**Estimated Story Points:** 34

### Description
Replace the current "appointment → prescription" shortcut with a proper **Encounter** spine. Every patient visit creates an encounter record; diagnoses (ICD-10-GM), vitals, clinical notes, orders, and prescriptions all hang off that encounter. This unlocks downstream billing, NHIA claims, analytics, and FHIR export.

### Acceptance Criteria
- [ ] `encounters` table created with status lifecycle: `registered → in_progress → completed → cancelled`
- [ ] `diagnoses` table with ICD-10-GM code, description, rank (primary/secondary), and encounter FK
- [ ] `clinical_notes` table supports SOAP format (subjective, objective, assessment, plan) with author FK
- [ ] `vitals` table records temperature, BP systolic/diastolic, pulse, respiratory rate, SpO2, weight, height, BMI auto-calc, pain scale
- [ ] `clinical_orders` table for lab, radiology, procedure, referral order types with priority and status tracking
- [ ] Doctor Dashboard updated: clicking a patient opens encounter → vitals → diagnosis → notes → orders workflow
- [ ] `problem_list` table for persistent patient-level diagnoses across encounters
- [ ] Existing `prescriptions` table gains `encounter_id` FK (nullable for backward compat)
- [ ] Existing `lab_tests` table gains `encounter_id` FK and `order_id` FK
- [ ] All new tables have RLS policies, `updated_at` triggers, and audit_log integration
- [ ] Unit tests for encounter creation, status transitions, and cascading FKs

### Stories
1. Schema migration `001_core_clinical.sql` — create encounters, diagnoses, clinical_notes, vitals, clinical_orders, problem_list
2. Supabase service layer for encounter CRUD
3. Encounter creation UI (auto-created when doctor starts consult)
4. Vitals capture form (nurse pre-fills, doctor reviews)
5. ICD-10-GM searchable diagnosis picker (typeahead from local JSON)
6. SOAP clinical notes editor with auto-save
7. Clinical orders panel (lab, radiology, procedure)
8. Problem list sidebar on patient detail page
9. Migrate existing prescription flow to attach `encounter_id`
10. Migrate existing lab_tests flow to attach `encounter_id`

---

## Epic 2 · Nursing & Ward Management
**Priority:** P0 — Foundation  
**Phase:** 1 (Core Clinical)  
**Depends on:** Epic 1 (encounters)  
**Estimated Story Points:** 29

### Description
Extend the existing basic BedManagement (admit/discharge) into a full nursing workflow: MAR (Medication Administration Records), fluid balance charts, nursing assessments (Glasgow, Braden, fall risk), ward rounds documentation, structured handover notes, and patient transfers between wards.

### Acceptance Criteria
- [ ] `medication_administration_records` table tracks scheduled_time, administered_time, dose, route, site, administering_nurse, witness, status (given/held/refused/omitted), reason
- [ ] `fluid_balance_charts` table tracks intake/output type, volume_ml, route, timestamp per admission
- [ ] `nursing_assessments` table with assessment_type (glasgow, braden, fall_risk, pain, nutritional), scores as JSONB, frequency scheduling
- [ ] `nursing_care_plans` table with goals, interventions, evaluation, status lifecycle
- [ ] `ward_rounds` table with doctor observations, orders given, plan, next round date per admission
- [ ] `handover_notes` structured table replacing current free-text (critical_alerts, pending_tasks JSONB, outgoing/incoming nurse FKs)
- [ ] `patient_transfers` table tracking from_ward, to_ward, from_bed, to_bed, reason, authorized_by, transfer_time
- [ ] Nurse Dashboard updated with MAR grid view, fluid balance I/O chart, and assessment due alerts
- [ ] Transfer workflow updates bed status in `beds` table automatically
- [ ] Ward round notes visible on Doctor Dashboard per admitted patient

### Stories
1. Schema migration `002_nursing_ward.sql`
2. MAR service layer + grid UI (time slots × medications)
3. Fluid balance chart UI with running totals
4. Nursing assessment forms (Glasgow coma scale, Braden scale, fall risk)
5. Care plan CRUD with goal tracking
6. Ward rounds entry form for doctors
7. Structured handover form replacing free-text
8. Patient transfer workflow (updates beds table)
9. Nurse dashboard integration (due alerts, task board)

---

## Epic 3 · Revenue Cycle & NHIA Claims Engine
**Priority:** P0 — Foundation  
**Phase:** 2 (Revenue & Compliance)  
**Depends on:** Epic 1 (encounters, diagnoses)  
**Estimated Story Points:** 40

### Description
Transform the current simple claims table into a full NHIA-compliant revenue cycle: tariff catalog with GDRG codes, encounter-level charge capture, auto-scrubbing with validation rules, batch submission workflow, rejection management, and private insurance support. The billing flow should auto-generate claim items from encounter diagnoses + orders.

### Acceptance Criteria
- [ ] `nhia_tariff_catalog` table with GDRG code, description, category, base price, effective dates, edition version
- [ ] `fee_schedules` table for private insurance and cash pricing per service
- [ ] `billing_items` table capturing individual charges per encounter (service, quantity, unit_price, total, billing_code)
- [ ] `claim_items` line-item table with tariff FK, diagnosis FK, quantity, unit_price, approved_amount
- [ ] `claim_batches` table for grouping claims into submission batches with batch_number, period, total_amount, status
- [ ] `nhia_submissions` table tracking API submission attempts, response codes, acknowledgment IDs
- [ ] `payment_allocations` table mapping partial payments across multiple billing items
- [ ] `receipts` table for printable receipt generation with receipt_number sequence
- [ ] Auto-scrub function: validates diagnosis codes, checks tariff coverage, flags missing data before submission
- [ ] Claims page updated with batch submission workflow, rejection drill-down, resubmission
- [ ] Cashier page updated with itemized billing from encounter charges
- [ ] Receipt printing from Billing page with thermal printer support (80mm)
- [ ] Dashboard widget showing claims pipeline: draft → scrubbed → submitted → acknowledged → approved → paid

### Stories
1. Schema migration `003_revenue_cycle_nhia.sql`
2. NHIA tariff catalog import tool (CSV/Excel upload)
3. Fee schedule management UI
4. Auto-charge capture from encounter (diagnosis → tariff lookup)
5. Billing items review + manual line-item adjustments
6. Claim auto-generation from billing items
7. Claim scrubbing engine (PL/pgSQL function)
8. Batch creation + submission workflow UI
9. NHIA submission tracking + acknowledgment parsing
10. Rejection management + resubmission flow
11. Payment allocation for partial/split payments
12. Receipt generation with sequential numbering
13. Claims pipeline dashboard widget

---

## Epic 4 · Ancillary Services (Radiology, Theatre, Maternity)
**Priority:** P1 — Essential  
**Phase:** 2 (Revenue & Compliance)  
**Depends on:** Epic 1 (encounters, clinical_orders)  
**Estimated Story Points:** 45

### Description
Add the missing departmental modules for Radiology (order → image → report), Theatre/Surgical (booking → pre-op → procedure → post-op), Maternity/ANC (visit tracking, partograph, delivery, postnatal), Mortuary, Dental, and Physiotherapy. Each module integrates with the encounter and clinical orders system.

### Acceptance Criteria
- [ ] **Radiology**: `radiology_orders` with modality (xray, ct, mri, ultrasound), body_part, clinical_indication, priority; `radiology_results` with findings, impression, radiologist FK, report_url, image_urls JSONB
- [ ] **Theatre**: `theatre_bookings` with procedure_name, surgeon, anesthetist, theatre_room, scheduled_start/end, booking_status; `surgical_procedures` with procedure_code, incision_time, closure_time, blood_loss_ml, specimens JSONB, complications, post_op_instructions
- [ ] **Maternity**: `anc_visits` with gestational_age_weeks, fundal_height, fetal_heart_rate, presentation, urine_protein, blood_pressure, weight, next_visit_date; `deliveries` with delivery_type (svd, cs, assisted), baby_weight, apgar_1min/5min, complications, delivered_by; `postnatal_visits` table
- [ ] **Mortuary**: `mortuary_records` with deceased patient FK, cause_of_death, time_of_death, body_tag_number, storage_unit, released_to, release_date, autopsy_required
- [ ] **Dental**: `dental_records` with tooth_number, condition, procedure, material_used, dentist FK, encounter FK
- [ ] **Physiotherapy**: `physiotherapy_sessions` with diagnosis, treatment_plan, exercises JSONB, progress_notes, therapist FK, session_number, next_session
- [ ] Radiology page created with worklist and result entry
- [ ] Theatre scheduling board (calendar view)
- [ ] ANC register and delivery log pages
- [ ] All modules linked to encounters and generate billing items

### Stories
1. Schema migration `004_ancillary_services.sql`
2. Radiology order worklist UI
3. Radiology result entry with image upload (Supabase Storage)
4. Theatre booking calendar UI
5. Surgical procedure documentation form
6. ANC visit form with gestational calculator
7. Delivery documentation form
8. Postnatal visit tracking
9. Mortuary register page
10. Dental charting basic UI
11. Physiotherapy session tracker
12. Integration: clinical_orders → radiology_orders / theatre_bookings

---

## Epic 5 · Laboratory Enhancement
**Priority:** P1 — Essential  
**Phase:** 2 (Revenue & Compliance)  
**Depends on:** Epic 1 (encounters, clinical_orders)  
**Estimated Story Points:** 21

### Description
Enhance the existing basic `lab_tests` table with a proper test catalog, LOINC coding, specimen tracking, reference ranges, critical value alerts, auto-billing integration, and barcode label support.

### Acceptance Criteria
- [ ] `lab_test_catalog` table with test_code (LOINC), test_name, specimen_type, department, turnaround_time, price, reference_ranges JSONB (by age/gender)
- [ ] `lab_specimens` table tracking specimen_id (barcode), collection_time, collected_by, specimen_type, condition, received_time, processing_status
- [ ] `lab_results` enhanced to support numeric value + unit + reference_range + flag (normal/low/high/critical), replacing current free-text result
- [ ] `lab_panels` table grouping related tests (CBC panel, LFT panel, RFT panel, lipid panel)
- [ ] Critical value auto-notification to ordering doctor
- [ ] Barcode generation for specimen labels
- [ ] Lab results auto-generate billing items against encounter
- [ ] Lab Dashboard with TAT metrics

### Stories
1. Extend `003_revenue_cycle_nhia.sql` or create separate `lab_enhancement.sql`
2. Lab test catalog management UI
3. Specimen tracking workflow
4. Structured result entry with reference range comparison
5. Critical value alert integration with NotificationCenter
6. Barcode label generation (react-barcode)
7. Lab panel ordering from clinical orders
8. Lab TAT dashboard metrics

---

## Epic 6 · Pharmacy Enhancement
**Priority:** P1 — Essential  
**Phase:** 2  
**Depends on:** Epic 1 (encounters)  
**Estimated Story Points:** 18

### Description
Enhance existing drug management with batch tracking, expiry management, supplier management, purchase orders, drug interactions checking, and controlled substance logging.

### Acceptance Criteria
- [ ] `drug_batches` table with batch_number, manufacturing_date, expiry_date, quantity_received, quantity_remaining, supplier FK, purchase_order FK
- [ ] `suppliers` table with name, contact, license_number, tax_id, payment_terms, rating
- [ ] `purchase_orders` table with supplier FK, order_items JSONB, status lifecycle, expected_delivery_date, received_date
- [ ] `drug_interactions` table or service-layer check using drug pairs
- [ ] `controlled_substance_log` for Schedule 1-5 drugs with dispensing witness, running balance
- [ ] Pharmacy page: FEFO (First Expiry First Out) dispensing logic
- [ ] Expiry alert dashboard (30/60/90 day warnings)
- [ ] Drug interaction warning shown during prescription creation
- [ ] Existing `drugs` table gains `is_controlled` boolean and `schedule` field

### Stories
1. Schema migration (included in `004_ancillary_services.sql`)
2. Drug batch tracking UI
3. Supplier management CRUD
4. Purchase order workflow
5. FEFO dispensing logic in prescription fulfillment
6. Expiry dashboard widget
7. Drug interaction checker service
8. Controlled substance log

---

## Epic 7 · Multi-Tenant Hospital Network
**Priority:** P1 — Essential  
**Phase:** 3 (Scale)  
**Depends on:** Epics 1-3  
**Estimated Story Points:** 26

### Description
Transform CareLink from a single-hospital system to a multi-tenant platform. The existing `hospital_onboarding` flow becomes the entry point. Each hospital gets isolated data via `hospital_id` tenant column on all tables. Support three editions: Clinic (≤50 beds), District (≤300 beds), Regional/Teaching (unlimited).

### Acceptance Criteria
- [ ] `hospitals` table with name, license_number, nhia_provider_id, edition (clinic/district/regional), subscription_status, bed_capacity, region, district, gps_coordinates
- [ ] `hospital_id UUID` added to ALL existing core tables (users, patients, drugs, etc.) with default for backward compat
- [ ] `hospital_departments` table per-hospital department configuration
- [ ] `hospital_settings` JSONB configuration table (branding, features enabled, working hours, etc.)
- [ ] RLS policies updated: every query filters by `hospital_id` from user's JWT claims
- [ ] Existing HospitalOnboarding page creates record in `hospitals` table
- [ ] Hospital Profile page manages settings
- [ ] Edition-based feature gating (referenced from `platformAccess.js`)
- [ ] Super-admin dashboard for managing all hospitals
- [ ] Cross-hospital referral system (extends existing referrals)

### Stories
1. Schema migration for `hospitals`, `hospital_departments`, `hospital_settings`
2. Add `hospital_id` to all existing tables (backward-compatible migration)
3. Update all RLS policies with hospital_id filter
4. Update JWT claims to include hospital_id
5. Edition-based feature gating in platformAccess.js
6. Super-admin hospital management page
7. Cross-hospital referral workflow
8. Hospital-scoped analytics dashboard

---

## Epic 8 · Interoperability Layer (FHIR + DHIMS2 + NHIA API)
**Priority:** P1 — Essential  
**Phase:** 3 (Scale)  
**Depends on:** Epics 1, 3, 7  
**Estimated Story Points:** 34

### Description
Build the interoperability facade: FHIR R4 resource mapping from CareLink tables, DHIMS2 aggregate reporting, NHIA e-Claims API integration, and GHS (Ghana Health Service) data exchange. This is implemented as Supabase Edge Functions that expose FHIR-compliant endpoints and translate internal data.

### Acceptance Criteria
- [ ] `fhir_resource_log` table tracking every FHIR resource generated/received with resource_type, resource_id, version, direction (inbound/outbound), payload JSONB
- [ ] `fhir_endpoint_config` table for configuring external FHIR servers
- [ ] `dhims2_reports` table storing aggregate submissions (OPD attendance, disease surveillance, maternal health, etc.)
- [ ] `dhims2_indicator_mappings` table mapping CareLink data to DHIMS2 indicator codes
- [ ] `integration_endpoints` table for managing all external API connections
- [ ] Supabase Edge Function: `GET /fhir/Patient/:id` → maps `patients` → FHIR Patient resource
- [ ] Supabase Edge Function: `GET /fhir/Encounter/:id` → maps `encounters` → FHIR Encounter resource
- [ ] Supabase Edge Function: `GET /fhir/Claim/:id` → maps `claims` + `claim_items` → FHIR Claim resource
- [ ] Supabase Edge Function: `POST /fhir/DiagnosticReport` → inbound lab results
- [ ] DHIMS2 monthly aggregate report generator (Edge Function cron)
- [ ] NHIA e-Claims batch submission (Edge Function)
- [ ] Admin UI for managing integration endpoints and viewing sync logs

### Stories
1. Schema migration `005_interop_fhir.sql`
2. FHIR Patient resource mapper (Edge Function)
3. FHIR Encounter resource mapper
4. FHIR Claim resource mapper
5. FHIR DiagnosticReport mapper (lab results)
6. DHIMS2 aggregate report generator
7. DHIMS2 indicator mapping configuration UI
8. NHIA e-Claims submission Edge Function
9. Integration endpoint management UI
10. FHIR resource log viewer
11. Sync health dashboard

---

## Epic 9 · Offline-First & PWA
**Priority:** P2 — Differentiator  
**Phase:** 3 (Scale)  
**Depends on:** Epics 1-3  
**Estimated Story Points:** 34

### Description
Make CareLink work without internet — critical for rural Ghana clinics. Implement IndexedDB local storage with Supabase Realtime sync, service worker for asset caching, background sync queue for mutations, and conflict resolution. The app becomes a PWA installable on tablets.

### Acceptance Criteria
- [ ] Service worker registered: caches app shell, static assets, and critical API responses
- [ ] IndexedDB stores: patients (local), encounters (local), vitals (local), prescriptions (local), drugs catalog (local), queue (local)
- [ ] `sync_queue` table (server-side) receives batched mutations when connectivity resumes
- [ ] `sync_conflicts` table tracks version conflicts with last-write-wins + manual resolution UI
- [ ] `offline_cache_manifest` table defines which data subsets sync per hospital/department
- [ ] Connectivity indicator in DashboardLayout header (green/yellow/red)
- [ ] PWA manifest.json with CareLink branding, icons, splash screen
- [ ] Background sync via service worker `sync` event
- [ ] Conflict resolution UI for admin (shows both versions, pick winner)
- [ ] Works fully offline: patient lookup, vitals entry, prescription creation, queue check-in
- [ ] Auto-sync on reconnect with progress indicator

### Stories
1. Schema migration `006_offline_sync.sql`
2. Service worker setup (Workbox via vite-plugin-pwa)
3. IndexedDB schema + Dexie.js wrapper
4. Sync engine: queue mutations, batch upload on reconnect
5. Conflict detection + resolution logic
6. Connectivity indicator component
7. PWA manifest + icons
8. Offline patient lookup + registration
9. Offline vitals + prescription entry
10. Offline queue management
11. Admin conflict resolution UI
12. Sync health dashboard

---

## Epic 10 · AI Clinical Decision Support
**Priority:** P2 — Differentiator  
**Phase:** 4 (AI & Analytics)  
**Depends on:** Epics 1, 5  
**Estimated Story Points:** 21

### Description
Add AI-powered clinical aids: ICD-10 diagnosis suggestion from symptoms, drug interaction alerts, prescription dosage verification, lab result interpretation, and predictive readmission risk scoring. Uses OpenAI or local LLM via Supabase Edge Functions.

### Acceptance Criteria
- [ ] `ai_suggestions` table logging every AI recommendation with context, suggestion, confidence_score, accepted/rejected by clinician
- [ ] Diagnosis suggestion: given chief complaint + vitals, suggest top 5 ICD-10 codes with confidence
- [ ] Drug interaction check: real-time alert during prescription creation
- [ ] Dosage verification: flag doses outside standard range for patient weight/age
- [ ] Lab interpretation: plain-language summary of results with clinical significance
- [ ] Readmission risk score: calculated on discharge using encounter history
- [ ] All AI suggestions are advisory — clinician must confirm/reject
- [ ] AI suggestion logs available in audit trail

### Stories
1. AI suggestion logging table + service
2. ICD-10 suggestion Edge Function (OpenAI/Claude API)
3. Drug interaction alert service
4. Dosage verification service
5. Lab result interpretation service
6. Readmission risk scoring model
7. UI integration: suggestion cards in encounter workflow
8. AI audit trail viewer

---

## Epic 11 · Analytics & Reporting Engine
**Priority:** P2 — Differentiator  
**Phase:** 4 (AI & Analytics)  
**Depends on:** Epics 1-4  
**Estimated Story Points:** 21

### Description
Build a comprehensive analytics engine with pre-built Ghana health system reports, custom report builder, executive dashboards, and exportable reports (PDF, Excel). Covers OPD attendance, disease surveillance, revenue analysis, bed occupancy, and staff productivity.

### Acceptance Criteria
- [ ] `report_templates` table with report_name, query_template, parameters JSONB, output_format, schedule (cron), category
- [ ] `report_runs` table logging each execution with parameters used, row_count, generated_by, file_url
- [ ] Pre-built reports: OPD Daily Register, IPD Census, Disease Surveillance (ICD-10 top 20), Revenue Summary, Claims Aging, Lab TAT, Pharmacy Stock Valuation, Blood Bank Status
- [ ] Custom report builder: select tables, filters, grouping, date range → generates SQL safely via parameterized templates
- [ ] Executive dashboard: key KPIs (patient volume, revenue, bed occupancy, claims yield, avg wait time)
- [ ] Export: PDF (existing PDFButton enhanced), Excel (xlsx), CSV
- [ ] Scheduled reports via Supabase cron (daily/weekly/monthly)
- [ ] Role-based report access (admin sees all, department heads see department)

### Stories
1. Report template + run tables
2. Pre-built report SQL templates (8 standard reports)
3. Report execution engine (Supabase Edge Function)
4. Report viewer UI with pagination
5. Custom report builder UI
6. Excel export (SheetJS)
7. Enhanced PDF export
8. Scheduled report execution (pg_cron)
9. Executive KPI dashboard
10. Role-based report access control

---

## Epic 12 · Security, Compliance & Audit Hardening
**Priority:** P0 — Foundation  
**Phase:** 1 (parallel with Epics 1-2)  
**Depends on:** —  
**Estimated Story Points:** 18

### Description
Harden security for Ghana Data Protection Act compliance: granular RBAC, session management, comprehensive audit logging, data encryption at rest, consent management, and penetration test remediation.

### Acceptance Criteria
- [ ] `roles` table replacing check constraint with proper RBAC (role → permissions mapping)
- [ ] `permissions` table with resource, action (create/read/update/delete), role FK
- [ ] `user_sessions` table tracking active sessions, device fingerprint, IP, last_activity
- [ ] `consent_records` table for patient data processing consent (GDPR/Ghana DPA)
- [ ] `data_access_log` table (extends audit_log) tracking every patient record access with reason
- [ ] Enhanced audit_log: captures request_id, session_id, user_agent for forensic trace
- [ ] Password policy enforcement (min 12 chars, complexity via Supabase Auth config)
- [ ] Session timeout: 30 min inactivity auto-logout
- [ ] Role-based navigation: sidebar items filtered by permissions (extend DashboardLayout)
- [ ] Patient data export (right of access) and anonymization (right to erasure) functions
- [ ] All PHI fields encrypted at rest via pgcrypto

### Stories
1. RBAC schema migration (roles, permissions tables)
2. Permission checking middleware/hook
3. Session management + timeout logic
4. Consent management UI + storage
5. Enhanced audit logging with session context
6. Patient data access logging
7. Data export function (patient right of access)
8. Data anonymization function (right to erasure)
9. PHI field encryption (pgcrypto)
10. Penetration test + OWASP Top 10 remediation

---

## Execution Sequence

```
Phase 1 (Weeks 1-6):  Epic 12 ──┐
                       Epic 1  ──┼── parallel tracks
                       Epic 2  ──┘

Phase 2 (Weeks 7-14): Epic 3  ──┐
                       Epic 4  ──┼── parallel tracks
                       Epic 5  ──┤
                       Epic 6  ──┘

Phase 3 (Weeks 15-22): Epic 7  ──┐
                        Epic 8  ──┼── parallel tracks
                        Epic 9  ──┘

Phase 4 (Weeks 23-28): Epic 10 ──┐
                        Epic 11 ──┼── parallel tracks
                        Epic 12 hardening ──┘
```

## Total Story Points: ~341
## Total Stories: ~120
## Recommended Sprint Length: 2 weeks
## Recommended Team Size: 4-6 engineers

---

*This backlog maps 1:1 to the SQL migrations in `/migrations/` and the FHIR mapping in `FHIR_RESOURCE_MAPPING.md`.*
