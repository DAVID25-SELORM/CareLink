# CareLink → FHIR R4 Resource Mapping

> Maps every existing and proposed CareLink table to FHIR R4 resources.
> This document serves as the implementation spec for Supabase Edge Functions
> that expose the FHIR facade (Epic 8).

---

## Mapping Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Table exists in current CareLink schema |
| 🆕 | Table created in migrations 001-006 |
| ➡️ | CareLink column → FHIR element |

---

## 1. Patient

**FHIR Resource:** `Patient`  
**CareLink Table:** `patients` ✅  
**Profile:** `http://hl7.org/fhir/StructureDefinition/Patient`

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `id` | `Patient.id` | id | UUID as FHIR logical ID |
| `patient_id` | `Patient.identifier[0].value` | Identifier | system: `urn:carelink:patient-id` |
| `nhis_number` | `Patient.identifier[1].value` | Identifier | system: `urn:ghana:nhia:member-id` |
| `insurance_number` | `Patient.identifier[2].value` | Identifier | system: `urn:carelink:insurance-number` |
| `name` | `Patient.name[0].text` | HumanName | Parse into family + given if possible |
| `gender` | `Patient.gender` | code | Map: male→male, female→female, other→other |
| `age` | `Patient.birthDate` | date | Calculate: `current_date - age years` (approximate) |
| `phone` | `Patient.telecom[0].value` | ContactPoint | system: phone, use: mobile |
| `email` | `Patient.telecom[1].value` | ContactPoint | system: email |
| `address` | `Patient.address[0].text` | Address | |
| `blood_group` | `Patient.extension[0]` | Extension | url: `urn:carelink:blood-group` |
| `allergies` | `Patient.extension[1]` | Extension | url: `urn:carelink:allergies-text` (use AllergyIntolerance resources for structured) |
| `emergency_contact` | `Patient.contact[0].name.text` | Contact | |
| `emergency_phone` | `Patient.contact[0].telecom[0].value` | ContactPoint | |
| `insurance_type` | `Patient.extension[2]` | Extension | url: `urn:ghana:insurance-type` |

### Example FHIR Output
```json
{
  "resourceType": "Patient",
  "id": "uuid-from-patients-table",
  "identifier": [
    {
      "system": "urn:carelink:patient-id",
      "value": "PT-ABC1234567"
    },
    {
      "system": "urn:ghana:nhia:member-id",
      "value": "NHIS-12345678"
    }
  ],
  "name": [{ "text": "Kwame Asante", "family": "Asante", "given": ["Kwame"] }],
  "gender": "male",
  "birthDate": "1985-03-15",
  "telecom": [
    { "system": "phone", "value": "+233241234567", "use": "mobile" },
    { "system": "email", "value": "kwame@example.com" }
  ],
  "address": [{ "text": "14 Oxford St, Osu, Accra" }]
}
```

---

## 2. Encounter

**FHIR Resource:** `Encounter`  
**CareLink Table:** `encounters` 🆕  
**Profile:** `http://hl7.org/fhir/StructureDefinition/Encounter`

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `id` | `Encounter.id` | id | |
| `patient_id` | `Encounter.subject.reference` | Reference(Patient) | `Patient/{uuid}` |
| `doctor_id` | `Encounter.participant[0].individual.reference` | Reference(Practitioner) | |
| `encounter_type` | `Encounter.class` | Coding | Map: outpatient→AMB, inpatient→IMP, emergency→EMER |
| `status` | `Encounter.status` | code | Map: registered→planned, in_progress→in-progress, completed→finished, cancelled→cancelled |
| `chief_complaint` | `Encounter.reasonCode[0].text` | CodeableConcept | |
| `department` | `Encounter.serviceType.text` | CodeableConcept | |
| `priority` | `Encounter.priority` | CodeableConcept | Map: routine→R, urgent→UR, emergency→EM |
| `started_at` | `Encounter.period.start` | dateTime | |
| `ended_at` | `Encounter.period.end` | dateTime | |
| `discharge_disposition` | `Encounter.hospitalization.dischargeDisposition` | CodeableConcept | |

### Class Mapping
| CareLink `encounter_type` | FHIR `Encounter.class` code | display |
|---|---|---|
| `outpatient` | `AMB` | ambulatory |
| `inpatient` | `IMP` | inpatient encounter |
| `emergency` | `EMER` | emergency |
| `telemedicine` | `VR` | virtual |
| `home_visit` | `HH` | home health |

---

## 3. Condition (Diagnosis)

**FHIR Resource:** `Condition`  
**CareLink Table:** `diagnoses` 🆕  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `id` | `Condition.id` | id | |
| `patient_id` | `Condition.subject.reference` | Reference(Patient) | |
| `encounter_id` | `Condition.encounter.reference` | Reference(Encounter) | |
| `diagnosed_by` | `Condition.recorder.reference` | Reference(Practitioner) | |
| `icd10_code` | `Condition.code.coding[0].code` | Coding | system: `http://hl7.org/fhir/sid/icd-10` |
| `icd10_description` | `Condition.code.coding[0].display` | string | |
| `diagnosis_type` | `Condition.category` | CodeableConcept | Map: primary→encounter-diagnosis |
| `severity` | `Condition.severity` | CodeableConcept | Map to SNOMED: mild→255604002, moderate→6736007, severe→24484000 |
| `certainty` | `Condition.verificationStatus` | CodeableConcept | Map: confirmed→confirmed, provisional→provisional, differential→differential |
| `onset_date` | `Condition.onsetDateTime` | dateTime | |
| `resolved_date` | `Condition.abatementDateTime` | dateTime | |
| `is_chronic` | `Condition.clinicalStatus` | CodeableConcept | if chronic: `active`, if resolved_date: `resolved` |

---

## 4. Observation (Vitals)

**FHIR Resource:** `Observation` (multiple per vitals record)  
**CareLink Table:** `vitals` 🆕  

Each CareLink vitals row produces **multiple** FHIR Observations:

| CareLink Column | FHIR Observation.code (LOINC) | Unit | Category |
|---|---|---|---|
| `temperature_c` | `8310-5` (Body temperature) | °C | vital-signs |
| `bp_systolic` | `8480-6` (Systolic BP) | mmHg | vital-signs |
| `bp_diastolic` | `8462-4` (Diastolic BP) | mmHg | vital-signs |
| `pulse_rate` | `8867-4` (Heart rate) | /min | vital-signs |
| `respiratory_rate` | `9279-1` (Respiratory rate) | /min | vital-signs |
| `spo2` | `2708-6` (Oxygen saturation) | % | vital-signs |
| `weight_kg` | `29463-7` (Body weight) | kg | vital-signs |
| `height_cm` | `8302-2` (Body height) | cm | vital-signs |
| `bmi` | `39156-5` (BMI) | kg/m² | vital-signs |
| `pain_scale` | `72514-3` (Pain severity) | {score} | vital-signs |
| `blood_glucose` | `2339-0` (Glucose) | mmol/L | vital-signs |
| `gcs_score` | `9269-2` (Glasgow coma score) | {score} | vital-signs |

### Common Fields for All Vitals Observations
| CareLink Column | FHIR Path | Notes |
|---|---|---|
| `patient_id` | `Observation.subject.reference` | Reference(Patient) |
| `encounter_id` | `Observation.encounter.reference` | Reference(Encounter) |
| `recorded_by` | `Observation.performer[0].reference` | Reference(Practitioner) |
| `recorded_at` | `Observation.effectiveDateTime` | |

### Blood Pressure Special Case
BP is bundled as a single Observation with components:
```json
{
  "resourceType": "Observation",
  "code": { "coding": [{ "system": "http://loinc.org", "code": "85354-9", "display": "Blood pressure panel" }] },
  "component": [
    {
      "code": { "coding": [{ "system": "http://loinc.org", "code": "8480-6", "display": "Systolic" }] },
      "valueQuantity": { "value": 120, "unit": "mmHg" }
    },
    {
      "code": { "coding": [{ "system": "http://loinc.org", "code": "8462-4", "display": "Diastolic" }] },
      "valueQuantity": { "value": 80, "unit": "mmHg" }
    }
  ]
}
```

---

## 5. MedicationRequest (Prescription)

**FHIR Resource:** `MedicationRequest`  
**CareLink Tables:** `prescriptions` ✅ + `prescription_items` ✅  
**Note:** Each `prescription_item` produces one `MedicationRequest`

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `prescriptions.id` | `MedicationRequest.groupIdentifier.value` | Identifier | Groups items from same prescription |
| `prescription_items.id` | `MedicationRequest.id` | id | |
| `prescriptions.patient_id` | `MedicationRequest.subject.reference` | Reference(Patient) | |
| `prescriptions.doctor_id` | `MedicationRequest.requester.reference` | Reference(Practitioner) | |
| `prescriptions.encounter_id` | `MedicationRequest.encounter.reference` | Reference(Encounter) | |
| `prescription_items.drug_name` | `MedicationRequest.medicationCodeableConcept.text` | CodeableConcept | |
| `prescription_items.dosage` | `MedicationRequest.dosageInstruction[0].doseAndRate[0].doseQuantity.value` | Quantity | |
| `prescription_items.frequency` | `MedicationRequest.dosageInstruction[0].timing.code.text` | Timing | |
| `prescription_items.duration` | `MedicationRequest.dosageInstruction[0].timing.repeat.boundsDuration` | Duration | |
| `prescription_items.quantity` | `MedicationRequest.dispenseRequest.quantity.value` | Quantity | |
| `prescription_items.instructions` | `MedicationRequest.dosageInstruction[0].text` | string | |
| `prescriptions.status` | `MedicationRequest.status` | code | Map: pending→active, dispensed→completed, cancelled→cancelled |
| `prescriptions.diagnosis` | `MedicationRequest.reasonCode[0].text` | CodeableConcept | |

---

## 6. Claim

**FHIR Resource:** `Claim`  
**CareLink Tables:** `claims` ✅ + `claim_items` 🆕  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `claims.id` | `Claim.id` | id | |
| `claims.patient_id` | `Claim.patient.reference` | Reference(Patient) | |
| `claims.encounter_id` | `Claim.item[0].encounter[0].reference` | Reference(Encounter) | |
| `claims.insurance_type` | `Claim.insurance[0].coverage.reference` | Reference(Coverage) | |
| `claims.claim_number` | `Claim.identifier[0].value` | Identifier | |
| `claims.amount` | `Claim.total.value` | Money | currency: GHS |
| `claims.status` | `Claim.status` | code | Map: pending→draft, submitted→active, approved→active, paid→active |
| `claims.submitted_at` | `Claim.created` | dateTime | |
| `claim_items.gdrg_code` | `Claim.item[n].productOrService.coding[0].code` | Coding | system: `urn:ghana:nhia:gdrg` |
| `claim_items.description` | `Claim.item[n].productOrService.text` | string | |
| `claim_items.quantity` | `Claim.item[n].quantity.value` | Quantity | |
| `claim_items.claimed_amount` | `Claim.item[n].net.value` | Money | |
| `claim_items.diagnosis_id` | `Claim.item[n].diagnosisSequence` | positiveInt[] | Links to Claim.diagnosis |

### NHIA-Specific Extensions
```json
{
  "resourceType": "Claim",
  "extension": [
    {
      "url": "urn:ghana:nhia:provider-id",
      "valueString": "NHIA-PROV-12345"
    },
    {
      "url": "urn:ghana:nhia:batch-id",
      "valueString": "BATCH-2026-04-001"
    }
  ]
}
```

---

## 7. DiagnosticReport (Lab Results)

**FHIR Resource:** `DiagnosticReport` + `Observation`  
**CareLink Table:** `lab_tests` ✅ (enhanced)  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `lab_tests.id` | `DiagnosticReport.id` | id | |
| `lab_tests.patient_id` | `DiagnosticReport.subject.reference` | Reference(Patient) | |
| `lab_tests.encounter_id` | `DiagnosticReport.encounter.reference` | Reference(Encounter) | |
| `lab_tests.requested_by` | `DiagnosticReport.resultsInterpreter[0].reference` | Reference(Practitioner) | |
| `lab_tests.test_name` | `DiagnosticReport.code.text` | CodeableConcept | |
| `lab_tests.test_type` | `DiagnosticReport.category[0].text` | CodeableConcept | |
| `lab_tests.status` | `DiagnosticReport.status` | code | Map: pending→registered, in_progress→partial, completed→final |
| `lab_tests.result` | `DiagnosticReport.conclusion` | string | Text result |
| `lab_tests.numeric_value` | Linked `Observation.valueQuantity.value` | Quantity | Via contained Observation |
| `lab_tests.unit` | Linked `Observation.valueQuantity.unit` | string | |
| `lab_tests.reference_range` | Linked `Observation.referenceRange[0].text` | string | |
| `lab_tests.result_flag` | Linked `Observation.interpretation` | CodeableConcept | Map: normal→N, high→H, low→L, critical_high→HH, critical_low→LL |
| `lab_tests.result_file_url` | `DiagnosticReport.presentedForm[0].url` | Attachment | |
| `lab_tests.completed_at` | `DiagnosticReport.issued` | instant | |

---

## 8. Practitioner (Users/Staff)

**FHIR Resource:** `Practitioner`  
**CareLink Table:** `users` ✅  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `id` | `Practitioner.id` | id | |
| `email` | `Practitioner.telecom[0].value` | ContactPoint | system: email |
| `full_name` | `Practitioner.name[0].text` | HumanName | |
| `phone` | `Practitioner.telecom[1].value` | ContactPoint | system: phone |
| `role` | `Practitioner.qualification[0].code.text` | CodeableConcept | |
| `specialty` | `Practitioner.qualification[1].code.text` | CodeableConcept | Map to SNOMED specialty codes |

---

## 9. Appointment

**FHIR Resource:** `Appointment`  
**CareLink Table:** `appointments` ✅  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `id` | `Appointment.id` | id | |
| `patient_id` | `Appointment.participant[0].actor.reference` | Reference(Patient) | |
| `doctor_id` | `Appointment.participant[1].actor.reference` | Reference(Practitioner) | |
| `appointment_date` + `appointment_time` | `Appointment.start` | instant | Combine date+time |
| `reason` | `Appointment.reasonCode[0].text` | CodeableConcept | |
| `status` | `Appointment.status` | code | Map: scheduled→booked, confirmed→booked, completed→fulfilled, cancelled→cancelled, no_show→noshow |
| `notes` | `Appointment.comment` | string | |

---

## 10. AllergyIntolerance

**FHIR Resource:** `AllergyIntolerance`  
**CareLink Table:** `allergies` 🆕  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `id` | `AllergyIntolerance.id` | id | |
| `patient_id` | `AllergyIntolerance.patient.reference` | Reference(Patient) | |
| `allergen_type` | `AllergyIntolerance.category` | code[] | Map: drug→medication, food→food, environment→environment |
| `allergen_name` | `AllergyIntolerance.code.text` | CodeableConcept | |
| `reaction` | `AllergyIntolerance.reaction[0].manifestation[0].text` | CodeableConcept | |
| `severity` | `AllergyIntolerance.reaction[0].severity` | code | Map: mild→mild, moderate→moderate, severe/life_threatening→severe |
| `status` | `AllergyIntolerance.clinicalStatus` | CodeableConcept | Map: active→active, resolved→resolved, inactive→inactive |
| `verified_by` | `AllergyIntolerance.recorder.reference` | Reference(Practitioner) | |

---

## 11. MedicationAdministration (MAR)

**FHIR Resource:** `MedicationAdministration`  
**CareLink Table:** `medication_administration_records` 🆕  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `id` | `MedicationAdministration.id` | id | |
| `patient_id` | `MedicationAdministration.subject.reference` | Reference(Patient) | |
| `drug_name` | `MedicationAdministration.medicationCodeableConcept.text` | CodeableConcept | |
| `dose` + `dose_unit` | `MedicationAdministration.dosage.dose` | Quantity | |
| `route` | `MedicationAdministration.dosage.route` | CodeableConcept | Map to SNOMED route codes |
| `administered_time` | `MedicationAdministration.effectiveDateTime` | dateTime | |
| `administered_by` | `MedicationAdministration.performer[0].actor.reference` | Reference(Practitioner) | |
| `status` | `MedicationAdministration.status` | code | Map: given→completed, held→on-hold, refused→not-done |
| `prescription_item_id` | `MedicationAdministration.request.reference` | Reference(MedicationRequest) | |

---

## 12. Procedure (Surgical)

**FHIR Resource:** `Procedure`  
**CareLink Table:** `surgical_procedures` 🆕 + `theatre_bookings` 🆕  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `surgical_procedures.id` | `Procedure.id` | id | |
| `theatre_bookings.patient_id` | `Procedure.subject.reference` | Reference(Patient) | |
| `theatre_bookings.encounter_id` | `Procedure.encounter.reference` | Reference(Encounter) | |
| `theatre_bookings.lead_surgeon_id` | `Procedure.performer[0].actor.reference` | Reference(Practitioner) | function: surgeon |
| `theatre_bookings.anesthetist_id` | `Procedure.performer[1].actor.reference` | Reference(Practitioner) | function: anesthetist |
| `surgical_procedures.procedure_name` | `Procedure.code.text` | CodeableConcept | |
| `surgical_procedures.incision_time` | `Procedure.performedPeriod.start` | dateTime | |
| `surgical_procedures.closure_time` | `Procedure.performedPeriod.end` | dateTime | |
| `surgical_procedures.operative_findings` | `Procedure.note[0].text` | Annotation | |
| `surgical_procedures.complications` | `Procedure.complication[0].text` | CodeableConcept | |
| `surgical_procedures.post_op_diagnosis` | `Procedure.reasonCode[0].text` | CodeableConcept | |
| `surgical_procedures.blood_loss_ml` | `Procedure.extension` | Extension | url: `urn:carelink:blood-loss-ml` |

---

## 13. Coverage (Insurance)

**FHIR Resource:** `Coverage`  
**CareLink Table:** `patients` ✅ (insurance fields)  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `patients.id` | `Coverage.beneficiary.reference` | Reference(Patient) | |
| `patients.insurance_type` | `Coverage.type` | CodeableConcept | Map: nhis→`urn:ghana:nhia`, private→`urn:carelink:private-insurance` |
| `patients.nhis_number` | `Coverage.identifier[0].value` | Identifier | system: `urn:ghana:nhia:member-id` |
| `patients.insurance_name` | `Coverage.payor[0].display` | string | |
| `patients.insurance_number` | `Coverage.identifier[1].value` | Identifier | system: `urn:carelink:insurance-policy` |

---

## 14. ServiceRequest (Clinical Orders)

**FHIR Resource:** `ServiceRequest`  
**CareLink Table:** `clinical_orders` 🆕  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `id` | `ServiceRequest.id` | id | |
| `patient_id` | `ServiceRequest.subject.reference` | Reference(Patient) | |
| `encounter_id` | `ServiceRequest.encounter.reference` | Reference(Encounter) | |
| `ordered_by` | `ServiceRequest.requester.reference` | Reference(Practitioner) | |
| `order_type` | `ServiceRequest.category[0]` | CodeableConcept | Map: lab→108252007, radiology→363679005, procedure→387713003 |
| `order_description` | `ServiceRequest.code.text` | CodeableConcept | |
| `priority` | `ServiceRequest.priority` | code | Map: routine→routine, urgent→urgent, stat→stat, asap→asap |
| `status` | `ServiceRequest.status` | code | Map: ordered→active, completed→completed, cancelled→revoked |
| `clinical_indication` | `ServiceRequest.reasonCode[0].text` | CodeableConcept | |

---

## 15. ImagingStudy (Radiology)

**FHIR Resource:** `ImagingStudy` + `DiagnosticReport`  
**CareLink Tables:** `radiology_orders` 🆕 + `radiology_results` 🆕  

| CareLink Column | FHIR Path | Type | Notes |
|---|---|---|---|
| `radiology_orders.modality` | `ImagingStudy.series[0].modality` | Coding | Map: xray→DX, ct→CT, mri→MR, ultrasound→US |
| `radiology_orders.body_part` | `ImagingStudy.series[0].bodySite` | Coding | |
| `radiology_results.findings` | `DiagnosticReport.conclusion` | string | |
| `radiology_results.impression` | `DiagnosticReport.conclusionCode[0].text` | CodeableConcept | |
| `radiology_results.dicom_study_uid` | `ImagingStudy.identifier[0].value` | Identifier | system: `urn:dicom:uid` |

---

## DHIMS2 Indicator Mapping (Non-FHIR)

These map CareLink aggregate queries to Ghana DHIMS2 data elements:

| DHIMS2 Indicator | CareLink Query Source | Aggregation |
|---|---|---|
| OPD Total Attendance | `COUNT(*) FROM encounters WHERE encounter_type='outpatient'` | Monthly count |
| OPD New Registrations | `COUNT(*) FROM patients WHERE created_at IN period` | Monthly count |
| IPD Admissions | `COUNT(*) FROM admissions WHERE admission_date IN period` | Monthly count |
| IPD Discharges | `COUNT(*) FROM admissions WHERE discharge_date IN period` | Monthly count |
| IPD Deaths | `COUNT(*) FROM admissions WHERE discharge_type='deceased'` | Monthly count |
| Bed Occupancy Rate | `AVG(occupied / total) FROM beds` | Monthly average |
| Top 10 OPD Diagnoses | `COUNT(*) FROM diagnoses GROUP BY icd10_code ORDER BY count DESC LIMIT 10` | Monthly count |
| ANC Registrations | `COUNT(*) FROM anc_registrations WHERE created_at IN period` | Monthly count |
| Deliveries (SVD) | `COUNT(*) FROM deliveries WHERE delivery_type='svd'` | Monthly count |
| Deliveries (CS) | `COUNT(*) FROM deliveries WHERE delivery_type IN ('cs_elective','cs_emergency')` | Monthly count |
| Maternal Deaths | `COUNT(*) FROM deliveries WHERE maternal_complications ILIKE '%death%'` | Monthly count |
| Stillbirths | `COUNT(*) FROM deliveries WHERE delivery_outcome='stillbirth'` | Monthly count |
| Lab Tests Performed | `COUNT(*) FROM lab_tests WHERE status='completed'` | Monthly count |
| Blood Units Transfused | `SUM(units_requested) FROM blood_requests WHERE status='fulfilled'` | Monthly sum |
| Malaria Cases (RDT+) | `COUNT(*) FROM diagnoses WHERE icd10_code LIKE 'B50%' OR icd10_code LIKE 'B51%'` | Monthly count |

---

## Implementation Notes

### Edge Function Structure
```
supabase/functions/
├── fhir-patient/       # GET /fhir/Patient/:id
├── fhir-encounter/     # GET /fhir/Encounter/:id  
├── fhir-condition/     # GET /fhir/Condition/:id (diagnosis)
├── fhir-observation/   # GET /fhir/Observation?patient=:id&category=vital-signs
├── fhir-claim/         # GET /fhir/Claim/:id
├── fhir-diagnostic/    # GET/POST /fhir/DiagnosticReport/:id
├── fhir-medication/    # GET /fhir/MedicationRequest?patient=:id
├── dhims2-report/      # POST generates aggregate DHIMS2 report
└── nhia-submit/        # POST submits claim batch to NHIA
```

### Key Design Decisions
1. **Read-only FHIR facade first** — expose existing data as FHIR resources before accepting inbound FHIR
2. **Ghana-specific extensions** — use `urn:ghana:` namespace for NHIA, DHIMS2, and Ghana-specific fields
3. **FHIR resource log** — every outbound FHIR resource is logged in `fhir_resource_log` for audit
4. **Bulk export** — support FHIR Bulk Data ($export) for large data transfers to GHS
5. **Version tracking** — each resource includes `meta.versionId` from the CareLink `updated_at` timestamp

---

*This mapping covers 15 FHIR resources across the full CareLink schema. Run migrations 001-006 before implementing the Edge Functions.*
