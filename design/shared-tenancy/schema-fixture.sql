-- Disposable database only. Generated from schema metadata; contains no row data.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
CREATE SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
SET check_function_bodies=off;
CREATE SEQUENCE public."platform_invoice_number";
CREATE SEQUENCE public."platform_audit_log_id_seq";
CREATE TABLE public."admissions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"bed_id" uuid,
"ward_id" uuid NOT NULL,
"admitted_by" uuid NOT NULL,
"admission_date" timestamp with time zone DEFAULT now() NOT NULL,
"diagnosis" text NOT NULL,
"admission_type" text NOT NULL,
"admission_notes" text,
"expected_discharge_date" date,
"discharge_date" timestamp with time zone,
"discharge_type" text,
"discharge_summary" text,
"discharged_by" uuid,
"status" text DEFAULT 'admitted'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"encounter_id" uuid);
CREATE TABLE public."ai_suggestions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"encounter_id" uuid,
"patient_id" uuid NOT NULL,
"suggestion_type" text NOT NULL,
"content" jsonb NOT NULL,
"confidence_score" numeric(4,3),
"model_version" text,
"status" text DEFAULT 'pending'::text,
"accepted_by" uuid,
"accepted_at" timestamp with time zone,
"rejection_reason" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"hospital_id" uuid);
CREATE TABLE public."allergies"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"allergen_type" text NOT NULL,
"allergen_name" text NOT NULL,
"reaction" text,
"severity" text,
"onset_date" date,
"status" text DEFAULT 'active'::text,
"verified_by" uuid,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."ambulance_dispatches"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"ambulance_id" uuid NOT NULL,
"caller_name" text,
"caller_phone" text,
"incident_location" text NOT NULL,
"incident_type" text DEFAULT 'Medical Emergency'::text,
"patient_name" text,
"dispatcher_notes" text,
"status" text DEFAULT 'en_route'::text,
"dispatched_at" timestamp with time zone DEFAULT now(),
"arrived_at" timestamp with time zone,
"completed_at" timestamp with time zone,
"dispatched_by" uuid);
CREATE TABLE public."ambulance_fleet"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"registration_number" text NOT NULL,
"vehicle_type" text DEFAULT 'Basic Life Support'::text,
"make_model" text,
"year" integer,
"driver_name" text,
"driver_phone" text,
"status" text DEFAULT 'available'::text,
"notes" text,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."anc_registrations"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"registration_date" date DEFAULT CURRENT_DATE NOT NULL,
"lmp_date" date NOT NULL,
"edd" date NOT NULL,
"gravida" integer DEFAULT 1 NOT NULL,
"parity" integer DEFAULT 0 NOT NULL,
"previous_cs" integer DEFAULT 0,
"previous_complications" text,
"blood_group" text,
"rhesus" text,
"hiv_status" text,
"hepatitis_b" text,
"sickling_status" text,
"risk_level" text DEFAULT 'low'::text,
"status" text DEFAULT 'active'::text,
"registered_by" uuid,
"notes" text,
"hospital_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."anc_visits"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"visit_date" date NOT NULL,
"gestational_age_weeks" numeric,
"weight_kg" numeric,
"bp_systolic" integer,
"bp_diastolic" integer,
"fundal_height_cm" numeric,
"fetal_heart_rate" integer,
"presentation" text DEFAULT 'cephalic'::text,
"edd" date,
"blood_group" text,
"hb_level" numeric,
"urine_protein" text DEFAULT 'negative'::text,
"urine_glucose" text DEFAULT 'negative'::text,
"tetanus_dose" text,
"iron_folate_given" boolean DEFAULT false,
"ipt_given" boolean DEFAULT false,
"llin_given" boolean DEFAULT false,
"notes" text,
"next_visit_date" date,
"recorded_by" uuid,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."appointments"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"patient_id" uuid NOT NULL,
"doctor_id" uuid,
"doctor_name" text,
"appointment_date" date NOT NULL,
"appointment_time" time without time zone NOT NULL,
"reason" text,
"status" text DEFAULT 'scheduled'::text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."audit_log"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid,
"user_email" text,
"action" text NOT NULL,
"table_name" text NOT NULL,
"record_id" uuid,
"old_values" jsonb,
"new_values" jsonb,
"ip_address" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."beds"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"ward_id" uuid NOT NULL,
"bed_number" text NOT NULL,
"bed_type" text DEFAULT 'standard'::text NOT NULL,
"status" text DEFAULT 'available'::text NOT NULL,
"current_patient_id" uuid,
"assigned_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."billing_items"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"encounter_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"order_id" uuid,
"prescription_item_id" uuid,
"tariff_id" uuid,
"fee_schedule_id" uuid,
"service_code" text,
"description" text NOT NULL,
"category" text NOT NULL,
"quantity" integer DEFAULT 1 NOT NULL,
"unit_price" numeric(10,2) NOT NULL,
"discount_percent" numeric(5,2) DEFAULT 0,
"discount_amount" numeric(10,2) DEFAULT 0,
"tax_amount" numeric(10,2) DEFAULT 0,
"total_amount" numeric(10,2) NOT NULL,
"billing_status" text DEFAULT 'unbilled'::text,
"billed_by" uuid,
"billed_at" timestamp with time zone,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."blood_donations"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"donor_name" text NOT NULL,
"donor_phone" text,
"donor_email" text,
"blood_type" text NOT NULL,
"units" integer DEFAULT 1 NOT NULL,
"donation_date" timestamp with time zone DEFAULT now() NOT NULL,
"expiry_date" date NOT NULL,
"screening_status" text DEFAULT 'pending'::text,
"status" text DEFAULT 'available'::text,
"received_by" uuid,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."blood_inventory"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"blood_type" text NOT NULL,
"units_available" integer DEFAULT 0 NOT NULL,
"units_reserved" integer DEFAULT 0 NOT NULL,
"reorder_level" integer DEFAULT 5,
"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
"updated_by" uuid);
CREATE TABLE public."blood_requests"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"requested_by" uuid NOT NULL,
"blood_type" text NOT NULL,
"units_requested" integer NOT NULL,
"urgency" text DEFAULT 'routine'::text,
"status" text DEFAULT 'pending'::text,
"approved_by" uuid,
"fulfilled_at" timestamp with time zone,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."carelink_instance"("singleton" boolean DEFAULT true NOT NULL,
"instance_kind" text DEFAULT 'tenant'::text NOT NULL,
"enabled" boolean DEFAULT true NOT NULL);
CREATE TABLE public."claim_batches"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"batch_number" text NOT NULL,
"period_start" date NOT NULL,
"period_end" date NOT NULL,
"total_claims" integer DEFAULT 0 NOT NULL,
"total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
"approved_amount" numeric(12,2) DEFAULT 0,
"status" text DEFAULT 'draft'::text NOT NULL,
"scrubbed_at" timestamp with time zone,
"scrubbed_by" uuid,
"scrub_errors" jsonb DEFAULT '[]'::jsonb,
"submitted_at" timestamp with time zone,
"submitted_by" uuid,
"acknowledged_at" timestamp with time zone,
"acknowledgment_id" text,
"paid_at" timestamp with time zone,
"payment_reference" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."claim_items"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"claim_id" uuid NOT NULL,
"billing_item_id" uuid,
"tariff_id" uuid,
"diagnosis_id" uuid,
"service_code" text,
"gdrg_code" text,
"description" text NOT NULL,
"quantity" integer DEFAULT 1 NOT NULL,
"unit_price" numeric(10,2) NOT NULL,
"claimed_amount" numeric(10,2) NOT NULL,
"approved_amount" numeric(10,2),
"rejection_reason" text,
"status" text DEFAULT 'pending'::text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."claims"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"patient_id" uuid NOT NULL,
"payment_id" uuid,
"prescription_id" uuid,
"insurance_type" text NOT NULL,
"insurance_name" text,
"nhis_number" text,
"claim_number" text,
"amount" numeric(10,2) NOT NULL,
"status" text DEFAULT 'pending'::text,
"submitted_at" timestamp with time zone,
"approved_at" timestamp with time zone,
"rejection_reason" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"batch_id" uuid,
"encounter_id" uuid,
"approved_amount" numeric(10,2),
"paid_amount" numeric(10,2),
"paid_at" timestamp with time zone,
"payment_reference" text,
"nhis_cc_code" text);
CREATE TABLE public."clinical_notes"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"encounter_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"author_id" uuid NOT NULL,
"note_type" text DEFAULT 'soap'::text NOT NULL,
"subjective" text,
"objective" text,
"assessment" text,
"plan" text,
"body" text,
"is_addendum" boolean DEFAULT false,
"parent_note_id" uuid,
"signed_at" timestamp with time zone,
"signed_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."clinical_orders"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"encounter_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"ordered_by" uuid NOT NULL,
"order_type" text NOT NULL,
"order_category" text,
"order_description" text NOT NULL,
"order_code" text,
"priority" text DEFAULT 'routine'::text,
"status" text DEFAULT 'ordered'::text NOT NULL,
"clinical_indication" text,
"special_instructions" text,
"scheduled_date" date,
"scheduled_time" time without time zone,
"started_at" timestamp with time zone,
"completed_at" timestamp with time zone,
"completed_by" uuid,
"result_summary" text,
"result_notes" text,
"cancelled_reason" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."consent_records"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"encounter_id" uuid,
"consent_type" text NOT NULL,
"consented" boolean NOT NULL,
"consent_date" timestamp with time zone DEFAULT now() NOT NULL,
"consented_by" text,
"relationship_to_patient" text,
"witnessed_by" uuid,
"document_url" text,
"notes" text,
"revoked_at" timestamp with time zone,
"revocation_reason" text,
"hospital_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."controlled_substance_log"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"drug_id" uuid NOT NULL,
"drug_batch_id" uuid,
"prescription_id" uuid,
"patient_id" uuid,
"action" text NOT NULL,
"quantity" numeric(10,2) NOT NULL,
"balance_after" numeric(10,2) NOT NULL,
"performed_by" uuid NOT NULL,
"witnessed_by" uuid,
"notes" text,
"hospital_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."data_access_log"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"action" text NOT NULL,
"resource_type" text NOT NULL,
"resource_id" uuid,
"patient_id" uuid,
"ip_address" inet,
"user_agent" text,
"details" jsonb DEFAULT '{}'::jsonb,
"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
"hospital_id" uuid);
CREATE TABLE public."deliveries"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"anc_registration_id" uuid,
"delivery_date" date NOT NULL,
"delivery_time" time without time zone,
"delivery_mode" text DEFAULT 'svd'::text NOT NULL,
"gestational_age_weeks" numeric(4,1),
"birth_weight_kg" numeric(4,2),
"baby_sex" text,
"apgar_1min" integer,
"apgar_5min" integer,
"apgar_10min" integer,
"cord_blood_group" text,
"placenta_complete" boolean DEFAULT true,
"blood_loss_ml" numeric(7,1),
"tears" text DEFAULT 'none'::text,
"episiotomy" boolean DEFAULT false,
"outcome" text DEFAULT 'live_birth'::text NOT NULL,
"mother_condition" text DEFAULT 'stable'::text,
"baby_condition" text DEFAULT 'good'::text,
"complications" text,
"attendant_id" uuid,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."dental_records"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"encounter_id" uuid,
"dentist_id" uuid NOT NULL,
"visit_date" date DEFAULT CURRENT_DATE NOT NULL,
"chief_complaint" text,
"dental_chart" jsonb DEFAULT '{}'::jsonb,
"examination_findings" text,
"diagnosis" text,
"treatment_done" text,
"treatment_plan" text,
"teeth_treated" jsonb DEFAULT '[]'::jsonb,
"x_rays_taken" boolean DEFAULT false,
"x_ray_findings" text,
"next_appointment" date,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."dhims2_indicator_mappings"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"indicator_name" text NOT NULL,
"dhims2_data_element" text NOT NULL,
"dhims2_category_combo" text,
"source_table" text NOT NULL,
"source_query" text NOT NULL,
"period_type" text DEFAULT 'monthly'::text,
"is_active" boolean DEFAULT true,
"last_synced_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."dhims2_reports"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"period" text NOT NULL,
"period_type" text NOT NULL,
"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
"status" text DEFAULT 'draft'::text,
"submitted_at" timestamp with time zone,
"submitted_by" uuid,
"dhims2_response" jsonb,
"error_message" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."diagnoses"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"encounter_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"diagnosed_by" uuid,
"icd10_code" text NOT NULL,
"icd10_description" text NOT NULL,
"diagnosis_type" text DEFAULT 'primary'::text NOT NULL,
"rank" integer DEFAULT 1,
"onset_date" date,
"resolved_date" date,
"severity" text,
"certainty" text DEFAULT 'confirmed'::text,
"notes" text,
"is_chronic" boolean DEFAULT false,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."diet_orders"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"admission_id" uuid,
"diet_type" text NOT NULL,
"special_instructions" text,
"allergies" text,
"fluid_restriction_ml" integer,
"meal_frequency" integer DEFAULT 3,
"start_date" date,
"end_date" date,
"status" text DEFAULT 'active'::text,
"notes" text,
"ordered_by" uuid,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."discharge_summaries"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"admission_id" uuid,
"encounter_id" uuid,
"final_diagnosis" text NOT NULL,
"icd10_code" text,
"discharge_instructions" text NOT NULL,
"medications_at_discharge" text,
"follow_up_date" date,
"follow_up_notes" text,
"discharge_condition" text NOT NULL,
"discharge_type" text DEFAULT 'regular'::text NOT NULL,
"discharge_date" timestamp with time zone DEFAULT now() NOT NULL,
"discharged_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."drug_batches"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"drug_id" uuid NOT NULL,
"batch_number" text NOT NULL,
"manufacturer" text,
"manufacture_date" date,
"expiry_date" date NOT NULL,
"quantity_received" integer NOT NULL,
"quantity_remaining" integer NOT NULL,
"unit_cost" numeric(10,2),
"supplier" text,
"received_by" uuid,
"received_at" timestamp with time zone DEFAULT now() NOT NULL,
"storage_conditions" text,
"is_active" boolean DEFAULT true,
"notes" text,
"hospital_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."drug_interactions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"drug_a_id" uuid NOT NULL,
"drug_b_id" uuid NOT NULL,
"severity" text NOT NULL,
"description" text NOT NULL,
"mechanism" text,
"clinical_effect" text,
"management" text,
"clinical_references" text,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."drugs"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"name" text NOT NULL,
"category" text NOT NULL,
"description" text,
"price" numeric(10,2) DEFAULT 0 NOT NULL,
"stock" integer DEFAULT 0 NOT NULL,
"unit" text DEFAULT 'tablets'::text,
"reorder_level" integer DEFAULT 10,
"manufacturer" text,
"expiry_date" date,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"strength" text,
"formulation" text,
"nhis_price" numeric(10,2) DEFAULT 0 NOT NULL,
"brand_type" text DEFAULT 'Generic'::text NOT NULL);
CREATE TABLE public."encounters"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"doctor_id" uuid,
"appointment_id" uuid,
"encounter_type" text NOT NULL,
"status" text DEFAULT 'registered'::text NOT NULL,
"chief_complaint" text,
"visit_reason" text,
"department" text,
"priority" text DEFAULT 'routine'::text,
"encounter_date" date DEFAULT CURRENT_DATE,
"started_at" timestamp with time zone,
"ended_at" timestamp with time zone,
"discharge_disposition" text,
"follow_up_date" date,
"follow_up_instructions" text,
"hospital_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"nhis_cc_code" text,
"nhis_member_number" text,
"nhis_verified" boolean DEFAULT false,
"nhis_verified_at" timestamp with time zone,
"insurance_type" text DEFAULT 'cash'::text);
CREATE TABLE public."fee_schedules"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"payer_type" text NOT NULL,
"insurance_company" text,
"service_code" text NOT NULL,
"service_description" text NOT NULL,
"category" text,
"unit_price" numeric(10,2) NOT NULL,
"currency" text DEFAULT 'GHS'::text,
"effective_from" date DEFAULT CURRENT_DATE NOT NULL,
"effective_to" date,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."fhir_endpoint_config"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"base_url" text NOT NULL,
"auth_type" text DEFAULT 'bearer'::text,
"client_id" text,
"client_secret" text,
"token_url" text,
"access_token" text,
"token_expires_at" timestamp with time zone,
"enabled" boolean DEFAULT false,
"last_sync_at" timestamp with time zone,
"sync_resources" jsonb DEFAULT '["Patient", "Encounter", "Observation", "MedicationRequest", "DiagnosticReport"]'::jsonb,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."fhir_resource_log"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"resource_type" text NOT NULL,
"resource_id" text NOT NULL,
"fhir_id" text,
"operation" text NOT NULL,
"status" text NOT NULL,
"request_payload" jsonb,
"response_payload" jsonb,
"error_message" text,
"duration_ms" integer,
"endpoint" text,
"triggered_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"hospital_id" uuid);
CREATE TABLE public."fluid_balance_charts"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"admission_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"recorded_by" uuid NOT NULL,
"chart_date" date DEFAULT CURRENT_DATE NOT NULL,
"entry_type" text NOT NULL,
"fluid_type" text NOT NULL,
"route" text,
"volume_ml" integer NOT NULL,
"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."handover_notes"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"ward_id" uuid NOT NULL,
"outgoing_nurse_id" uuid NOT NULL,
"incoming_nurse_id" uuid,
"shift_type" text NOT NULL,
"handover_date" date DEFAULT CURRENT_DATE NOT NULL,
"ward_summary" text,
"critical_alerts" jsonb DEFAULT '[]'::jsonb,
"pending_tasks" jsonb DEFAULT '[]'::jsonb,
"patient_summaries" jsonb DEFAULT '[]'::jsonb,
"staffing_issues" text,
"equipment_issues" text,
"acknowledged_at" timestamp with time zone,
"acknowledged_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."hospital_departments"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"name" text NOT NULL,
"code" text,
"department_type" text,
"head_of_department" uuid,
"phone" text,
"location" text,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."hospital_onboarding_tasks"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"phase" text NOT NULL,
"task_name" text NOT NULL,
"task_details" text,
"status" text DEFAULT 'pending'::text NOT NULL,
"due_date" date,
"completed_at" timestamp with time zone,
"completed_by" uuid,
"sort_order" integer DEFAULT 0 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."hospital_profile"("singleton_key" boolean DEFAULT true NOT NULL,
"platform_name" text DEFAULT 'CareLink HMS'::text NOT NULL,
"hospital_name" text DEFAULT 'Your Hospital Name'::text NOT NULL,
"branch_name" text,
"dashboard_label" text,
"tagline" text DEFAULT 'Powered by CareLink'::text NOT NULL,
"primary_color" text,
"secondary_color" text,
"contact_email" text,
"contact_phone" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."hospitals"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_name" text NOT NULL,
"branch_location" text,
"contact_person" text,
"contact_phone" text,
"contact_email" text,
"owner_full_name" text,
"owner_email" text NOT NULL,
"owner_phone" text,
"public_url" text,
"primary_color" text,
"secondary_color" text,
"status" text DEFAULT 'lead'::text NOT NULL,
"go_live_date" date,
"enabled_modules" text[] DEFAULT '{}'::text[] NOT NULL,
"notes" text,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."hr_attendance"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"staff_id" uuid NOT NULL,
"date" date NOT NULL,
"status" text DEFAULT 'present'::text,
"check_in" time without time zone,
"check_out" time without time zone,
"notes" text,
"marked_by" uuid,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."hr_leaves"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"staff_id" uuid NOT NULL,
"leave_type" text NOT NULL,
"start_date" date NOT NULL,
"end_date" date NOT NULL,
"reason" text,
"status" text DEFAULT 'pending'::text,
"applied_by" uuid,
"approved_by" uuid,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."hr_payroll"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"staff_id" uuid NOT NULL,
"month" text NOT NULL,
"basic_salary" numeric DEFAULT 0,
"allowances" numeric DEFAULT 0,
"gross_salary" numeric DEFAULT 0,
"ssnit_deduction" numeric DEFAULT 0,
"income_tax" numeric DEFAULT 0,
"other_deductions" numeric DEFAULT 0,
"net_salary" numeric DEFAULT 0,
"status" text DEFAULT 'draft'::text,
"notes" text,
"generated_by" uuid,
"processed_by" uuid,
"processed_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."hr_staff"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"full_name" text NOT NULL,
"employee_id" text NOT NULL,
"department" text,
"role" text,
"employment_type" text DEFAULT 'Full-time'::text,
"phone" text,
"email" text,
"hire_date" date,
"basic_salary" numeric DEFAULT 0,
"allowances" numeric DEFAULT 0,
"bank_name" text,
"bank_account" text,
"national_id" text,
"ssnit_number" text,
"tin_number" text,
"status" text DEFAULT 'active'::text,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."integration_endpoints"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"name" text NOT NULL,
"endpoint_type" text NOT NULL,
"base_url" text NOT NULL,
"auth_type" text DEFAULT 'bearer'::text,
"credentials" jsonb DEFAULT '{}'::jsonb,
"headers" jsonb DEFAULT '{}'::jsonb,
"is_active" boolean DEFAULT true,
"timeout_seconds" integer DEFAULT 30,
"retry_count" integer DEFAULT 3,
"last_tested_at" timestamp with time zone,
"last_test_status" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."inventory_categories"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"description" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."inventory_items"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"category_id" uuid NOT NULL,
"name" text NOT NULL,
"description" text,
"unit" text DEFAULT 'pieces'::text NOT NULL,
"quantity" integer DEFAULT 0 NOT NULL,
"reorder_level" integer DEFAULT 10 NOT NULL,
"unit_cost" numeric(10,2) DEFAULT 0 NOT NULL,
"supplier" text,
"last_restock_date" date,
"location" text,
"status" text DEFAULT 'active'::text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."inventory_transactions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"item_id" uuid NOT NULL,
"transaction_type" text NOT NULL,
"quantity" integer NOT NULL,
"balance_after" integer NOT NULL,
"issued_to_user" uuid,
"issued_to_department" text,
"issued_by" uuid NOT NULL,
"cost_per_unit" numeric(10,2),
"total_cost" numeric(10,2),
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."lab_panels"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid,
"name" text NOT NULL,
"code" text,
"description" text,
"tests" jsonb DEFAULT '[]'::jsonb NOT NULL,
"category" text,
"price" numeric(10,2),
"turnaround_hours" integer DEFAULT 24,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."lab_specimens"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"lab_test_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"specimen_type" text NOT NULL,
"specimen_code" text,
"collected_by" uuid,
"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
"received_by" uuid,
"received_at" timestamp with time zone,
"storage_temperature" text,
"volume_ml" numeric(6,2),
"condition" text DEFAULT 'acceptable'::text,
"rejection_reason" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."lab_test_catalog"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"category" text NOT NULL,
"price" numeric(10,2) DEFAULT 0 NOT NULL,
"description" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"code" text,
"specimen_type" text,
"turnaround_hours" numeric(5,2),
"analytes" jsonb DEFAULT '[]'::jsonb NOT NULL,
"is_active" boolean DEFAULT true NOT NULL);
CREATE TABLE public."lab_tests"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"patient_id" uuid NOT NULL,
"test_name" text NOT NULL,
"test_type" text,
"requested_by" uuid,
"doctor_name" text,
"status" text DEFAULT 'pending'::text,
"result" text,
"result_file_url" text,
"notes" text,
"completed_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"encounter_id" uuid,
"accession_number" text,
"priority" text DEFAULT 'routine'::text,
"clinical_notes" text,
"specimen_type" text,
"collected_by" uuid,
"collected_at" timestamp with time zone,
"collection_notes" text,
"processed_by" uuid,
"processing_started_at" timestamp with time zone,
"result_details" jsonb DEFAULT '{}'::jsonb,
"is_abnormal" boolean DEFAULT false,
"completed_by" uuid,
"catalog_id" uuid,
"panel_id" uuid,
"numeric_value" numeric(10,3),
"unit" text,
"reference_range" text,
"result_flag" text,
"nhis_cc_code" text);
CREATE TABLE public."leave_requests"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"leave_type" text NOT NULL,
"start_date" date NOT NULL,
"end_date" date NOT NULL,
"total_days" integer NOT NULL,
"reason" text NOT NULL,
"status" text DEFAULT 'pending'::text NOT NULL,
"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
"approved_by" uuid,
"approved_at" timestamp with time zone,
"rejection_reason" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."maternity_deliveries"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"delivery_date" date NOT NULL,
"delivery_time" time without time zone,
"delivery_mode" text DEFAULT 'svd'::text,
"gestational_age_weeks" numeric,
"birth_weight_kg" numeric,
"baby_sex" text,
"apgar_1min" integer,
"apgar_5min" integer,
"placenta_complete" boolean DEFAULT true,
"blood_loss_ml" numeric,
"episiotomy" boolean DEFAULT false,
"tears" text DEFAULT 'none'::text,
"attendant" text,
"complications" text,
"outcome" text DEFAULT 'live_birth'::text,
"mother_condition" text DEFAULT 'good'::text,
"notes" text,
"recorded_by" uuid,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."medical_records"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"officer_id" uuid,
"officer_name" text NOT NULL,
"record_type" text NOT NULL,
"document_name" text NOT NULL,
"description" text NOT NULL,
"record_date" date NOT NULL,
"file_number" text NOT NULL,
"category" text NOT NULL,
"status" text DEFAULT 'active'::text NOT NULL,
"archived_by" uuid,
"archived_at" timestamp with time zone,
"restored_by" uuid,
"restored_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."medication_administration_records"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"admission_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"prescription_item_id" uuid,
"drug_id" uuid,
"drug_name" text NOT NULL,
"dose" text NOT NULL,
"dose_unit" text DEFAULT 'mg'::text NOT NULL,
"route" text DEFAULT 'oral'::text NOT NULL,
"frequency" text NOT NULL,
"scheduled_time" timestamp with time zone NOT NULL,
"administered_time" timestamp with time zone,
"administered_by" uuid,
"witnessed_by" uuid,
"status" text DEFAULT 'scheduled'::text NOT NULL,
"hold_reason" text,
"refusal_reason" text,
"omission_reason" text,
"site" text,
"pain_level_before" integer,
"pain_level_after" integer,
"adverse_reaction" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."mortuary_records"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid,
"name" text NOT NULL,
"age" integer,
"sex" text,
"admission_number" text,
"date_of_death" date NOT NULL,
"time_of_death" time without time zone,
"cause_of_death" text,
"manner_of_death" text,
"attending_doctor_id" uuid,
"post_mortem_required" boolean DEFAULT false,
"post_mortem_done" boolean DEFAULT false,
"post_mortem_findings" text,
"next_of_kin" text,
"next_of_kin_phone" text,
"date_released" date,
"released_to" text,
"certificate_number" text,
"notes" text,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."nhia_submissions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"batch_id" uuid NOT NULL,
"submission_type" text NOT NULL,
"submission_method" text DEFAULT 'api'::text,
"request_payload" jsonb,
"response_payload" jsonb,
"http_status" integer,
"nhia_reference_id" text,
"acknowledgment_id" text,
"status" text DEFAULT 'pending'::text NOT NULL,
"error_message" text,
"submitted_by" uuid,
"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
"response_at" timestamp with time zone,
"retry_count" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."nhia_tariff_catalog"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"gdrg_code" text NOT NULL,
"tariff_code" text,
"description" text NOT NULL,
"category" text NOT NULL,
"subcategory" text,
"base_price" numeric(10,2) NOT NULL,
"nhia_price" numeric(10,2) NOT NULL,
"effective_from" date DEFAULT CURRENT_DATE NOT NULL,
"effective_to" date,
"edition" text DEFAULT '2024'::text,
"facility_level" text,
"is_active" boolean DEFAULT true,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."nhis_cc_codes"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"encounter_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"cc_code" text NOT NULL,
"nhis_member_number" text NOT NULL,
"patient_name" text,
"scheme_code" text,
"verification_method" text DEFAULT 'manual'::text NOT NULL,
"verified" boolean DEFAULT false,
"verified_at" timestamp with time zone,
"verification_response" jsonb,
"generated_by" uuid NOT NULL,
"hospital_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."notification_logs"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid,
"channel" text NOT NULL,
"event_type" text,
"message" text,
"recipient_phone" text,
"status" text DEFAULT 'queued'::text,
"provider_response" jsonb,
"sent_by" uuid,
"sent_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."notification_settings"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"sms_provider" text DEFAULT 'arkesel'::text,
"sms_api_key" text,
"sms_sender_id" text,
"whatsapp_provider" text DEFAULT 'twilio'::text,
"whatsapp_account_sid" text,
"whatsapp_auth_token" text,
"whatsapp_from_number" text,
"enabled" boolean DEFAULT true,
"updated_by" uuid,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."notification_templates"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"event_type" text NOT NULL,
"channel" text NOT NULL,
"template_text" text NOT NULL,
"updated_by" uuid,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."notifications"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid,
"patient_id" uuid,
"type" text NOT NULL,
"channel" text NOT NULL,
"title" text NOT NULL,
"message" text NOT NULL,
"link" text,
"status" text DEFAULT 'unread'::text NOT NULL,
"priority" text DEFAULT 'normal'::text,
"scheduled_for" timestamp with time zone,
"sent_at" timestamp with time zone,
"read_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."nurse_notes"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"nurse_id" uuid NOT NULL,
"nurse_name" text NOT NULL,
"nurse_type" text,
"note_type" text NOT NULL,
"content" text NOT NULL,
"priority" text DEFAULT 'normal'::text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."nursing_assessments"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"admission_id" uuid,
"encounter_id" uuid,
"patient_id" uuid NOT NULL,
"assessed_by" uuid NOT NULL,
"assessment_type" text NOT NULL,
"total_score" numeric(5,1),
"risk_level" text,
"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
"findings" text,
"interventions_required" text,
"next_assessment_due" timestamp with time zone,
"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."nursing_care_plans"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"admission_id" uuid,
"patient_id" uuid NOT NULL,
"created_by" uuid NOT NULL,
"problem" text NOT NULL,
"nursing_diagnosis" text,
"goal" text NOT NULL,
"target_date" date,
"interventions" jsonb DEFAULT '[]'::jsonb NOT NULL,
"evaluation" text,
"status" text DEFAULT 'active'::text NOT NULL,
"reviewed_at" timestamp with time zone,
"reviewed_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."offline_cache_manifest"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"device_id" text NOT NULL,
"user_id" uuid NOT NULL,
"table_name" text NOT NULL,
"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
"record_count" integer DEFAULT 0,
"checksum" text,
"version" integer DEFAULT 1);
CREATE TABLE public."patient_transfers"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"admission_id" uuid,
"from_ward_id" uuid,
"from_bed_id" uuid,
"to_ward_id" uuid,
"to_bed_id" uuid,
"reason" text,
"transferred_by" uuid,
"transfer_date" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"transfer_time" timestamp with time zone DEFAULT now());
CREATE TABLE public."patient_vitals"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"nurse_id" uuid NOT NULL,
"nurse_name" text NOT NULL,
"temperature" numeric(4,1),
"blood_pressure" text,
"heart_rate" integer,
"respiratory_rate" integer,
"oxygen_saturation" numeric(5,2),
"weight" numeric(5,2),
"height" numeric(5,2),
"notes" text,
"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."patients"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"name" text NOT NULL,
"age" integer NOT NULL,
"gender" text NOT NULL,
"phone" text NOT NULL,
"email" text,
"address" text,
"nhis_number" text,
"insurance_type" text,
"insurance_name" text,
"emergency_contact" text,
"emergency_phone" text,
"blood_group" text,
"allergies" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"insurance_number" text,
"patient_id" text DEFAULT ('PT-'::text || upper(SUBSTRING(replace((gen_random_uuid())::text, '-'::text, ''::text) FROM 1 FOR 10))) NOT NULL);
CREATE TABLE public."payment_allocations"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"payment_id" uuid NOT NULL,
"billing_item_id" uuid NOT NULL,
"allocated_amount" numeric(10,2) NOT NULL,
"allocation_type" text DEFAULT 'patient'::text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."payments"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"patient_id" uuid NOT NULL,
"prescription_id" uuid,
"amount" numeric(10,2) NOT NULL,
"payment_method" text NOT NULL,
"momo_provider" text,
"transaction_reference" text,
"status" text DEFAULT 'pending'::text,
"paid_by" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"encounter_id" uuid);
CREATE TABLE public."permissions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"code" text NOT NULL,
"name" text NOT NULL,
"module" text NOT NULL,
"description" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."physiotherapy_sessions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"encounter_id" uuid,
"therapist_id" uuid NOT NULL,
"session_date" date DEFAULT CURRENT_DATE NOT NULL,
"diagnosis" text,
"session_number" integer DEFAULT 1,
"treatment_type" text NOT NULL,
"exercises" jsonb DEFAULT '[]'::jsonb,
"modalities_used" jsonb DEFAULT '[]'::jsonb,
"functional_goals" text,
"patient_response" text,
"pain_before" integer,
"pain_after" integer,
"home_exercises" text,
"progress_notes" text,
"next_session_date" date,
"session_duration_min" integer,
"status" text DEFAULT 'completed'::text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_audit_log"("id" bigint DEFAULT nextval('public.platform_audit_log_id_seq'::regclass) NOT NULL,
"actor_id" uuid,
"table_name" text NOT NULL,
"operation" text NOT NULL,
"record_id" uuid NOT NULL,
"old_values" jsonb,
"new_values" jsonb,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_backups"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"job_id" uuid NOT NULL,
"provider_reference" text NOT NULL,
"status" text NOT NULL,
"expires_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_health_checks"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid,
"service" text NOT NULL,
"status" text NOT NULL,
"latency_ms" integer,
"detail" text DEFAULT ''::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_incidents"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"title" text NOT NULL,
"summary" text DEFAULT ''::text NOT NULL,
"severity" text NOT NULL,
"status" text DEFAULT 'investigating'::text NOT NULL,
"resolved_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_integrations"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"provider" text NOT NULL,
"enabled" boolean DEFAULT false NOT NULL,
"notes" text DEFAULT ''::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_invoices"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"subscription_id" uuid NOT NULL,
"number" text DEFAULT ('CL-'::text || lpad((nextval('platform_invoice_number'::regclass))::text, 7, '0'::text)) NOT NULL,
"currency" text NOT NULL,
"amount" numeric(14,2) NOT NULL,
"paid_amount" numeric(14,2) DEFAULT 0 NOT NULL,
"status" text DEFAULT 'issued'::text NOT NULL,
"period_start" date NOT NULL,
"period_end" date NOT NULL,
"due_date" date NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_job_steps"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"job_id" uuid NOT NULL,
"name" text NOT NULL,
"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_jobs"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid,
"kind" text NOT NULL,
"status" text DEFAULT 'queued'::text NOT NULL,
"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
"result" jsonb,
"error" text,
"reason" text NOT NULL,
"request_key" uuid NOT NULL,
"requested_by" uuid NOT NULL,
"attempts" integer DEFAULT 0 NOT NULL,
"lease_token" uuid,
"lease_until" timestamp with time zone,
"completed_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
"draft_revision" integer,
"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL);
CREATE TABLE public."platform_launch_approvals"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"revision" integer NOT NULL,
"actor_id" uuid NOT NULL,
"reason" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_launch_evidence"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"revision" integer NOT NULL,
"kind" text NOT NULL,
"reference" text NOT NULL,
"actor_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_members"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"email" text NOT NULL,
"full_name" text DEFAULT ''::text NOT NULL,
"role" text NOT NULL,
"status" text DEFAULT 'active'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_notifications"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"recipient_id" uuid NOT NULL,
"title" text NOT NULL,
"body" text NOT NULL,
"path" text DEFAULT '/platform'::text NOT NULL,
"dedupe_key" text NOT NULL,
"read_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_onboarding_drafts"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"revision" integer DEFAULT 1 NOT NULL,
"step" integer DEFAULT 0 NOT NULL,
"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
"updated_by" uuid NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_onboarding_tasks"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"phase" text NOT NULL,
"task_name" text NOT NULL,
"task_details" text,
"status" text DEFAULT 'pending'::text NOT NULL,
"due_date" date,
"completed_at" timestamp with time zone,
"completed_by" uuid,
"sort_order" integer DEFAULT 0 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_owners"("user_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_payments"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"invoice_id" uuid NOT NULL,
"tenant_id" uuid NOT NULL,
"currency" text NOT NULL,
"amount" numeric(14,2) NOT NULL,
"provider" text NOT NULL,
"reference" text NOT NULL,
"recorded_by" uuid,
"note" text DEFAULT ''::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_plans"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"code" text NOT NULL,
"currency" text DEFAULT 'GHS'::text NOT NULL,
"monthly_price" numeric(14,2) NOT NULL,
"annual_price" numeric(14,2) NOT NULL,
"trial_days" integer DEFAULT 14 NOT NULL,
"grace_days" integer DEFAULT 7 NOT NULL,
"modules" text[] DEFAULT '{}'::text[] NOT NULL,
"active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_settings"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"singleton" boolean DEFAULT true NOT NULL,
"display_name" text DEFAULT 'CareLink'::text NOT NULL,
"support_email" text DEFAULT ''::text NOT NULL,
"renewal_notice_days" integer DEFAULT 14 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_subscriptions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"plan_id" uuid NOT NULL,
"billing_cycle" text NOT NULL,
"status" text NOT NULL,
"currency" text NOT NULL,
"amount" numeric(14,2) NOT NULL,
"period_start" date NOT NULL,
"period_end" date NOT NULL,
"trial_end" date,
"grace_days" integer DEFAULT 7 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_tenant_bindings"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"supabase_project_ref" text,
"supabase_url" text,
"vercel_project_id" text,
"vercel_project_name" text,
"deployment_id" text,
"deployment_url" text,
"domain" text,
"provider_status" text DEFAULT 'pending'::text NOT NULL,
"health_status" text DEFAULT 'unknown'::text NOT NULL,
"admin_invitation_status" text DEFAULT 'pending'::text NOT NULL,
"schema_version" text,
"schema_checksum" text,
"estimated_monthly_cost" numeric(14,2),
"cost_currency" text,
"provisioned_at" timestamp with time zone,
"last_sync_at" timestamp with time zone,
"last_health_check_at" timestamp with time zone,
"last_error" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_tenant_costs"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"provider" text NOT NULL,
"period_start" date NOT NULL,
"amount" numeric(14,2) NOT NULL,
"currency" text NOT NULL,
"source" text NOT NULL,
"measured_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_tenant_schema_ledger"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"migration_name" text NOT NULL,
"checksum" text NOT NULL,
"status" text NOT NULL,
"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
"error" text);
CREATE TABLE public."platform_tenants"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_name" text NOT NULL,
"branch_location" text,
"contact_person" text,
"contact_phone" text,
"contact_email" text,
"owner_full_name" text,
"owner_email" text NOT NULL,
"owner_phone" text,
"public_url" text,
"primary_color" text,
"secondary_color" text,
"status" text DEFAULT 'lead'::text NOT NULL,
"go_live_date" date,
"enabled_modules" text[] DEFAULT '{}'::text[] NOT NULL,
"notes" text,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"lifecycle_state" text DEFAULT 'onboarding'::text NOT NULL,
"admin_user_id" uuid,
"region" text DEFAULT ''::text NOT NULL,
"facility_type" text DEFAULT 'hospital'::text NOT NULL,
"request_key" uuid,
"provisioned_at" timestamp with time zone,
"suspended_at" timestamp with time zone);
CREATE TABLE public."platform_ticket_messages"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"ticket_id" uuid NOT NULL,
"body" text NOT NULL,
"author_id" uuid DEFAULT auth.uid() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_tickets"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid,
"subject" text NOT NULL,
"description" text DEFAULT ''::text NOT NULL,
"priority" text DEFAULT 'normal'::text NOT NULL,
"status" text DEFAULT 'open'::text NOT NULL,
"assigned_to" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."platform_usage"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"active_users" integer NOT NULL,
"storage_bytes" bigint NOT NULL,
"encounter_count" bigint NOT NULL,
"source" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."postnatal_visits"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"visit_date" date NOT NULL,
"days_postpartum" integer,
"bp_systolic" integer,
"bp_diastolic" integer,
"temperature" numeric,
"uterus_involution" text DEFAULT 'normal'::text,
"lochia" text DEFAULT 'normal'::text,
"breast_condition" text DEFAULT 'normal'::text,
"breastfeeding" boolean DEFAULT true,
"family_planning_counselled" boolean DEFAULT false,
"family_planning_method" text,
"baby_condition" text DEFAULT 'good'::text,
"immunizations_given" text,
"notes" text,
"recorded_by" uuid,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."prescription_items"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"prescription_id" uuid NOT NULL,
"drug_id" uuid NOT NULL,
"drug_name" text NOT NULL,
"quantity" integer NOT NULL,
"dosage" text,
"frequency" text,
"duration" text,
"instructions" text,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."prescriptions"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"patient_id" uuid NOT NULL,
"doctor_id" uuid,
"doctor_name" text,
"diagnosis" text,
"notes" text,
"status" text DEFAULT 'pending'::text,
"dispensed_at" timestamp with time zone,
"payment_status" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"encounter_id" uuid,
"nhis_cc_code" text);
CREATE TABLE public."problem_list"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"diagnosis_id" uuid,
"icd10_code" text NOT NULL,
"icd10_description" text NOT NULL,
"status" text DEFAULT 'active'::text NOT NULL,
"onset_date" date,
"resolved_date" date,
"severity" text,
"recorded_by" uuid,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."purchase_order_items"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"purchase_order_id" uuid NOT NULL,
"drug_id" uuid NOT NULL,
"quantity_ordered" integer NOT NULL,
"quantity_received" integer DEFAULT 0 NOT NULL,
"unit_cost" numeric(10,2) DEFAULT 0 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."purchase_orders"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"supplier_id" uuid,
"status" text DEFAULT 'ordered'::text NOT NULL,
"total_cost" numeric(12,2) DEFAULT 0,
"expected_date" date,
"notes" text,
"created_by" uuid,
"received_by" uuid,
"received_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."queue_management"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"department" text NOT NULL,
"queue_number" integer NOT NULL,
"priority" text DEFAULT 'normal'::text NOT NULL,
"status" text DEFAULT 'waiting'::text NOT NULL,
"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
"called_at" timestamp with time zone,
"started_at" timestamp with time zone,
"completed_at" timestamp with time zone,
"estimated_wait_time" integer,
"served_by" uuid,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"encounter_id" uuid,
"reason" text);
CREATE TABLE public."radiology_orders"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"order_id" uuid,
"encounter_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"ordered_by" uuid NOT NULL,
"modality" text NOT NULL,
"body_part" text NOT NULL,
"laterality" text,
"clinical_indication" text NOT NULL,
"priority" text DEFAULT 'routine'::text,
"contrast_required" boolean DEFAULT false,
"special_instructions" text,
"status" text DEFAULT 'ordered'::text NOT NULL,
"scheduled_date" date,
"scheduled_time" time without time zone,
"performed_at" timestamp with time zone,
"performed_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."radiology_results"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"radiology_order_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"radiologist_id" uuid,
"findings" text NOT NULL,
"impression" text NOT NULL,
"recommendation" text,
"critical_finding" boolean DEFAULT false,
"critical_finding_communicated_to" uuid,
"critical_finding_communicated_at" timestamp with time zone,
"report_url" text,
"image_urls" jsonb DEFAULT '[]'::jsonb,
"dicom_study_uid" text,
"report_status" text DEFAULT 'preliminary'::text NOT NULL,
"signed_by" uuid,
"signed_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."receipts"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"payment_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"receipt_number" text NOT NULL,
"amount" numeric(10,2) NOT NULL,
"payment_method" text,
"issued_by" uuid,
"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
"voided" boolean DEFAULT false,
"voided_by" uuid,
"voided_at" timestamp with time zone,
"void_reason" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."record_requests"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"requested_by" text NOT NULL,
"request_type" text NOT NULL,
"purpose" text NOT NULL,
"urgency" text DEFAULT 'normal'::text NOT NULL,
"status" text DEFAULT 'pending'::text NOT NULL,
"processed_by" uuid,
"processed_by_name" text,
"processed_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."referrals"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"referring_doctor_id" uuid NOT NULL,
"referring_doctor_name" text,
"referring_doctor_specialty" text,
"referred_to_doctor_id" uuid NOT NULL,
"referred_to_doctor_name" text,
"referred_to_doctor_specialty" text,
"reason" text NOT NULL,
"notes" text,
"urgency" text DEFAULT 'routine'::text,
"status" text DEFAULT 'pending'::text,
"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE public."registered_devices"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"device_id" text NOT NULL,
"user_id" uuid NOT NULL,
"device_name" text,
"device_type" text,
"os" text,
"app_version" text,
"push_token" text,
"last_seen_at" timestamp with time zone DEFAULT now(),
"is_active" boolean DEFAULT true,
"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
"hospital_id" uuid);
CREATE TABLE public."report_runs"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"template_id" uuid,
"hospital_id" uuid NOT NULL,
"name" text NOT NULL,
"parameters" jsonb DEFAULT '{}'::jsonb,
"status" text DEFAULT 'pending'::text,
"result_url" text,
"result_data" jsonb,
"row_count" integer,
"error_message" text,
"run_by" uuid NOT NULL,
"started_at" timestamp with time zone,
"completed_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."report_templates"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid,
"name" text NOT NULL,
"description" text,
"category" text,
"query_definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
"parameters" jsonb DEFAULT '[]'::jsonb,
"output_format" text DEFAULT 'table'::text,
"is_system" boolean DEFAULT false,
"is_active" boolean DEFAULT true,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."role_permissions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"role_id" uuid NOT NULL,
"permission_id" uuid NOT NULL,
"granted_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."roles"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"description" text,
"is_system" boolean DEFAULT false,
"hospital_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."service_fees"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"service_name" text NOT NULL,
"category" text NOT NULL,
"price" numeric(10,2) DEFAULT 0 NOT NULL,
"description" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."staff_schedules"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"shift_date" date NOT NULL,
"shift_type" text NOT NULL,
"department" text,
"start_time" time without time zone NOT NULL,
"end_time" time without time zone NOT NULL,
"status" text DEFAULT 'scheduled'::text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."suppliers"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"contact_person" text,
"phone" text,
"email" text,
"address" text,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."surgical_procedures"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"booking_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"procedure_code" text,
"procedure_name" text NOT NULL,
"laterality" text,
"anesthesia_start" timestamp with time zone,
"incision_time" timestamp with time zone,
"closure_time" timestamp with time zone,
"anesthesia_end" timestamp with time zone,
"patient_in_recovery" timestamp with time zone,
"actual_duration_min" integer,
"blood_loss_ml" integer,
"blood_transfused_units" integer DEFAULT 0,
"post_op_diagnosis" text,
"operative_findings" text,
"procedure_details" text,
"complications" text,
"specimens" jsonb DEFAULT '[]'::jsonb,
"implants" jsonb DEFAULT '[]'::jsonb,
"post_op_instructions" text,
"post_op_destination" text,
"wound_classification" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."sync_checkpoints"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"table_name" text NOT NULL,
"last_sequence" bigint DEFAULT 0,
"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."sync_conflicts"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"sync_queue_id" uuid,
"table_name" text NOT NULL,
"record_id" uuid NOT NULL,
"device_payload" jsonb NOT NULL,
"server_payload" jsonb NOT NULL,
"conflict_fields" jsonb DEFAULT '[]'::jsonb,
"resolution" text,
"resolved_by" uuid,
"resolved_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."sync_queue"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"device_id" text NOT NULL,
"user_id" uuid NOT NULL,
"table_name" text NOT NULL,
"record_id" uuid NOT NULL,
"operation" text NOT NULL,
"payload" jsonb NOT NULL,
"checksum" text,
"status" text DEFAULT 'pending'::text,
"retry_count" integer DEFAULT 0,
"error_message" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"synced_at" timestamp with time zone,
"hospital_id" uuid);
CREATE TABLE public."theatre_bookings"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"encounter_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"order_id" uuid,
"procedure_name" text NOT NULL,
"procedure_code" text,
"surgery_type" text NOT NULL,
"asa_class" text,
"theatre_room" text NOT NULL,
"lead_surgeon_id" uuid NOT NULL,
"assistant_surgeon_id" uuid,
"anesthetist_id" uuid,
"scrub_nurse_id" uuid,
"scheduled_start" timestamp with time zone NOT NULL,
"scheduled_end" timestamp with time zone NOT NULL,
"estimated_duration_min" integer,
"anesthesia_type" text,
"pre_op_diagnosis" text,
"consent_signed" boolean DEFAULT false,
"npo_status" text,
"blood_units_reserved" integer DEFAULT 0,
"status" text DEFAULT 'booked'::text NOT NULL,
"cancellation_reason" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."theatre_operation_notes"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"session_id" uuid NOT NULL,
"operation_notes" text NOT NULL,
"findings" text,
"complications" text,
"blood_loss_ml" numeric,
"duration_minutes" integer,
"implants_used" text,
"recorded_by" uuid,
"recorded_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."theatre_post_op"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"session_id" uuid NOT NULL,
"post_op_notes" text,
"recovery_status" text DEFAULT 'stable'::text,
"pain_score" integer,
"instructions" text,
"discharged_to" text DEFAULT 'ward'::text,
"discharge_time" timestamp with time zone,
"recorded_by" uuid,
"recorded_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."theatre_pre_op"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"session_id" uuid NOT NULL,
"assessment_notes" text,
"fasting_confirmed" boolean DEFAULT false,
"allergies" text,
"blood_group" text,
"consent_obtained" boolean DEFAULT false,
"pre_op_medication" text,
"anaesthesia_type" text DEFAULT 'general'::text,
"recorded_by" uuid,
"recorded_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."theatre_sessions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hospital_id" uuid NOT NULL,
"patient_id" uuid NOT NULL,
"scheduled_date" date NOT NULL,
"scheduled_time" time without time zone,
"procedure_name" text NOT NULL,
"surgeon" text NOT NULL,
"anaesthetist" text,
"ot_room" text,
"surgery_type" text DEFAULT 'elective'::text,
"anaesthesia_type" text DEFAULT 'general'::text,
"status" text DEFAULT 'scheduled'::text,
"pre_op_notes" text,
"consent_obtained" boolean DEFAULT false,
"consent_date" date,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."triage_assessments"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"assessed_by" uuid NOT NULL,
"triage_level" text DEFAULT 'yellow'::text NOT NULL,
"chief_complaint" text NOT NULL,
"vital_signs" jsonb,
"pain_scale" integer,
"assessment_notes" text,
"recommended_action" text,
"assigned_to" uuid,
"status" text DEFAULT 'pending'::text,
"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"encounter_id" uuid,
"severity" text,
"pain_score" text,
"notes" text);
CREATE TABLE public."user_sessions"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"session_token" text,
"ip_address" inet,
"user_agent" text,
"device_type" text,
"login_at" timestamp with time zone DEFAULT now() NOT NULL,
"logout_at" timestamp with time zone,
"last_active_at" timestamp with time zone DEFAULT now(),
"is_active" boolean DEFAULT true,
"hospital_id" uuid);
CREATE TABLE public."users"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"email" text NOT NULL,
"role" text NOT NULL,
"full_name" text,
"phone" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"specialty" character varying(100));
CREATE TABLE public."virtual_consultations"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"patient_id" uuid NOT NULL,
"doctor_id" uuid NOT NULL,
"appointment_id" uuid,
"scheduled_time" timestamp with time zone NOT NULL,
"duration" integer DEFAULT 30,
"status" text DEFAULT 'scheduled'::text NOT NULL,
"meeting_platform" text DEFAULT 'carelink_video'::text,
"meeting_link" text,
"meeting_id" text,
"meeting_password" text,
"consultation_notes" text,
"prescription_id" uuid,
"follow_up_required" boolean DEFAULT false,
"follow_up_date" date,
"started_at" timestamp with time zone,
"ended_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"actual_duration" integer,
"call_mode" text DEFAULT 'video'::text);
CREATE TABLE public."vitals"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"encounter_id" uuid,
"patient_id" uuid NOT NULL,
"recorded_by" uuid NOT NULL,
"temperature_c" numeric(4,1),
"bp_systolic" integer,
"bp_diastolic" integer,
"pulse_rate" integer,
"respiratory_rate" integer,
"spo2" numeric(4,1),
"weight_kg" numeric(5,1),
"height_cm" numeric(5,1),
"bmi" numeric(4,1),
"pain_scale" integer,
"blood_glucose" numeric(5,1),
"gcs_score" integer,
"notes" text,
"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."ward_rounds"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"admission_id" uuid,
"patient_id" uuid NOT NULL,
"encounter_id" uuid,
"doctor_id" uuid NOT NULL,
"ward_id" uuid,
"round_type" text DEFAULT 'routine'::text,
"observations" text,
"clinical_findings" text,
"assessment" text,
"new_orders" text,
"orders" text,
"plan" text,
"notes" text,
"diet_orders" text,
"activity_orders" text,
"condition_status" text,
"next_round_date" date,
"attendees" jsonb DEFAULT '[]'::jsonb,
"round_time" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."wards"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"floor" text,
"ward_type" text NOT NULL,
"total_beds" integer DEFAULT 0 NOT NULL,
"available_beds" integer DEFAULT 0 NOT NULL,
"nurse_in_charge" uuid,
"status" text DEFAULT 'active'::text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public."suppliers" ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY (id);
ALTER TABLE public."report_runs" ADD CONSTRAINT "report_runs_pkey" PRIMARY KEY (id);
ALTER TABLE public."purchase_orders" ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);
ALTER TABLE public."hr_attendance" ADD CONSTRAINT "hr_attendance_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_job_steps" ADD CONSTRAINT "platform_job_steps_pkey" PRIMARY KEY (id);
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_pkey" PRIMARY KEY (id);
ALTER TABLE public."report_templates" ADD CONSTRAINT "report_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."hr_leaves" ADD CONSTRAINT "hr_leaves_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_payments" ADD CONSTRAINT "platform_payments_pkey" PRIMARY KEY (id);
ALTER TABLE public."nhis_cc_codes" ADD CONSTRAINT "nhis_cc_codes_pkey" PRIMARY KEY (id);
ALTER TABLE public."ambulance_fleet" ADD CONSTRAINT "ambulance_fleet_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."integration_endpoints" ADD CONSTRAINT "integration_endpoints_pkey" PRIMARY KEY (id);
ALTER TABLE public."ambulance_dispatches" ADD CONSTRAINT "ambulance_dispatches_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_tenant_schema_ledger" ADD CONSTRAINT "platform_tenant_schema_ledger_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_onboarding_drafts" ADD CONSTRAINT "platform_onboarding_drafts_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_pkey" PRIMARY KEY (id);
ALTER TABLE public."dhims2_reports" ADD CONSTRAINT "dhims2_reports_pkey" PRIMARY KEY (id);
ALTER TABLE public."dhims2_indicator_mappings" ADD CONSTRAINT "dhims2_indicator_mappings_pkey" PRIMARY KEY (id);
ALTER TABLE public."permissions" ADD CONSTRAINT "permissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."role_permissions" ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."fhir_endpoint_config" ADD CONSTRAINT "fhir_endpoint_config_pkey" PRIMARY KEY (id);
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."queue_management" ADD CONSTRAINT "queue_management_pkey" PRIMARY KEY (id);
ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_pkey" PRIMARY KEY (id);
ALTER TABLE public."fhir_resource_log" ADD CONSTRAINT "fhir_resource_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."data_access_log" ADD CONSTRAINT "data_access_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."consent_records" ADD CONSTRAINT "consent_records_pkey" PRIMARY KEY (id);
ALTER TABLE public."diagnoses" ADD CONSTRAINT "diagnoses_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_sessions" ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."vitals" ADD CONSTRAINT "vitals_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_plans" ADD CONSTRAINT "platform_plans_pkey" PRIMARY KEY (id);
ALTER TABLE public."virtual_consultations" ADD CONSTRAINT "virtual_consultations_pkey" PRIMARY KEY (id);
ALTER TABLE public."hr_payroll" ADD CONSTRAINT "hr_payroll_pkey" PRIMARY KEY (id);
ALTER TABLE public."hospital_departments" ADD CONSTRAINT "hospital_departments_pkey" PRIMARY KEY (id);
ALTER TABLE public."clinical_notes" ADD CONSTRAINT "clinical_notes_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_audit_log" ADD CONSTRAINT "platform_audit_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."wards" ADD CONSTRAINT "wards_pkey" PRIMARY KEY (id);
ALTER TABLE public."patients" ADD CONSTRAINT "patients_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_onboarding_tasks" ADD CONSTRAINT "platform_onboarding_tasks_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_tenants" ADD CONSTRAINT "platform_tenants_pkey" PRIMARY KEY (id);
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_pkey" PRIMARY KEY (id);
ALTER TABLE public."discharge_summaries" ADD CONSTRAINT "discharge_summaries_pkey" PRIMARY KEY (id);
ALTER TABLE public."surgical_procedures" ADD CONSTRAINT "surgical_procedures_pkey" PRIMARY KEY (id);
ALTER TABLE public."clinical_orders" ADD CONSTRAINT "clinical_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."beds" ADD CONSTRAINT "beds_pkey" PRIMARY KEY (id);
ALTER TABLE public."drugs" ADD CONSTRAINT "drugs_pkey" PRIMARY KEY (id);
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_pkey" PRIMARY KEY (id);
ALTER TABLE public."radiology_results" ADD CONSTRAINT "radiology_results_pkey" PRIMARY KEY (id);
ALTER TABLE public."problem_list" ADD CONSTRAINT "problem_list_pkey" PRIMARY KEY (id);
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."payment_allocations" ADD CONSTRAINT "payment_allocations_pkey" PRIMARY KEY (id);
ALTER TABLE public."claim_items" ADD CONSTRAINT "claim_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."allergies" ADD CONSTRAINT "allergies_pkey" PRIMARY KEY (id);
ALTER TABLE public."roles" ADD CONSTRAINT "roles_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_members" ADD CONSTRAINT "platform_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."claim_batches" ADD CONSTRAINT "claim_batches_pkey" PRIMARY KEY (id);
ALTER TABLE public."nhia_submissions" ADD CONSTRAINT "nhia_submissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_pkey" PRIMARY KEY (id);
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."audit_log" ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_notifications" ADD CONSTRAINT "platform_notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_pkey" PRIMARY KEY (id);
ALTER TABLE public."fee_schedules" ADD CONSTRAINT "fee_schedules_pkey" PRIMARY KEY (id);
ALTER TABLE public."nhia_tariff_catalog" ADD CONSTRAINT "nhia_tariff_catalog_pkey" PRIMARY KEY (id);
ALTER TABLE public."fluid_balance_charts" ADD CONSTRAINT "fluid_balance_charts_pkey" PRIMARY KEY (id);
ALTER TABLE public."inventory_categories" ADD CONSTRAINT "inventory_categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_owners" ADD CONSTRAINT "platform_owners_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."handover_notes" ADD CONSTRAINT "handover_notes_pkey" PRIMARY KEY (id);
ALTER TABLE public."ward_rounds" ADD CONSTRAINT "ward_rounds_pkey" PRIMARY KEY (id);
ALTER TABLE public."nursing_assessments" ADD CONSTRAINT "nursing_assessments_pkey" PRIMARY KEY (id);
ALTER TABLE public."inventory_items" ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_tenant_costs" ADD CONSTRAINT "platform_tenant_costs_pkey" PRIMARY KEY (id);
ALTER TABLE public."nursing_care_plans" ADD CONSTRAINT "nursing_care_plans_pkey" PRIMARY KEY (id);
ALTER TABLE public."carelink_instance" ADD CONSTRAINT "carelink_instance_pkey" PRIMARY KEY (singleton);
ALTER TABLE public."inventory_transactions" ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_pkey" PRIMARY KEY (id);
ALTER TABLE public."patient_vitals" ADD CONSTRAINT "patient_vitals_pkey" PRIMARY KEY (id);
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY (id);
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_pkey" PRIMARY KEY (id);
ALTER TABLE public."triage_assessments" ADD CONSTRAINT "triage_assessments_pkey" PRIMARY KEY (id);
ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."theatre_sessions" ADD CONSTRAINT "theatre_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."nurse_notes" ADD CONSTRAINT "nurse_notes_pkey" PRIMARY KEY (id);
ALTER TABLE public."physiotherapy_sessions" ADD CONSTRAINT "physiotherapy_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."dental_records" ADD CONSTRAINT "dental_records_pkey" PRIMARY KEY (id);
ALTER TABLE public."staff_schedules" ADD CONSTRAINT "staff_schedules_pkey" PRIMARY KEY (id);
ALTER TABLE public."theatre_operation_notes" ADD CONSTRAINT "theatre_operation_notes_pkey" PRIMARY KEY (id);
ALTER TABLE public."mortuary_records" ADD CONSTRAINT "mortuary_records_pkey" PRIMARY KEY (id);
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."prescription_items" ADD CONSTRAINT "prescription_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."blood_inventory" ADD CONSTRAINT "blood_inventory_pkey" PRIMARY KEY (id);
ALTER TABLE public."anc_visits" ADD CONSTRAINT "anc_visits_pkey" PRIMARY KEY (id);
ALTER TABLE public."drug_interactions" ADD CONSTRAINT "drug_interactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."blood_donations" ADD CONSTRAINT "blood_donations_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_backups" ADD CONSTRAINT "platform_backups_pkey" PRIMARY KEY (id);
ALTER TABLE public."drug_batches" ADD CONSTRAINT "drug_batches_pkey" PRIMARY KEY (id);
ALTER TABLE public."lab_panels" ADD CONSTRAINT "lab_panels_pkey" PRIMARY KEY (id);
ALTER TABLE public."blood_requests" ADD CONSTRAINT "blood_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_pkey" PRIMARY KEY (id);
ALTER TABLE public."lab_specimens" ADD CONSTRAINT "lab_specimens_pkey" PRIMARY KEY (id);
ALTER TABLE public."hospital_profile" ADD CONSTRAINT "hospital_profile_pkey" PRIMARY KEY (singleton_key);
ALTER TABLE public."maternity_deliveries" ADD CONSTRAINT "maternity_deliveries_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_launch_approvals" ADD CONSTRAINT "platform_launch_approvals_pkey" PRIMARY KEY (id);
ALTER TABLE public."registered_devices" ADD CONSTRAINT "registered_devices_pkey" PRIMARY KEY (id);
ALTER TABLE public."purchase_order_items" ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_jobs" ADD CONSTRAINT "platform_jobs_pkey" PRIMARY KEY (id);
ALTER TABLE public."patient_transfers" ADD CONSTRAINT "patient_transfers_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_integrations" ADD CONSTRAINT "platform_integrations_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_health_checks" ADD CONSTRAINT "platform_health_checks_pkey" PRIMARY KEY (id);
ALTER TABLE public."record_requests" ADD CONSTRAINT "record_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."postnatal_visits" ADD CONSTRAINT "postnatal_visits_pkey" PRIMARY KEY (id);
ALTER TABLE public."payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id);
ALTER TABLE public."theatre_pre_op" ADD CONSTRAINT "theatre_pre_op_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_launch_evidence" ADD CONSTRAINT "platform_launch_evidence_pkey" PRIMARY KEY (id);
ALTER TABLE public."sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_pkey" PRIMARY KEY (id);
ALTER TABLE public."lab_test_catalog" ADD CONSTRAINT "lab_test_catalog_pkey" PRIMARY KEY (id);
ALTER TABLE public."service_fees" ADD CONSTRAINT "service_fees_pkey" PRIMARY KEY (id);
ALTER TABLE public."diet_orders" ADD CONSTRAINT "diet_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_usage" ADD CONSTRAINT "platform_usage_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_incidents" ADD CONSTRAINT "platform_incidents_pkey" PRIMARY KEY (id);
ALTER TABLE public."notification_settings" ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."hospitals" ADD CONSTRAINT "hospitals_pkey" PRIMARY KEY (id);
ALTER TABLE public."offline_cache_manifest" ADD CONSTRAINT "offline_cache_manifest_pkey" PRIMARY KEY (id);
ALTER TABLE public."notification_templates" ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_ticket_messages" ADD CONSTRAINT "platform_ticket_messages_pkey" PRIMARY KEY (id);
ALTER TABLE public."claims" ADD CONSTRAINT "claims_pkey" PRIMARY KEY (id);
ALTER TABLE public."sync_conflicts" ADD CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY (id);
ALTER TABLE public."notification_logs" ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_tickets" ADD CONSTRAINT "platform_tickets_pkey" PRIMARY KEY (id);
ALTER TABLE public."sync_queue" ADD CONSTRAINT "sync_queue_pkey" PRIMARY KEY (id);
ALTER TABLE public."hr_staff" ADD CONSTRAINT "hr_staff_pkey" PRIMARY KEY (id);
ALTER TABLE public."hospital_onboarding_tasks" ADD CONSTRAINT "hospital_onboarding_tasks_pkey" PRIMARY KEY (id);
ALTER TABLE public."theatre_post_op" ADD CONSTRAINT "theatre_post_op_pkey" PRIMARY KEY (id);
ALTER TABLE public."ai_suggestions" ADD CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY (id);
ALTER TABLE public."sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_hospital_id_table_name_key" UNIQUE (hospital_id, table_name);
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_tenant_id_key" UNIQUE (tenant_id);
ALTER TABLE public."notification_templates" ADD CONSTRAINT "notification_templates_hospital_id_event_type_channel_key" UNIQUE (hospital_id, event_type, channel);
ALTER TABLE public."claim_batches" ADD CONSTRAINT "claim_batches_batch_number_key" UNIQUE (batch_number);
ALTER TABLE public."users" ADD CONSTRAINT "users_email_key" UNIQUE (email);
ALTER TABLE public."drug_interactions" ADD CONSTRAINT "drug_interactions_drug_a_id_drug_b_id_key" UNIQUE (drug_a_id, drug_b_id);
ALTER TABLE public."offline_cache_manifest" ADD CONSTRAINT "offline_cache_manifest_device_id_table_name_key" UNIQUE (device_id, table_name);
ALTER TABLE public."platform_plans" ADD CONSTRAINT "platform_plans_code_key" UNIQUE (code);
ALTER TABLE public."platform_payments" ADD CONSTRAINT "platform_payments_provider_reference_key" UNIQUE (provider, reference);
ALTER TABLE public."hospital_departments" ADD CONSTRAINT "hospital_departments_hospital_id_name_key" UNIQUE (hospital_id, name);
ALTER TABLE public."registered_devices" ADD CONSTRAINT "registered_devices_device_id_key" UNIQUE (device_id);
ALTER TABLE public."platform_notifications" ADD CONSTRAINT "platform_notifications_recipient_id_dedupe_key_key" UNIQUE (recipient_id, dedupe_key);
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_subscription_id_period_start_key" UNIQUE (subscription_id, period_start);
ALTER TABLE public."lab_test_catalog" ADD CONSTRAINT "lab_test_catalog_name_key" UNIQUE (name);
ALTER TABLE public."platform_backups" ADD CONSTRAINT "platform_backups_job_id_key" UNIQUE (job_id);
ALTER TABLE public."ambulance_fleet" ADD CONSTRAINT "ambulance_fleet_hospital_id_registration_number_key" UNIQUE (hospital_id, registration_number);
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_number_key" UNIQUE (number);
ALTER TABLE public."platform_tenant_schema_ledger" ADD CONSTRAINT "platform_tenant_schema_ledger_tenant_id_migration_name_key" UNIQUE (tenant_id, migration_name);
ALTER TABLE public."inventory_categories" ADD CONSTRAINT "inventory_categories_name_key" UNIQUE (name);
ALTER TABLE public."platform_job_steps" ADD CONSTRAINT "platform_job_steps_job_id_name_key" UNIQUE (job_id, name);
ALTER TABLE public."service_fees" ADD CONSTRAINT "service_fees_service_name_key" UNIQUE (service_name);
ALTER TABLE public."drug_batches" ADD CONSTRAINT "drug_batches_drug_id_batch_number_key" UNIQUE (drug_id, batch_number);
ALTER TABLE public."hr_staff" ADD CONSTRAINT "hr_staff_hospital_id_employee_id_key" UNIQUE (hospital_id, employee_id);
ALTER TABLE public."platform_tenant_costs" ADD CONSTRAINT "platform_tenant_costs_tenant_id_provider_period_start_key" UNIQUE (tenant_id, provider, period_start);
ALTER TABLE public."theatre_operation_notes" ADD CONSTRAINT "theatre_operation_notes_session_id_key" UNIQUE (session_id);
ALTER TABLE public."platform_launch_approvals" ADD CONSTRAINT "platform_launch_approvals_tenant_id_revision_key" UNIQUE (tenant_id, revision);
ALTER TABLE public."platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_tenant_id_key" UNIQUE (tenant_id);
ALTER TABLE public."platform_launch_evidence" ADD CONSTRAINT "platform_launch_evidence_tenant_id_revision_kind_key" UNIQUE (tenant_id, revision, kind);
ALTER TABLE public."patients" ADD CONSTRAINT "patients_patient_id_key" UNIQUE (patient_id);
ALTER TABLE public."beds" ADD CONSTRAINT "beds_ward_id_bed_number_key" UNIQUE (ward_id, bed_number);
ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_singleton_key" UNIQUE (singleton);
ALTER TABLE public."permissions" ADD CONSTRAINT "permissions_code_key" UNIQUE (code);
ALTER TABLE public."roles" ADD CONSTRAINT "roles_name_key" UNIQUE (name);
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_hospital_id_receipt_number_key" UNIQUE (hospital_id, receipt_number);
ALTER TABLE public."notification_settings" ADD CONSTRAINT "notification_settings_hospital_id_key" UNIQUE (hospital_id);
ALTER TABLE public."fhir_endpoint_config" ADD CONSTRAINT "fhir_endpoint_config_hospital_id_key" UNIQUE (hospital_id);
ALTER TABLE public."theatre_pre_op" ADD CONSTRAINT "theatre_pre_op_session_id_key" UNIQUE (session_id);
ALTER TABLE public."platform_tenants" ADD CONSTRAINT "platform_tenants_request_key_key" UNIQUE (request_key);
ALTER TABLE public."platform_members" ADD CONSTRAINT "platform_members_user_id_key" UNIQUE (user_id);
ALTER TABLE public."hr_payroll" ADD CONSTRAINT "hr_payroll_hospital_id_staff_id_month_key" UNIQUE (hospital_id, staff_id, month);
ALTER TABLE public."role_permissions" ADD CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE (role_id, permission_id);
ALTER TABLE public."theatre_post_op" ADD CONSTRAINT "theatre_post_op_session_id_key" UNIQUE (session_id);
ALTER TABLE public."staff_schedules" ADD CONSTRAINT "staff_schedules_user_id_shift_date_shift_type_key" UNIQUE (user_id, shift_date, shift_type);
ALTER TABLE public."platform_onboarding_drafts" ADD CONSTRAINT "platform_onboarding_drafts_tenant_id_key" UNIQUE (tenant_id);
ALTER TABLE public."platform_jobs" ADD CONSTRAINT "platform_jobs_request_key_key" UNIQUE (request_key);
ALTER TABLE public."hr_attendance" ADD CONSTRAINT "hr_attendance_hospital_id_staff_id_date_key" UNIQUE (hospital_id, staff_id, date);
ALTER TABLE public."hr_staff" ADD CONSTRAINT "hr_staff_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'terminated'::text, 'suspended'::text])));
ALTER TABLE public."maternity_deliveries" ADD CONSTRAINT "maternity_deliveries_baby_sex_check" CHECK ((baby_sex = ANY (ARRAY['male'::text, 'female'::text])));
ALTER TABLE public."hospital_onboarding_tasks" ADD CONSTRAINT "hospital_onboarding_tasks_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'blocked'::text])));
ALTER TABLE public."sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolution_check" CHECK ((resolution = ANY (ARRAY['device_wins'::text, 'server_wins'::text, 'manual'::text, 'pending'::text])));
ALTER TABLE public."notification_logs" ADD CONSTRAINT "notification_logs_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text])));
ALTER TABLE public."platform_tickets" ADD CONSTRAINT "platform_tickets_subject_check" CHECK ((length(TRIM(BOTH FROM subject)) > 0));
ALTER TABLE public."platform_tickets" ADD CONSTRAINT "platform_tickets_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));
ALTER TABLE public."notification_templates" ADD CONSTRAINT "notification_templates_channel_check" CHECK ((channel = ANY (ARRAY['SMS'::text, 'WhatsApp'::text])));
ALTER TABLE public."diet_orders" ADD CONSTRAINT "diet_orders_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'discontinued'::text, 'completed'::text])));
ALTER TABLE public."platform_tickets" ADD CONSTRAINT "platform_tickets_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting'::text, 'resolved'::text, 'closed'::text])));
ALTER TABLE public."virtual_consultations" ADD CONSTRAINT "virtual_consultations_meeting_platform_check" CHECK ((meeting_platform = ANY (ARRAY['carelink_video'::text, 'carelink_audio'::text, 'zoom'::text, 'google_meet'::text, 'microsoft_teams'::text, 'custom'::text])));
ALTER TABLE public."virtual_consultations" ADD CONSTRAINT "virtual_consultations_call_mode_check" CHECK ((call_mode = ANY (ARRAY['video'::text, 'audio'::text])));
ALTER TABLE public."wards" ADD CONSTRAINT "wards_ward_type_check" CHECK ((ward_type = ANY (ARRAY['general'::text, 'private'::text, 'icu'::text, 'maternity'::text, 'pediatric'::text, 'isolation'::text])));
ALTER TABLE public."registered_devices" ADD CONSTRAINT "registered_devices_device_type_check" CHECK ((device_type = ANY (ARRAY['mobile'::text, 'tablet'::text, 'desktop'::text])));
ALTER TABLE public."purchase_order_items" ADD CONSTRAINT "purchase_order_items_quantity_ordered_check" CHECK ((quantity_ordered > 0));
ALTER TABLE public."maternity_deliveries" ADD CONSTRAINT "maternity_deliveries_outcome_check" CHECK ((outcome = ANY (ARRAY['live_birth'::text, 'stillbirth'::text, 'neonatal_death'::text, 'twins'::text])));
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_supabase_project_ref_check" CHECK ((supabase_project_ref ~ '^[a-z0-9]{6,64}$'::text));
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_provider_status_check" CHECK ((provider_status = ANY (ARRAY['pending'::text, 'creating'::text, 'ready'::text, 'degraded'::text, 'failed'::text, 'blocked'::text])));
ALTER TABLE public."platform_ticket_messages" ADD CONSTRAINT "platform_ticket_messages_body_check" CHECK (((length(TRIM(BOTH FROM body)) >= 1) AND (length(TRIM(BOTH FROM body)) <= 8000)));
ALTER TABLE public."hospital_onboarding_tasks" ADD CONSTRAINT "hospital_onboarding_tasks_phase_check" CHECK ((phase = ANY (ARRAY['intake'::text, 'technical'::text, 'database'::text, 'accounts'::text, 'branding'::text, 'go_live'::text, 'security'::text, 'handover'::text])));
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_health_status_check" CHECK ((health_status = ANY (ARRAY['unknown'::text, 'healthy'::text, 'degraded'::text, 'down'::text])));
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_admin_invitation_status_check" CHECK ((admin_invitation_status = ANY (ARRAY['pending'::text, 'requested'::text, 'accepted'::text, 'failed'::text])));
ALTER TABLE public."lab_specimens" ADD CONSTRAINT "lab_specimens_specimen_type_check" CHECK ((specimen_type = ANY (ARRAY['blood'::text, 'urine'::text, 'stool'::text, 'sputum'::text, 'swab'::text, 'csf'::text, 'tissue'::text, 'other'::text])));
ALTER TABLE public."lab_specimens" ADD CONSTRAINT "lab_specimens_condition_check" CHECK ((condition = ANY (ARRAY['acceptable'::text, 'haemolysed'::text, 'lipemic'::text, 'insufficient'::text, 'rejected'::text])));
ALTER TABLE public."hospital_profile" ADD CONSTRAINT "singleton_check" CHECK ((singleton_key = true));
ALTER TABLE public."platform_incidents" ADD CONSTRAINT "platform_incidents_severity_check" CHECK ((severity = ANY (ARRAY['minor'::text, 'major'::text, 'critical'::text])));
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_schema_checksum_check" CHECK (((schema_checksum IS NULL) OR (schema_checksum ~ '^[a-f0-9]{64}$'::text)));
ALTER TABLE public."platform_incidents" ADD CONSTRAINT "platform_incidents_status_check" CHECK ((status = ANY (ARRAY['investigating'::text, 'identified'::text, 'monitoring'::text, 'resolved'::text])));
ALTER TABLE public."hospitals" ADD CONSTRAINT "hospitals_status_check" CHECK ((status = ANY (ARRAY['lead'::text, 'intake'::text, 'provisioning'::text, 'training'::text, 'ready_for_go_live'::text, 'live'::text, 'paused'::text])));
ALTER TABLE public."blood_requests" ADD CONSTRAINT "blood_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'fulfilled'::text, 'cancelled'::text])));
ALTER TABLE public."platform_usage" ADD CONSTRAINT "platform_usage_active_users_check" CHECK ((active_users >= 0));
ALTER TABLE public."blood_requests" ADD CONSTRAINT "blood_requests_urgency_check" CHECK ((urgency = ANY (ARRAY['routine'::text, 'urgent'::text, 'emergency'::text])));
ALTER TABLE public."blood_donations" ADD CONSTRAINT "blood_donations_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'used'::text, 'expired'::text, 'discarded'::text])));
ALTER TABLE public."platform_usage" ADD CONSTRAINT "platform_usage_storage_bytes_check" CHECK ((storage_bytes >= 0));
ALTER TABLE public."platform_usage" ADD CONSTRAINT "platform_usage_encounter_count_check" CHECK ((encounter_count >= 0));
ALTER TABLE public."users" ADD CONSTRAINT "users_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'doctor'::text, 'pharmacist'::text, 'nurse'::text, 'cashier'::text, 'records_officer'::text])));
ALTER TABLE public."drug_interactions" ADD CONSTRAINT "drug_interactions_severity_check" CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'major'::text, 'contraindicated'::text])));
ALTER TABLE public."blood_donations" ADD CONSTRAINT "blood_donations_screening_status_check" CHECK ((screening_status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text])));
ALTER TABLE public."blood_inventory" ADD CONSTRAINT "blood_inventory_blood_type_check" CHECK ((blood_type = ANY (ARRAY['A+'::text, 'A-'::text, 'B+'::text, 'B-'::text, 'AB+'::text, 'AB-'::text, 'O+'::text, 'O-'::text])));
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_estimated_monthly_cost_check" CHECK (((estimated_monthly_cost IS NULL) OR (estimated_monthly_cost >= (0)::numeric)));
ALTER TABLE public."platform_health_checks" ADD CONSTRAINT "platform_health_checks_status_check" CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'down'::text])));
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_action_check" CHECK ((action = ANY (ARRAY['received'::text, 'dispensed'::text, 'destroyed'::text, 'returned'::text, 'transferred'::text, 'count'::text])));
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
ALTER TABLE public."platform_health_checks" ADD CONSTRAINT "platform_health_checks_latency_ms_check" CHECK ((latency_ms >= 0));
ALTER TABLE public."record_requests" ADD CONSTRAINT "record_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_cost_currency_check" CHECK (((cost_currency IS NULL) OR (cost_currency ~ '^[A-Z]{3}$'::text)));
ALTER TABLE public."platform_integrations" ADD CONSTRAINT "platform_integrations_provider_check" CHECK ((provider = ANY (ARRAY['paystack'::text, 'flutterwave'::text, 'tenant_agent'::text, 'provisioning'::text, 'backup'::text])));
ALTER TABLE public."record_requests" ADD CONSTRAINT "record_requests_urgency_check" CHECK ((urgency = ANY (ARRAY['normal'::text, 'urgent'::text, 'emergency'::text])));
ALTER TABLE public."platform_jobs" ADD CONSTRAINT "platform_jobs_kind_check" CHECK ((kind = ANY (ARRAY['invite_admin'::text, 'invite_platform'::text, 'provision'::text, 'go_live'::text, 'suspend'::text, 'reactivate'::text, 'apply_modules'::text, 'backup'::text, 'restore'::text, 'collect_usage'::text, 'health_check'::text])));
ALTER TABLE public."platform_jobs" ADD CONSTRAINT "platform_jobs_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'blocked'::text])));
ALTER TABLE public."mortuary_records" ADD CONSTRAINT "mortuary_records_sex_check" CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text, 'unknown'::text])));
ALTER TABLE public."mortuary_records" ADD CONSTRAINT "mortuary_records_manner_of_death_check" CHECK ((manner_of_death = ANY (ARRAY['natural'::text, 'accidental'::text, 'homicide'::text, 'suicide'::text, 'undetermined'::text])));
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_leave_type_check" CHECK ((leave_type = ANY (ARRAY['sick'::text, 'annual'::text, 'emergency'::text, 'maternity'::text, 'paternity'::text, 'compassionate'::text, 'unpaid'::text])));
ALTER TABLE public."platform_jobs" ADD CONSTRAINT "platform_jobs_reason_check" CHECK ((length(TRIM(BOTH FROM reason)) >= 5));
ALTER TABLE public."record_requests" ADD CONSTRAINT "record_requests_request_type_check" CHECK ((request_type = ANY (ARRAY['view'::text, 'copy'::text, 'transfer'::text, 'audit'::text, 'other'::text])));
ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])));
ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'dispensed'::text, 'cancelled'::text])));
ALTER TABLE public."staff_schedules" ADD CONSTRAINT "staff_schedules_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'absent'::text, 'on_leave'::text, 'swapped'::text])));
ALTER TABLE public."patients" ADD CONSTRAINT "patients_insurance_type_check" CHECK ((insurance_type = ANY (ARRAY['nhis'::text, 'private'::text, 'none'::text])));
ALTER TABLE public."platform_backups" ADD CONSTRAINT "platform_backups_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'expired'::text])));
ALTER TABLE public."physiotherapy_sessions" ADD CONSTRAINT "physiotherapy_sessions_pain_before_check" CHECK (((pain_before >= 0) AND (pain_before <= 10)));
ALTER TABLE public."physiotherapy_sessions" ADD CONSTRAINT "physiotherapy_sessions_pain_after_check" CHECK (((pain_after >= 0) AND (pain_after <= 10)));
ALTER TABLE public."physiotherapy_sessions" ADD CONSTRAINT "physiotherapy_sessions_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])));
ALTER TABLE public."staff_schedules" ADD CONSTRAINT "staff_schedules_shift_type_check" CHECK ((shift_type = ANY (ARRAY['morning'::text, 'afternoon'::text, 'night'::text, 'full_day'::text])));
ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_category_check" CHECK ((category = ANY (ARRAY['medical'::text, 'administrative'::text, 'billing'::text, 'laboratory'::text])));
ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_record_type_check" CHECK ((record_type = ANY (ARRAY['consultation'::text, 'lab_result'::text, 'imaging'::text, 'prescription'::text, 'discharge_summary'::text, 'admission'::text, 'surgery'::text, 'other'::text])));
ALTER TABLE public."theatre_sessions" ADD CONSTRAINT "theatre_sessions_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'postponed'::text])));
ALTER TABLE public."nursing_care_plans" ADD CONSTRAINT "nursing_care_plans_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'achieved'::text, 'not_achieved'::text, 'revised'::text, 'discontinued'::text])));
ALTER TABLE public."platform_tenant_schema_ledger" ADD CONSTRAINT "platform_tenant_schema_ledger_checksum_check" CHECK ((checksum ~ '^[a-f0-9]{64}$'::text));
ALTER TABLE public."triage_assessments" ADD CONSTRAINT "triage_assessments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_treatment'::text, 'completed'::text])));
ALTER TABLE public."triage_assessments" ADD CONSTRAINT "triage_assessments_pain_scale_check" CHECK (((pain_scale >= 0) AND (pain_scale <= 10)));
ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'completed'::text, 'rejected'::text])));
ALTER TABLE public."ward_rounds" ADD CONSTRAINT "ward_rounds_round_type_check" CHECK ((round_type = ANY (ARRAY['routine'::text, 'consultant'::text, 'grand'::text, 'teaching'::text, 'night'::text])));
ALTER TABLE public."ward_rounds" ADD CONSTRAINT "ward_rounds_condition_status_check" CHECK ((condition_status = ANY (ARRAY['improving'::text, 'stable'::text, 'deteriorating'::text, 'critical'::text])));
ALTER TABLE public."nursing_assessments" ADD CONSTRAINT "nursing_assessments_risk_level_check" CHECK ((risk_level = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text, 'very_high'::text])));
ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_urgency_check" CHECK ((urgency = ANY (ARRAY['routine'::text, 'urgent'::text, 'emergency'::text])));
ALTER TABLE public."platform_tenant_schema_ledger" ADD CONSTRAINT "platform_tenant_schema_ledger_status_check" CHECK ((status = ANY (ARRAY['applied'::text, 'failed'::text])));
ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_singleton_check" CHECK (singleton);
ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_renewal_notice_days_check" CHECK (((renewal_notice_days >= 1) AND (renewal_notice_days <= 90)));
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_delivery_mode_check" CHECK ((delivery_mode = ANY (ARRAY['svd'::text, 'cs'::text, 'vacuum'::text, 'forceps'::text, 'breech'::text])));
ALTER TABLE public."handover_notes" ADD CONSTRAINT "handover_notes_shift_type_check" CHECK ((shift_type = ANY (ARRAY['morning'::text, 'afternoon'::text, 'night'::text])));
ALTER TABLE public."nursing_assessments" ADD CONSTRAINT "nursing_assessments_assessment_type_check" CHECK ((assessment_type = ANY (ARRAY['glasgow_coma'::text, 'braden_pressure'::text, 'fall_risk'::text, 'pain'::text, 'nutritional'::text, 'skin_integrity'::text, 'mental_status'::text, 'functional'::text, 'wound'::text])));
ALTER TABLE public."nhia_tariff_catalog" ADD CONSTRAINT "nhia_tariff_catalog_facility_level_check" CHECK ((facility_level = ANY (ARRAY['clinic'::text, 'health_center'::text, 'district'::text, 'regional'::text, 'teaching'::text])));
ALTER TABLE public."fluid_balance_charts" ADD CONSTRAINT "fluid_balance_charts_route_check" CHECK ((route = ANY (ARRAY['oral'::text, 'iv'::text, 'ng_tube'::text, 'urine'::text, 'drain'::text, 'vomit'::text, 'stool'::text, 'blood_loss'::text, 'insensible'::text, 'other'::text])));
ALTER TABLE public."fee_schedules" ADD CONSTRAINT "fee_schedules_payer_type_check" CHECK ((payer_type = ANY (ARRAY['cash'::text, 'nhis'::text, 'private_insurance'::text, 'corporate'::text])));
ALTER TABLE public."fluid_balance_charts" ADD CONSTRAINT "fluid_balance_charts_entry_type_check" CHECK ((entry_type = ANY (ARRAY['intake'::text, 'output'::text])));
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_billing_status_check" CHECK ((billing_status = ANY (ARRAY['unbilled'::text, 'billed'::text, 'paid'::text, 'waived'::text, 'written_off'::text])));
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_pain_level_after_check" CHECK (((pain_level_after >= 0) AND (pain_level_after <= 10)));
ALTER TABLE public."maternity_deliveries" ADD CONSTRAINT "maternity_deliveries_delivery_mode_check" CHECK ((delivery_mode = ANY (ARRAY['svd'::text, 'cs'::text, 'assisted'::text, 'breech'::text])));
ALTER TABLE public."nhia_tariff_catalog" ADD CONSTRAINT "nhia_tariff_catalog_category_check" CHECK ((category = ANY (ARRAY['consultation'::text, 'investigation'::text, 'procedure'::text, 'surgery'::text, 'medicine'::text, 'consumable'::text, 'bed_day'::text, 'anesthesia'::text, 'physiotherapy'::text, 'dental'::text, 'optical'::text])));
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_baby_sex_check" CHECK ((baby_sex = ANY (ARRAY['male'::text, 'female'::text, 'indeterminate'::text])));
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_apgar_1min_check" CHECK (((apgar_1min >= 0) AND (apgar_1min <= 10)));
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_apgar_5min_check" CHECK (((apgar_5min >= 0) AND (apgar_5min <= 10)));
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_apgar_10min_check" CHECK (((apgar_10min >= 0) AND (apgar_10min <= 10)));
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_tears_check" CHECK ((tears = ANY (ARRAY['none'::text, 'first_degree'::text, 'second_degree'::text, 'third_degree'::text, 'fourth_degree'::text])));
ALTER TABLE public."nhia_submissions" ADD CONSTRAINT "nhia_submissions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'acknowledged'::text, 'accepted'::text, 'rejected'::text, 'error'::text])));
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_pain_level_before_check" CHECK (((pain_level_before >= 0) AND (pain_level_before <= 10)));
ALTER TABLE public."claim_batches" ADD CONSTRAINT "claim_batches_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'scrubbed'::text, 'submitted'::text, 'acknowledged'::text, 'processing'::text, 'partially_paid'::text, 'paid'::text, 'rejected'::text])));
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'given'::text, 'held'::text, 'refused'::text, 'omitted'::text, 'self_administered'::text])));
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_route_check" CHECK ((route = ANY (ARRAY['oral'::text, 'iv'::text, 'im'::text, 'sc'::text, 'topical'::text, 'inhaled'::text, 'rectal'::text, 'sublingual'::text, 'transdermal'::text, 'ophthalmic'::text, 'otic'::text, 'nasal'::text])));
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_outcome_check" CHECK ((outcome = ANY (ARRAY['live_birth'::text, 'stillbirth'::text, 'neonatal_death'::text, 'twins'::text, 'triplets'::text])));
ALTER TABLE public."triage_assessments" ADD CONSTRAINT "triage_assessments_triage_level_check" CHECK ((triage_level = ANY (ARRAY['red'::text, 'yellow'::text, 'green'::text, 'blue'::text, 'black'::text])));
ALTER TABLE public."platform_onboarding_drafts" ADD CONSTRAINT "platform_onboarding_drafts_step_check" CHECK (((step >= 0) AND (step <= 7)));
ALTER TABLE public."platform_onboarding_drafts" ADD CONSTRAINT "platform_onboarding_drafts_requirements_check" CHECK ((jsonb_typeof(requirements) = 'object'::text));
ALTER TABLE public."claim_items" ADD CONSTRAINT "claim_items_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'partially_approved'::text, 'rejected'::text])));
ALTER TABLE public."allergies" ADD CONSTRAINT "allergies_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'resolved'::text, 'refuted'::text])));
ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])));
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_priority_check" CHECK ((priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'stat'::text, 'emergency'::text])));
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'ordered'::text, 'in_progress'::text, 'collected'::text, 'processing'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public."claims" ADD CONSTRAINT "claims_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'paid'::text])));
ALTER TABLE public."nhia_submissions" ADD CONSTRAINT "nhia_submissions_submission_type_check" CHECK ((submission_type = ANY (ARRAY['initial'::text, 'resubmission'::text, 'appeal'::text, 'query_response'::text])));
ALTER TABLE public."nhia_submissions" ADD CONSTRAINT "nhia_submissions_submission_method_check" CHECK ((submission_method = ANY (ARRAY['api'::text, 'portal'::text, 'manual'::text])));
ALTER TABLE public."payment_allocations" ADD CONSTRAINT "payment_allocations_allocation_type_check" CHECK ((allocation_type = ANY (ARRAY['patient'::text, 'insurance'::text, 'nhis'::text, 'corporate'::text, 'write_off'::text])));
ALTER TABLE public."allergies" ADD CONSTRAINT "allergies_severity_check" CHECK ((severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text, 'life_threatening'::text])));
ALTER TABLE public."patients" ADD CONSTRAINT "patients_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])));
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_result_flag_check" CHECK (((result_flag IS NULL) OR (result_flag = ANY (ARRAY['normal'::text, 'low'::text, 'high'::text, 'critical_low'::text, 'critical_high'::text, 'abnormal'::text]))));
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_modality_check" CHECK ((modality = ANY (ARRAY['xray'::text, 'ct'::text, 'mri'::text, 'ultrasound'::text, 'fluoroscopy'::text, 'mammography'::text, 'dexa'::text])));
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_laterality_check" CHECK ((laterality = ANY (ARRAY['left'::text, 'right'::text, 'bilateral'::text, 'not_applicable'::text])));
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_priority_check" CHECK ((priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'stat'::text])));
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_status_check" CHECK ((status = ANY (ARRAY['ordered'::text, 'scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public."allergies" ADD CONSTRAINT "allergies_allergen_type_check" CHECK ((allergen_type = ANY (ARRAY['drug'::text, 'food'::text, 'environment'::text, 'biological'::text, 'other'::text])));
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_insurance_type_check" CHECK ((insurance_type = ANY (ARRAY['cash'::text, 'nhis'::text, 'private_insurance'::text, 'corporate'::text, 'other'::text])));
ALTER TABLE public."radiology_results" ADD CONSTRAINT "radiology_results_report_status_check" CHECK ((report_status = ANY (ARRAY['preliminary'::text, 'final'::text, 'addendum'::text, 'corrected'::text])));
ALTER TABLE public."problem_list" ADD CONSTRAINT "problem_list_severity_check" CHECK ((severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text, 'critical'::text])));
ALTER TABLE public."nhis_cc_codes" ADD CONSTRAINT "nhis_cc_codes_verification_method_check" CHECK ((verification_method = ANY (ARRAY['manual'::text, 'healthflow'::text, 'api'::text, 'card_swipe'::text])));
ALTER TABLE public."carelink_instance" ADD CONSTRAINT "carelink_instance_singleton_check" CHECK (singleton);
ALTER TABLE public."carelink_instance" ADD CONSTRAINT "carelink_instance_instance_kind_check" CHECK ((instance_kind = ANY (ARRAY['platform'::text, 'tenant'::text])));
ALTER TABLE public."inventory_transactions" ADD CONSTRAINT "inventory_transactions_transaction_type_check" CHECK ((transaction_type = ANY (ARRAY['restock'::text, 'issue'::text, 'return'::text, 'wastage'::text, 'adjustment'::text])));
ALTER TABLE public."inventory_items" ADD CONSTRAINT "inventory_items_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'discontinued'::text])));
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_surgery_type_check" CHECK ((surgery_type = ANY (ARRAY['elective'::text, 'emergency'::text, 'day_case'::text])));
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_asa_class_check" CHECK ((asa_class = ANY (ARRAY['I'::text, 'II'::text, 'III'::text, 'IV'::text, 'V'::text, 'VI'::text])));
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_anesthesia_type_check" CHECK ((anesthesia_type = ANY (ARRAY['general'::text, 'spinal'::text, 'epidural'::text, 'local'::text, 'regional'::text, 'sedation'::text, 'none'::text])));
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_npo_status_check" CHECK ((npo_status = ANY (ARRAY['compliant'::text, 'non_compliant'::text, 'not_required'::text])));
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_status_check" CHECK ((status = ANY (ARRAY['booked'::text, 'confirmed'::text, 'in_prep'::text, 'in_progress'::text, 'in_recovery'::text, 'completed'::text, 'cancelled'::text, 'postponed'::text])));
ALTER TABLE public."problem_list" ADD CONSTRAINT "problem_list_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'resolved'::text, 'inactive'::text, 'recurrence'::text])));
ALTER TABLE public."theatre_post_op" ADD CONSTRAINT "theatre_post_op_pain_score_check" CHECK (((pain_score >= 0) AND (pain_score <= 10)));
ALTER TABLE public."platform_members" ADD CONSTRAINT "platform_members_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])));
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_status_check" CHECK ((status = ANY (ARRAY['admitted'::text, 'discharged'::text, 'transferred'::text])));
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_discharge_type_check" CHECK ((discharge_type = ANY (ARRAY['cured'::text, 'transferred'::text, 'deceased'::text, 'lama'::text, 'absconded'::text])));
ALTER TABLE public."platform_launch_evidence" ADD CONSTRAINT "platform_launch_evidence_kind_check" CHECK ((kind = ANY (ARRAY['deployment'::text, 'isolation'::text, 'admin_acceptance'::text, 'account_protection'::text, 'backup_restore'::text, 'clinical'::text, 'training'::text, 'support'::text])));
ALTER TABLE public."platform_tenants" ADD CONSTRAINT "platform_tenants_lifecycle_state_check" CHECK ((lifecycle_state = ANY (ARRAY['onboarding'::text, 'active'::text, 'suspended'::text, 'archived'::text])));
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_admission_type_check" CHECK ((admission_type = ANY (ARRAY['emergency'::text, 'planned'::text, 'transfer'::text])));
ALTER TABLE public."surgical_procedures" ADD CONSTRAINT "surgical_procedures_laterality_check" CHECK ((laterality = ANY (ARRAY['left'::text, 'right'::text, 'bilateral'::text, 'not_applicable'::text])));
ALTER TABLE public."surgical_procedures" ADD CONSTRAINT "surgical_procedures_post_op_destination_check" CHECK ((post_op_destination = ANY (ARRAY['ward'::text, 'icu'::text, 'hdu'::text, 'day_ward'::text, 'home'::text])));
ALTER TABLE public."surgical_procedures" ADD CONSTRAINT "surgical_procedures_wound_classification_check" CHECK ((wound_classification = ANY (ARRAY['clean'::text, 'clean_contaminated'::text, 'contaminated'::text, 'dirty'::text])));
ALTER TABLE public."clinical_orders" ADD CONSTRAINT "clinical_orders_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'ordered'::text, 'accepted'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'rejected'::text])));
ALTER TABLE public."discharge_summaries" ADD CONSTRAINT "discharge_summaries_discharge_condition_check" CHECK ((discharge_condition = ANY (ARRAY['improved'::text, 'unchanged'::text, 'deteriorated'::text, 'cured'::text])));
ALTER TABLE public."discharge_summaries" ADD CONSTRAINT "discharge_summaries_discharge_type_check" CHECK ((discharge_type = ANY (ARRAY['regular'::text, 'against_advice'::text, 'transfer'::text, 'deceased'::text])));
ALTER TABLE public."clinical_orders" ADD CONSTRAINT "clinical_orders_priority_check" CHECK ((priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'stat'::text, 'asap'::text])));
ALTER TABLE public."platform_plans" ADD CONSTRAINT "platform_plans_name_check" CHECK ((length(TRIM(BOTH FROM name)) > 0));
ALTER TABLE public."platform_plans" ADD CONSTRAINT "platform_plans_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public."platform_plans" ADD CONSTRAINT "platform_plans_monthly_price_check" CHECK ((monthly_price >= (0)::numeric));
ALTER TABLE public."platform_plans" ADD CONSTRAINT "platform_plans_annual_price_check" CHECK ((annual_price >= (0)::numeric));
ALTER TABLE public."platform_tenants" ADD CONSTRAINT "platform_tenants_status_check" CHECK ((status = ANY (ARRAY['lead'::text, 'intake'::text, 'provisioning'::text, 'training'::text, 'ready_for_go_live'::text, 'live'::text, 'paused'::text])));
ALTER TABLE public."beds" ADD CONSTRAINT "beds_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'occupied'::text, 'reserved'::text, 'under_maintenance'::text, 'cleaning'::text])));
ALTER TABLE public."platform_launch_evidence" ADD CONSTRAINT "platform_launch_evidence_reference_check" CHECK (((length(TRIM(BOTH FROM reference)) >= 5) AND (length(TRIM(BOTH FROM reference)) <= 2000)));
ALTER TABLE public."platform_onboarding_tasks" ADD CONSTRAINT "platform_onboarding_tasks_phase_check" CHECK ((phase = ANY (ARRAY['intake'::text, 'technical'::text, 'database'::text, 'accounts'::text, 'branding'::text, 'go_live'::text, 'security'::text, 'handover'::text])));
ALTER TABLE public."platform_onboarding_tasks" ADD CONSTRAINT "platform_onboarding_tasks_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'blocked'::text])));
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_rhesus_check" CHECK ((rhesus = ANY (ARRAY['positive'::text, 'negative'::text, 'unknown'::text])));
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_hiv_status_check" CHECK ((hiv_status = ANY (ARRAY['positive'::text, 'negative'::text, 'unknown'::text, 'declined'::text])));
ALTER TABLE public."beds" ADD CONSTRAINT "beds_bed_type_check" CHECK ((bed_type = ANY (ARRAY['standard'::text, 'icu'::text, 'isolation'::text, 'private'::text])));
ALTER TABLE public."claims" ADD CONSTRAINT "claims_insurance_type_check" CHECK ((insurance_type = ANY (ARRAY['nhis'::text, 'private'::text])));
ALTER TABLE public."payments" ADD CONSTRAINT "payments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_hepatitis_b_check" CHECK ((hepatitis_b = ANY (ARRAY['positive'::text, 'negative'::text, 'unknown'::text])));
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_sickling_status_check" CHECK ((sickling_status = ANY (ARRAY['positive'::text, 'negative'::text, 'trait'::text, 'unknown'::text])));
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_risk_level_check" CHECK ((risk_level = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text])));
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'delivered'::text, 'referred'::text, 'lost_to_followup'::text, 'miscarriage'::text])));
ALTER TABLE public."clinical_orders" ADD CONSTRAINT "clinical_orders_order_type_check" CHECK ((order_type = ANY (ARRAY['lab'::text, 'radiology'::text, 'procedure'::text, 'referral'::text, 'medication'::text, 'diet'::text, 'nursing'::text])));
ALTER TABLE public."wards" ADD CONSTRAINT "wards_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'maintenance'::text])));
ALTER TABLE public."platform_members" ADD CONSTRAINT "platform_members_role_check" CHECK ((role = ANY (ARRAY['platform_admin'::text, 'finance_manager'::text, 'support_officer'::text, 'technical_admin'::text])));
ALTER TABLE public."platform_plans" ADD CONSTRAINT "platform_plans_trial_days_check" CHECK (((trial_days >= 0) AND (trial_days <= 365)));
ALTER TABLE public."hospital_departments" ADD CONSTRAINT "hospital_departments_department_type_check" CHECK ((department_type = ANY (ARRAY['clinical'::text, 'diagnostic'::text, 'administrative'::text, 'support'::text])));
ALTER TABLE public."clinical_notes" ADD CONSTRAINT "clinical_notes_note_type_check" CHECK ((note_type = ANY (ARRAY['soap'::text, 'progress'::text, 'procedure'::text, 'consultation'::text, 'discharge_summary'::text, 'operative'::text, 'nursing'::text])));
ALTER TABLE public."vitals" ADD CONSTRAINT "vitals_gcs_score_check" CHECK (((gcs_score >= 3) AND (gcs_score <= 15)));
ALTER TABLE public."platform_plans" ADD CONSTRAINT "platform_plans_grace_days_check" CHECK (((grace_days >= 0) AND (grace_days <= 90)));
ALTER TABLE public."hr_payroll" ADD CONSTRAINT "hr_payroll_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'processed'::text, 'cancelled'::text])));
ALTER TABLE public."user_sessions" ADD CONSTRAINT "user_sessions_device_type_check" CHECK ((device_type = ANY (ARRAY['desktop'::text, 'mobile'::text, 'tablet'::text, 'other'::text])));
ALTER TABLE public."vitals" ADD CONSTRAINT "vitals_pain_scale_check" CHECK (((pain_scale >= 0) AND (pain_scale <= 10)));
ALTER TABLE public."virtual_consultations" ADD CONSTRAINT "virtual_consultations_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'waiting'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])));
ALTER TABLE public."platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text])));
ALTER TABLE public."consent_records" ADD CONSTRAINT "consent_records_consent_type_check" CHECK ((consent_type = ANY (ARRAY['treatment'::text, 'surgery'::text, 'anesthesia'::text, 'blood_transfusion'::text, 'photography'::text, 'research'::text, 'data_sharing'::text, 'telemedicine'::text])));
ALTER TABLE public."diagnoses" ADD CONSTRAINT "diagnoses_certainty_check" CHECK ((certainty = ANY (ARRAY['confirmed'::text, 'provisional'::text, 'differential'::text, 'rule_out'::text])));
ALTER TABLE public."platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_status_check" CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'cancelled'::text])));
ALTER TABLE public."platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_amount_check" CHECK ((amount >= (0)::numeric));
ALTER TABLE public."platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_check" CHECK ((period_end > period_start));
ALTER TABLE public."queue_management" ADD CONSTRAINT "queue_management_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'called'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])));
ALTER TABLE public."diagnoses" ADD CONSTRAINT "diagnoses_severity_check" CHECK ((severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text, 'critical'::text])));
ALTER TABLE public."queue_management" ADD CONSTRAINT "queue_management_priority_check" CHECK ((priority = ANY (ARRAY['normal'::text, 'urgent'::text, 'emergency'::text])));
ALTER TABLE public."theatre_sessions" ADD CONSTRAINT "theatre_sessions_surgery_type_check" CHECK ((surgery_type = ANY (ARRAY['elective'::text, 'emergency'::text, 'urgent'::text])));
ALTER TABLE public."platform_tenant_costs" ADD CONSTRAINT "platform_tenant_costs_provider_check" CHECK ((provider = ANY (ARRAY['supabase'::text, 'vercel'::text, 'other'::text])));
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_amount_check" CHECK ((amount >= (0)::numeric));
ALTER TABLE public."platform_onboarding_drafts" ADD CONSTRAINT "platform_onboarding_drafts_revision_check" CHECK ((revision > 0));
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_check" CHECK (((paid_amount >= (0)::numeric) AND (paid_amount <= amount)));
ALTER TABLE public."fhir_resource_log" ADD CONSTRAINT "fhir_resource_log_operation_check" CHECK ((operation = ANY (ARRAY['create'::text, 'read'::text, 'update'::text, 'delete'::text, 'search'::text])));
ALTER TABLE public."fhir_resource_log" ADD CONSTRAINT "fhir_resource_log_status_check" CHECK ((status = ANY (ARRAY['success'::text, 'error'::text, 'pending'::text])));
ALTER TABLE public."diagnoses" ADD CONSTRAINT "diagnoses_diagnosis_type_check" CHECK ((diagnosis_type = ANY (ARRAY['primary'::text, 'secondary'::text, 'differential'::text, 'rule_out'::text])));
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_status_check" CHECK ((status = ANY (ARRAY['issued'::text, 'paid'::text, 'void'::text])));
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_check1" CHECK ((period_end > period_start));
ALTER TABLE public."fhir_endpoint_config" ADD CONSTRAINT "fhir_endpoint_config_auth_type_check" CHECK ((auth_type = ANY (ARRAY['bearer'::text, 'basic'::text, 'oauth2'::text, 'none'::text])));
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_discharge_disposition_check" CHECK ((discharge_disposition = ANY (ARRAY['home'::text, 'admitted'::text, 'transferred'::text, 'deceased'::text, 'left_ama'::text, 'referred'::text])));
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_priority_check" CHECK ((priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'emergency'::text])));
ALTER TABLE public."queue_management" ADD CONSTRAINT "queue_management_department_check" CHECK ((department = ANY (ARRAY['opd'::text, 'emergency'::text, 'pharmacy'::text, 'laboratory'::text, 'radiology'::text, 'billing'::text, 'records'::text])));
ALTER TABLE public."dhims2_indicator_mappings" ADD CONSTRAINT "dhims2_indicator_mappings_period_type_check" CHECK ((period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])));
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_status_check" CHECK ((status = ANY (ARRAY['registered'::text, 'triaged'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));
ALTER TABLE public."dhims2_reports" ADD CONSTRAINT "dhims2_reports_period_type_check" CHECK ((period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])));
ALTER TABLE public."dhims2_reports" ADD CONSTRAINT "dhims2_reports_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'accepted'::text, 'rejected'::text])));
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_encounter_type_check" CHECK ((encounter_type = ANY (ARRAY['outpatient'::text, 'inpatient'::text, 'emergency'::text, 'telemedicine'::text, 'home_visit'::text])));
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_status_check" CHECK ((status = ANY (ARRAY['unread'::text, 'read'::text, 'archived'::text])));
ALTER TABLE public."platform_launch_approvals" ADD CONSTRAINT "platform_launch_approvals_reason_check" CHECK ((length(TRIM(BOTH FROM reason)) >= 5));
ALTER TABLE public."integration_endpoints" ADD CONSTRAINT "integration_endpoints_endpoint_type_check" CHECK ((endpoint_type = ANY (ARRAY['fhir'::text, 'dhims2'::text, 'nhia'::text, 'lab_lis'::text, 'radiology_ris'::text, 'pharmacy'::text, 'sms'::text, 'email'::text, 'webhook'::text])));
ALTER TABLE public."integration_endpoints" ADD CONSTRAINT "integration_endpoints_auth_type_check" CHECK ((auth_type = ANY (ARRAY['bearer'::text, 'basic'::text, 'api_key'::text, 'oauth2'::text, 'none'::text])));
ALTER TABLE public."integration_endpoints" ADD CONSTRAINT "integration_endpoints_last_test_status_check" CHECK ((last_test_status = ANY (ARRAY['ok'::text, 'error'::text, 'timeout'::text])));
ALTER TABLE public."ambulance_dispatches" ADD CONSTRAINT "ambulance_dispatches_status_check" CHECK ((status = ANY (ARRAY['en_route'::text, 'on_scene'::text, 'returning'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public."payments" ADD CONSTRAINT "payments_momo_provider_check" CHECK ((momo_provider = ANY (ARRAY['mtn'::text, 'telecel'::text, 'airteltigo'::text])));
ALTER TABLE public."report_templates" ADD CONSTRAINT "report_templates_category_check" CHECK ((category = ANY (ARRAY['clinical'::text, 'financial'::text, 'administrative'::text, 'regulatory'::text, 'custom'::text])));
ALTER TABLE public."sync_queue" ADD CONSTRAINT "sync_queue_operation_check" CHECK ((operation = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])));
ALTER TABLE public."ambulance_fleet" ADD CONSTRAINT "ambulance_fleet_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'dispatched'::text, 'maintenance'::text, 'standby'::text])));
ALTER TABLE public."report_templates" ADD CONSTRAINT "report_templates_output_format_check" CHECK ((output_format = ANY (ARRAY['table'::text, 'chart'::text, 'pdf'::text, 'excel'::text, 'csv'::text])));
ALTER TABLE public."hr_leaves" ADD CONSTRAINT "hr_leaves_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
ALTER TABLE public."platform_payments" ADD CONSTRAINT "platform_payments_amount_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."platform_payments" ADD CONSTRAINT "platform_payments_provider_check" CHECK ((provider = ANY (ARRAY['manual'::text, 'paystack'::text, 'flutterwave'::text])));
ALTER TABLE public."report_runs" ADD CONSTRAINT "report_runs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public."purchase_orders" ADD CONSTRAINT "purchase_orders_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'ordered'::text, 'partially_received'::text, 'received'::text, 'cancelled'::text])));
ALTER TABLE public."platform_payments" ADD CONSTRAINT "platform_payments_reference_check" CHECK ((length(TRIM(BOTH FROM reference)) > 0));
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_channel_check" CHECK ((channel = ANY (ARRAY['in_app'::text, 'sms'::text, 'email'::text])));
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ((type = ANY (ARRAY['appointment_reminder'::text, 'lab_result'::text, 'prescription_ready'::text, 'low_stock_alert'::text, 'pending_claim'::text, 'urgent_referral'::text, 'shift_handover'::text, 'new_prescription'::text])));
ALTER TABLE public."ai_suggestions" ADD CONSTRAINT "ai_suggestions_suggestion_type_check" CHECK ((suggestion_type = ANY (ARRAY['diagnosis'::text, 'medication'::text, 'lab_order'::text, 'referral'::text, 'alert'::text, 'drug_interaction'::text])));
ALTER TABLE public."ai_suggestions" ADD CONSTRAINT "ai_suggestions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'ignored'::text])));
ALTER TABLE public."hr_attendance" ADD CONSTRAINT "hr_attendance_status_check" CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'off'::text])));
ALTER TABLE public."payments" ADD CONSTRAINT "payments_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cash'::text, 'momo'::text, 'insurance'::text, 'card'::text, 'nhis'::text, 'private'::text])));
ALTER TABLE public."platform_tenant_costs" ADD CONSTRAINT "platform_tenant_costs_amount_check" CHECK ((amount >= (0)::numeric));
ALTER TABLE public."platform_tenant_costs" ADD CONSTRAINT "platform_tenant_costs_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public."sync_queue" ADD CONSTRAINT "sync_queue_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'syncing'::text, 'synced'::text, 'conflict'::text, 'failed'::text])));
ALTER TABLE public."platform_tenant_costs" ADD CONSTRAINT "platform_tenant_costs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id) ON DELETE CASCADE;
ALTER TABLE public."hr_payroll" ADD CONSTRAINT "hr_payroll_processed_by_fkey" FOREIGN KEY (processed_by) REFERENCES auth.users(id);
ALTER TABLE public."nhia_submissions" ADD CONSTRAINT "nhia_submissions_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES claim_batches(id) ON DELETE CASCADE;
ALTER TABLE public."diagnoses" ADD CONSTRAINT "diagnoses_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."diagnoses" ADD CONSTRAINT "diagnoses_diagnosed_by_fkey" FOREIGN KEY (diagnosed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."nhia_submissions" ADD CONSTRAINT "nhia_submissions_submitted_by_fkey" FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."nursing_assessments" ADD CONSTRAINT "nursing_assessments_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_sessions" ADD CONSTRAINT "theatre_sessions_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_sessions" ADD CONSTRAINT "theatre_sessions_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE public."theatre_sessions" ADD CONSTRAINT "theatre_sessions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."theatre_pre_op" ADD CONSTRAINT "theatre_pre_op_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_pre_op" ADD CONSTRAINT "theatre_pre_op_session_id_fkey" FOREIGN KEY (session_id) REFERENCES theatre_sessions(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_pre_op" ADD CONSTRAINT "theatre_pre_op_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES auth.users(id);
ALTER TABLE public."theatre_operation_notes" ADD CONSTRAINT "theatre_operation_notes_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_operation_notes" ADD CONSTRAINT "theatre_operation_notes_session_id_fkey" FOREIGN KEY (session_id) REFERENCES theatre_sessions(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_operation_notes" ADD CONSTRAINT "theatre_operation_notes_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES auth.users(id);
ALTER TABLE public."theatre_post_op" ADD CONSTRAINT "theatre_post_op_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_post_op" ADD CONSTRAINT "theatre_post_op_session_id_fkey" FOREIGN KEY (session_id) REFERENCES theatre_sessions(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_post_op" ADD CONSTRAINT "theatre_post_op_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES auth.users(id);
ALTER TABLE public."anc_visits" ADD CONSTRAINT "anc_visits_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."anc_visits" ADD CONSTRAINT "anc_visits_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE public."anc_visits" ADD CONSTRAINT "anc_visits_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES auth.users(id);
ALTER TABLE public."nursing_assessments" ADD CONSTRAINT "nursing_assessments_assessed_by_fkey" FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."handover_notes" ADD CONSTRAINT "handover_notes_ward_id_fkey" FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE;
ALTER TABLE public."handover_notes" ADD CONSTRAINT "handover_notes_outgoing_nurse_id_fkey" FOREIGN KEY (outgoing_nurse_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."handover_notes" ADD CONSTRAINT "handover_notes_incoming_nurse_id_fkey" FOREIGN KEY (incoming_nurse_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;
ALTER TABLE public."prescription_items" ADD CONSTRAINT "prescription_items_drug_id_fkey" FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE RESTRICT;
ALTER TABLE public."payments" ADD CONSTRAINT "payments_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."payments" ADD CONSTRAINT "payments_prescription_id_fkey" FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;
ALTER TABLE public."handover_notes" ADD CONSTRAINT "handover_notes_acknowledged_by_fkey" FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."claims" ADD CONSTRAINT "claims_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."claims" ADD CONSTRAINT "claims_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE public."claims" ADD CONSTRAINT "claims_prescription_id_fkey" FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."virtual_consultations" ADD CONSTRAINT "virtual_consultations_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."virtual_consultations" ADD CONSTRAINT "virtual_consultations_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."virtual_consultations" ADD CONSTRAINT "virtual_consultations_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_referring_doctor_id_fkey" FOREIGN KEY (referring_doctor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_referred_to_doctor_id_fkey" FOREIGN KEY (referred_to_doctor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."patient_vitals" ADD CONSTRAINT "patient_vitals_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."patient_vitals" ADD CONSTRAINT "patient_vitals_nurse_id_fkey" FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."nurse_notes" ADD CONSTRAINT "nurse_notes_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."nurse_notes" ADD CONSTRAINT "nurse_notes_nurse_id_fkey" FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_officer_id_fkey" FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_archived_by_fkey" FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_restored_by_fkey" FOREIGN KEY (restored_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."record_requests" ADD CONSTRAINT "record_requests_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."record_requests" ADD CONSTRAINT "record_requests_processed_by_fkey" FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_ordered_by_fkey" FOREIGN KEY (ordered_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."hospitals" ADD CONSTRAINT "hospitals_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."virtual_consultations" ADD CONSTRAINT "virtual_consultations_prescription_id_fkey" FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_collected_by_fkey" FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."hospital_onboarding_tasks" ADD CONSTRAINT "hospital_onboarding_tasks_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."hospital_onboarding_tasks" ADD CONSTRAINT "hospital_onboarding_tasks_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."surgical_procedures" ADD CONSTRAINT "surgical_procedures_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES theatre_bookings(id) ON DELETE CASCADE;
ALTER TABLE public."surgical_procedures" ADD CONSTRAINT "surgical_procedures_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE public."queue_management" ADD CONSTRAINT "queue_management_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."queue_management" ADD CONSTRAINT "queue_management_served_by_fkey" FOREIGN KEY (served_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."wards" ADD CONSTRAINT "wards_nurse_in_charge_fkey" FOREIGN KEY (nurse_in_charge) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."beds" ADD CONSTRAINT "beds_ward_id_fkey" FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE;
ALTER TABLE public."beds" ADD CONSTRAINT "beds_current_patient_id_fkey" FOREIGN KEY (current_patient_id) REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE public."hr_payroll" ADD CONSTRAINT "hr_payroll_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_bed_id_fkey" FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE SET NULL;
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_ward_id_fkey" FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE;
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_admitted_by_fkey" FOREIGN KEY (admitted_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_discharged_by_fkey" FOREIGN KEY (discharged_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE CASCADE;
ALTER TABLE public."inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;
ALTER TABLE public."inventory_transactions" ADD CONSTRAINT "inventory_transactions_issued_to_user_fkey" FOREIGN KEY (issued_to_user) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."inventory_transactions" ADD CONSTRAINT "inventory_transactions_issued_by_fkey" FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."triage_assessments" ADD CONSTRAINT "triage_assessments_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."triage_assessments" ADD CONSTRAINT "triage_assessments_assessed_by_fkey" FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."triage_assessments" ADD CONSTRAINT "triage_assessments_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."staff_schedules" ADD CONSTRAINT "staff_schedules_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."blood_inventory" ADD CONSTRAINT "blood_inventory_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."blood_donations" ADD CONSTRAINT "blood_donations_received_by_fkey" FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."hr_payroll" ADD CONSTRAINT "hr_payroll_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES hr_staff(id) ON DELETE CASCADE;
ALTER TABLE public."blood_requests" ADD CONSTRAINT "blood_requests_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."blood_requests" ADD CONSTRAINT "blood_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."blood_requests" ADD CONSTRAINT "blood_requests_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."maternity_deliveries" ADD CONSTRAINT "maternity_deliveries_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
ALTER TABLE public."purchase_order_items" ADD CONSTRAINT "purchase_order_items_drug_id_fkey" FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE RESTRICT;
ALTER TABLE public."patient_transfers" ADD CONSTRAINT "patient_transfers_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."maternity_deliveries" ADD CONSTRAINT "maternity_deliveries_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE public."maternity_deliveries" ADD CONSTRAINT "maternity_deliveries_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES auth.users(id);
ALTER TABLE public."postnatal_visits" ADD CONSTRAINT "postnatal_visits_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."postnatal_visits" ADD CONSTRAINT "postnatal_visits_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE public."postnatal_visits" ADD CONSTRAINT "postnatal_visits_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES auth.users(id);
ALTER TABLE public."hr_payroll" ADD CONSTRAINT "hr_payroll_generated_by_fkey" FOREIGN KEY (generated_by) REFERENCES auth.users(id);
ALTER TABLE public."diet_orders" ADD CONSTRAINT "diet_orders_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."diet_orders" ADD CONSTRAINT "diet_orders_admission_id_fkey" FOREIGN KEY (admission_id) REFERENCES admissions(id);
ALTER TABLE public."diet_orders" ADD CONSTRAINT "diet_orders_ordered_by_fkey" FOREIGN KEY (ordered_by) REFERENCES auth.users(id);
ALTER TABLE public."notification_settings" ADD CONSTRAINT "notification_settings_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."notification_settings" ADD CONSTRAINT "notification_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."notification_templates" ADD CONSTRAINT "notification_templates_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."notification_templates" ADD CONSTRAINT "notification_templates_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."notification_logs" ADD CONSTRAINT "notification_logs_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."notification_logs" ADD CONSTRAINT "notification_logs_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE public."notification_logs" ADD CONSTRAINT "notification_logs_sent_by_fkey" FOREIGN KEY (sent_by) REFERENCES auth.users(id);
ALTER TABLE public."hr_staff" ADD CONSTRAINT "hr_staff_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."hr_staff" ADD CONSTRAINT "hr_staff_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE public."hr_attendance" ADD CONSTRAINT "hr_attendance_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."hr_attendance" ADD CONSTRAINT "hr_attendance_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES hr_staff(id) ON DELETE CASCADE;
ALTER TABLE public."hr_attendance" ADD CONSTRAINT "hr_attendance_marked_by_fkey" FOREIGN KEY (marked_by) REFERENCES auth.users(id);
ALTER TABLE public."hr_leaves" ADD CONSTRAINT "hr_leaves_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."hr_leaves" ADD CONSTRAINT "hr_leaves_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES hr_staff(id) ON DELETE CASCADE;
ALTER TABLE public."hr_leaves" ADD CONSTRAINT "hr_leaves_applied_by_fkey" FOREIGN KEY (applied_by) REFERENCES auth.users(id);
ALTER TABLE public."ambulance_fleet" ADD CONSTRAINT "ambulance_fleet_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."ambulance_fleet" ADD CONSTRAINT "ambulance_fleet_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."ambulance_dispatches" ADD CONSTRAINT "ambulance_dispatches_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."ambulance_dispatches" ADD CONSTRAINT "ambulance_dispatches_ambulance_id_fkey" FOREIGN KEY (ambulance_id) REFERENCES ambulance_fleet(id);
ALTER TABLE public."ambulance_dispatches" ADD CONSTRAINT "ambulance_dispatches_dispatched_by_fkey" FOREIGN KEY (dispatched_by) REFERENCES auth.users(id);
ALTER TABLE public."roles" ADD CONSTRAINT "roles_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE public."encounters" ADD CONSTRAINT "encounters_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."diagnoses" ADD CONSTRAINT "diagnoses_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."vitals" ADD CONSTRAINT "vitals_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."vitals" ADD CONSTRAINT "vitals_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."vitals" ADD CONSTRAINT "vitals_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."clinical_notes" ADD CONSTRAINT "clinical_notes_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."clinical_notes" ADD CONSTRAINT "clinical_notes_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."clinical_notes" ADD CONSTRAINT "clinical_notes_author_id_fkey" FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."clinical_notes" ADD CONSTRAINT "clinical_notes_parent_note_id_fkey" FOREIGN KEY (parent_note_id) REFERENCES clinical_notes(id) ON DELETE SET NULL;
ALTER TABLE public."clinical_notes" ADD CONSTRAINT "clinical_notes_signed_by_fkey" FOREIGN KEY (signed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."clinical_orders" ADD CONSTRAINT "clinical_orders_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."clinical_orders" ADD CONSTRAINT "clinical_orders_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."clinical_orders" ADD CONSTRAINT "clinical_orders_ordered_by_fkey" FOREIGN KEY (ordered_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."clinical_orders" ADD CONSTRAINT "clinical_orders_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."problem_list" ADD CONSTRAINT "problem_list_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."problem_list" ADD CONSTRAINT "problem_list_diagnosis_id_fkey" FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id) ON DELETE SET NULL;
ALTER TABLE public."problem_list" ADD CONSTRAINT "problem_list_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE public."allergies" ADD CONSTRAINT "allergies_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."allergies" ADD CONSTRAINT "allergies_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_admission_id_fkey" FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE;
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_prescription_item_id_fkey" FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id) ON DELETE SET NULL;
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_drug_id_fkey" FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE SET NULL;
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_administered_by_fkey" FOREIGN KEY (administered_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."medication_administration_records" ADD CONSTRAINT "medication_administration_records_witnessed_by_fkey" FOREIGN KEY (witnessed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."fluid_balance_charts" ADD CONSTRAINT "fluid_balance_charts_admission_id_fkey" FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE;
ALTER TABLE public."fluid_balance_charts" ADD CONSTRAINT "fluid_balance_charts_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."fluid_balance_charts" ADD CONSTRAINT "fluid_balance_charts_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."nursing_assessments" ADD CONSTRAINT "nursing_assessments_admission_id_fkey" FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE;
ALTER TABLE public."nursing_assessments" ADD CONSTRAINT "nursing_assessments_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."nursing_care_plans" ADD CONSTRAINT "nursing_care_plans_admission_id_fkey" FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE;
ALTER TABLE public."nursing_care_plans" ADD CONSTRAINT "nursing_care_plans_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."nursing_care_plans" ADD CONSTRAINT "nursing_care_plans_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."nursing_care_plans" ADD CONSTRAINT "nursing_care_plans_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."ward_rounds" ADD CONSTRAINT "ward_rounds_admission_id_fkey" FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE;
ALTER TABLE public."ward_rounds" ADD CONSTRAINT "ward_rounds_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."ward_rounds" ADD CONSTRAINT "ward_rounds_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."ward_rounds" ADD CONSTRAINT "ward_rounds_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."ward_rounds" ADD CONSTRAINT "ward_rounds_ward_id_fkey" FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE SET NULL;
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES clinical_orders(id) ON DELETE SET NULL;
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_prescription_item_id_fkey" FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id) ON DELETE SET NULL;
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_tariff_id_fkey" FOREIGN KEY (tariff_id) REFERENCES nhia_tariff_catalog(id) ON DELETE SET NULL;
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_fee_schedule_id_fkey" FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id) ON DELETE SET NULL;
ALTER TABLE public."billing_items" ADD CONSTRAINT "billing_items_billed_by_fkey" FOREIGN KEY (billed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."claim_batches" ADD CONSTRAINT "claim_batches_scrubbed_by_fkey" FOREIGN KEY (scrubbed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."claim_batches" ADD CONSTRAINT "claim_batches_submitted_by_fkey" FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."claims" ADD CONSTRAINT "claims_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES claim_batches(id) ON DELETE SET NULL;
ALTER TABLE public."claims" ADD CONSTRAINT "claims_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."claim_items" ADD CONSTRAINT "claim_items_claim_id_fkey" FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE;
ALTER TABLE public."claim_items" ADD CONSTRAINT "claim_items_billing_item_id_fkey" FOREIGN KEY (billing_item_id) REFERENCES billing_items(id) ON DELETE SET NULL;
ALTER TABLE public."claim_items" ADD CONSTRAINT "claim_items_tariff_id_fkey" FOREIGN KEY (tariff_id) REFERENCES nhia_tariff_catalog(id) ON DELETE SET NULL;
ALTER TABLE public."claim_items" ADD CONSTRAINT "claim_items_diagnosis_id_fkey" FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id) ON DELETE SET NULL;
ALTER TABLE public."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
ALTER TABLE public."payment_allocations" ADD CONSTRAINT "payment_allocations_billing_item_id_fkey" FOREIGN KEY (billing_item_id) REFERENCES billing_items(id) ON DELETE CASCADE;
ALTER TABLE public."radiology_orders" ADD CONSTRAINT "radiology_orders_order_id_fkey" FOREIGN KEY (order_id) REFERENCES clinical_orders(id) ON DELETE SET NULL;
ALTER TABLE public."radiology_results" ADD CONSTRAINT "radiology_results_radiology_order_id_fkey" FOREIGN KEY (radiology_order_id) REFERENCES radiology_orders(id) ON DELETE CASCADE;
ALTER TABLE public."radiology_results" ADD CONSTRAINT "radiology_results_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."radiology_results" ADD CONSTRAINT "radiology_results_radiologist_id_fkey" FOREIGN KEY (radiologist_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."radiology_results" ADD CONSTRAINT "radiology_results_critical_finding_communicated_to_fkey" FOREIGN KEY (critical_finding_communicated_to) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."radiology_results" ADD CONSTRAINT "radiology_results_signed_by_fkey" FOREIGN KEY (signed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_order_id_fkey" FOREIGN KEY (order_id) REFERENCES clinical_orders(id) ON DELETE SET NULL;
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_lead_surgeon_id_fkey" FOREIGN KEY (lead_surgeon_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_assistant_surgeon_id_fkey" FOREIGN KEY (assistant_surgeon_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_anesthetist_id_fkey" FOREIGN KEY (anesthetist_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."theatre_bookings" ADD CONSTRAINT "theatre_bookings_scrub_nurse_id_fkey" FOREIGN KEY (scrub_nurse_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."discharge_summaries" ADD CONSTRAINT "discharge_summaries_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."discharge_summaries" ADD CONSTRAINT "discharge_summaries_admission_id_fkey" FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE;
ALTER TABLE public."discharge_summaries" ADD CONSTRAINT "discharge_summaries_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."discharge_summaries" ADD CONSTRAINT "discharge_summaries_discharged_by_fkey" FOREIGN KEY (discharged_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."payments" ADD CONSTRAINT "payments_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."admissions" ADD CONSTRAINT "admissions_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."triage_assessments" ADD CONSTRAINT "triage_assessments_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
ALTER TABLE public."role_permissions" ADD CONSTRAINT "role_permissions_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_processed_by_fkey" FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_registered_by_fkey" FOREIGN KEY (registered_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."anc_registrations" ADD CONSTRAINT "anc_registrations_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."hospital_departments" ADD CONSTRAINT "hospital_departments_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."hospital_departments" ADD CONSTRAINT "hospital_departments_head_of_department_fkey" FOREIGN KEY (head_of_department) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."user_sessions" ADD CONSTRAINT "user_sessions_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."consent_records" ADD CONSTRAINT "consent_records_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."consent_records" ADD CONSTRAINT "consent_records_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."consent_records" ADD CONSTRAINT "consent_records_witnessed_by_fkey" FOREIGN KEY (witnessed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."consent_records" ADD CONSTRAINT "consent_records_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."data_access_log" ADD CONSTRAINT "data_access_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."data_access_log" ADD CONSTRAINT "data_access_log_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE public."data_access_log" ADD CONSTRAINT "data_access_log_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."ai_suggestions" ADD CONSTRAINT "ai_suggestions_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."nhis_cc_codes" ADD CONSTRAINT "nhis_cc_codes_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."fhir_resource_log" ADD CONSTRAINT "fhir_resource_log_triggered_by_fkey" FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."fhir_resource_log" ADD CONSTRAINT "fhir_resource_log_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."fhir_endpoint_config" ADD CONSTRAINT "fhir_endpoint_config_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."dhims2_indicator_mappings" ADD CONSTRAINT "dhims2_indicator_mappings_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."dhims2_reports" ADD CONSTRAINT "dhims2_reports_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."dhims2_reports" ADD CONSTRAINT "dhims2_reports_submitted_by_fkey" FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."integration_endpoints" ADD CONSTRAINT "integration_endpoints_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."report_templates" ADD CONSTRAINT "report_templates_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."report_templates" ADD CONSTRAINT "report_templates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."report_runs" ADD CONSTRAINT "report_runs_template_id_fkey" FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE SET NULL;
ALTER TABLE public."report_runs" ADD CONSTRAINT "report_runs_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."report_runs" ADD CONSTRAINT "report_runs_run_by_fkey" FOREIGN KEY (run_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."ai_suggestions" ADD CONSTRAINT "ai_suggestions_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."ai_suggestions" ADD CONSTRAINT "ai_suggestions_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."ai_suggestions" ADD CONSTRAINT "ai_suggestions_accepted_by_fkey" FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."sync_queue" ADD CONSTRAINT "sync_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."sync_queue" ADD CONSTRAINT "sync_queue_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."sync_conflicts" ADD CONSTRAINT "sync_conflicts_sync_queue_id_fkey" FOREIGN KEY (sync_queue_id) REFERENCES sync_queue(id) ON DELETE SET NULL;
ALTER TABLE public."sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."offline_cache_manifest" ADD CONSTRAINT "offline_cache_manifest_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."registered_devices" ADD CONSTRAINT "registered_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."registered_devices" ADD CONSTRAINT "registered_devices_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."dental_records" ADD CONSTRAINT "dental_records_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."dental_records" ADD CONSTRAINT "dental_records_dentist_id_fkey" FOREIGN KEY (dentist_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."nhis_cc_codes" ADD CONSTRAINT "nhis_cc_codes_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE;
ALTER TABLE public."nhis_cc_codes" ADD CONSTRAINT "nhis_cc_codes_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."lab_specimens" ADD CONSTRAINT "lab_specimens_lab_test_id_fkey" FOREIGN KEY (lab_test_id) REFERENCES lab_tests(id) ON DELETE CASCADE;
ALTER TABLE public."lab_specimens" ADD CONSTRAINT "lab_specimens_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."lab_specimens" ADD CONSTRAINT "lab_specimens_collected_by_fkey" FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."lab_specimens" ADD CONSTRAINT "lab_specimens_received_by_fkey" FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."lab_panels" ADD CONSTRAINT "lab_panels_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."drug_batches" ADD CONSTRAINT "drug_batches_drug_id_fkey" FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE CASCADE;
ALTER TABLE public."drug_batches" ADD CONSTRAINT "drug_batches_received_by_fkey" FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."drug_batches" ADD CONSTRAINT "drug_batches_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."drug_interactions" ADD CONSTRAINT "drug_interactions_drug_a_id_fkey" FOREIGN KEY (drug_a_id) REFERENCES drugs(id) ON DELETE CASCADE;
ALTER TABLE public."drug_interactions" ADD CONSTRAINT "drug_interactions_drug_b_id_fkey" FOREIGN KEY (drug_b_id) REFERENCES drugs(id) ON DELETE CASCADE;
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_drug_id_fkey" FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE CASCADE;
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_drug_batch_id_fkey" FOREIGN KEY (drug_batch_id) REFERENCES drug_batches(id) ON DELETE SET NULL;
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_prescription_id_fkey" FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_witnessed_by_fkey" FOREIGN KEY (witnessed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."controlled_substance_log" ADD CONSTRAINT "controlled_substance_log_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."mortuary_records" ADD CONSTRAINT "mortuary_records_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."mortuary_records" ADD CONSTRAINT "mortuary_records_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE public."mortuary_records" ADD CONSTRAINT "mortuary_records_attending_doctor_id_fkey" FOREIGN KEY (attending_doctor_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."mortuary_records" ADD CONSTRAINT "mortuary_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."dental_records" ADD CONSTRAINT "dental_records_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."dental_records" ADD CONSTRAINT "dental_records_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."physiotherapy_sessions" ADD CONSTRAINT "physiotherapy_sessions_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."physiotherapy_sessions" ADD CONSTRAINT "physiotherapy_sessions_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."physiotherapy_sessions" ADD CONSTRAINT "physiotherapy_sessions_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE public."physiotherapy_sessions" ADD CONSTRAINT "physiotherapy_sessions_therapist_id_fkey" FOREIGN KEY (therapist_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_issued_by_fkey" FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_attendant_id_fkey" FOREIGN KEY (attendant_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."nhis_cc_codes" ADD CONSTRAINT "nhis_cc_codes_generated_by_fkey" FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_anc_registration_id_fkey" FOREIGN KEY (anc_registration_id) REFERENCES anc_registrations(id) ON DELETE SET NULL;
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_catalog_id_fkey" FOREIGN KEY (catalog_id) REFERENCES lab_test_catalog(id) ON DELETE SET NULL;
ALTER TABLE public."lab_tests" ADD CONSTRAINT "lab_tests_panel_id_fkey" FOREIGN KEY (panel_id) REFERENCES lab_panels(id) ON DELETE SET NULL;
ALTER TABLE public."platform_owners" ADD CONSTRAINT "platform_owners_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."platform_members" ADD CONSTRAINT "platform_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public."platform_tenants" ADD CONSTRAINT "platform_tenants_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."platform_onboarding_tasks" ADD CONSTRAINT "platform_onboarding_tasks_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES platform_tenants(id) ON DELETE CASCADE;
ALTER TABLE public."platform_onboarding_tasks" ADD CONSTRAINT "platform_onboarding_tasks_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES platform_plans(id);
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_invoices" ADD CONSTRAINT "platform_invoices_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES platform_subscriptions(id);
ALTER TABLE public."platform_payments" ADD CONSTRAINT "platform_payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES platform_invoices(id);
ALTER TABLE public."platform_payments" ADD CONSTRAINT "platform_payments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_payments" ADD CONSTRAINT "platform_payments_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES auth.users(id);
ALTER TABLE public."platform_tickets" ADD CONSTRAINT "platform_tickets_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_tickets" ADD CONSTRAINT "platform_tickets_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES platform_members(id);
ALTER TABLE public."platform_ticket_messages" ADD CONSTRAINT "platform_ticket_messages_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES platform_tickets(id);
ALTER TABLE public."platform_ticket_messages" ADD CONSTRAINT "platform_ticket_messages_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id);
ALTER TABLE public."platform_job_steps" ADD CONSTRAINT "platform_job_steps_job_id_fkey" FOREIGN KEY (job_id) REFERENCES platform_jobs(id);
ALTER TABLE public."platform_usage" ADD CONSTRAINT "platform_usage_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_health_checks" ADD CONSTRAINT "platform_health_checks_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_jobs" ADD CONSTRAINT "platform_jobs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_jobs" ADD CONSTRAINT "platform_jobs_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id);
ALTER TABLE public."platform_backups" ADD CONSTRAINT "platform_backups_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_backups" ADD CONSTRAINT "platform_backups_job_id_fkey" FOREIGN KEY (job_id) REFERENCES platform_jobs(id);
ALTER TABLE public."platform_notifications" ADD CONSTRAINT "platform_notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES auth.users(id);
ALTER TABLE public."platform_onboarding_drafts" ADD CONSTRAINT "platform_onboarding_drafts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_onboarding_drafts" ADD CONSTRAINT "platform_onboarding_drafts_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."platform_launch_evidence" ADD CONSTRAINT "platform_launch_evidence_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_launch_evidence" ADD CONSTRAINT "platform_launch_evidence_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
ALTER TABLE public."platform_launch_approvals" ADD CONSTRAINT "platform_launch_approvals_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id);
ALTER TABLE public."platform_launch_approvals" ADD CONSTRAINT "platform_launch_approvals_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
ALTER TABLE public."platform_tenant_bindings" ADD CONSTRAINT "platform_tenant_bindings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id) ON DELETE CASCADE;
ALTER TABLE public."platform_tenant_schema_ledger" ADD CONSTRAINT "platform_tenant_schema_ledger_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES platform_tenants(id) ON DELETE CASCADE;
ALTER TABLE public."hr_leaves" ADD CONSTRAINT "hr_leaves_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id);
CREATE OR REPLACE FUNCTION public.is_platform_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_owners p, public.carelink_instance i
    WHERE p.user_id = auth.uid() AND i.singleton AND i.enabled AND i.instance_kind = 'platform'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.is_tenant_user() AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.audit_platform_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.platform_audit_log(actor_id,table_name,operation,record_id,old_values,new_values)
  VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.platform_set_member(p_id uuid, p_role text, p_status text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT public.is_platform_owner() OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'Owner permission and reason required'; END IF;
 UPDATE public.platform_members SET role=p_role,status=p_status WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 INSERT INTO public.platform_audit_log(actor_id,table_name,operation,record_id,new_values) VALUES(auth.uid(),'platform_members','change_access',p_id,jsonb_build_object('reason',p_reason,'outcome','succeeded'));
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_reconcile_payment(p_invoice_id uuid, p_amount numeric, p_reference text, p_note text, p_provider text DEFAULT 'manual'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE i public.platform_invoices; v_id uuid; v_existing public.platform_payments;
BEGIN
 IF p_provider='manual' THEN
   IF NOT public.platform_can('billing.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 ELSIF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
   AND COALESCE(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'Provider payments require server verification';
 END IF;
 IF p_provider NOT IN ('manual','paystack','flutterwave') OR p_amount<=0 OR length(trim(p_reference))<3 THEN RAISE EXCEPTION 'Invalid payment'; END IF;
 SELECT * INTO i FROM public.platform_invoices WHERE id=p_invoice_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 SELECT * INTO v_existing FROM public.platform_payments WHERE provider=p_provider AND reference=trim(p_reference);
 IF FOUND THEN
   IF v_existing.invoice_id<>p_invoice_id OR v_existing.amount<>p_amount THEN RAISE EXCEPTION 'Reference already used for a different payment'; END IF;
   RETURN v_existing.id;
 END IF;
 IF i.status<>'issued' OR p_amount>i.amount-i.paid_amount THEN RAISE EXCEPTION 'Payment exceeds the outstanding balance or invoice is closed'; END IF;
 INSERT INTO public.platform_payments(invoice_id,tenant_id,currency,amount,provider,reference,note,recorded_by)
 VALUES(i.id,i.tenant_id,i.currency,p_amount,p_provider,trim(p_reference),p_note,auth.uid()) RETURNING id INTO v_id;
 UPDATE public.platform_invoices SET paid_amount=paid_amount+p_amount,status=CASE WHEN paid_amount+p_amount=amount THEN 'paid' ELSE 'issued' END WHERE id=i.id;
 IF i.paid_amount+p_amount=i.amount THEN
   UPDATE public.platform_subscriptions s SET status='active' WHERE s.id=i.subscription_id AND s.status='past_due'
   AND NOT EXISTS(SELECT 1 FROM public.platform_invoices n WHERE n.subscription_id=s.id AND n.status='issued' AND n.due_date<current_date);
 END IF;
 RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.is_tenant_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS (SELECT 1 FROM public.users u, public.carelink_instance i
 WHERE u.id=auth.uid() AND i.singleton AND i.enabled AND i.instance_kind='tenant'
 AND NOT EXISTS(SELECT 1 FROM public.platform_owners p WHERE p.user_id=auth.uid())
 AND NOT EXISTS(SELECT 1 FROM public.platform_members m WHERE m.user_id=auth.uid()));
$function$
;
CREATE OR REPLACE FUNCTION public.get_carelink_access()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN public.platform_role() IS NOT NULL THEN jsonb_build_object('role',public.platform_role(),'scope','platform')
 WHEN public.is_tenant_user() THEN (SELECT jsonb_build_object('role',role,'scope','tenant') FROM public.users WHERE id=auth.uid())
 ELSE jsonb_build_object('role',null,'scope',null) END;
$function$
;
CREATE OR REPLACE FUNCTION public.platform_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN public.is_platform_owner() THEN 'platform_owner' ELSE (
   SELECT m.role FROM public.platform_members m, public.carelink_instance i
   WHERE m.user_id=auth.uid() AND m.status='active' AND i.singleton AND i.enabled AND i.instance_kind='platform'
 ) END;
$function$
;
CREATE OR REPLACE FUNCTION public.platform_can(p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT COALESCE(CASE public.platform_role()
 WHEN 'platform_owner' THEN true
 WHEN 'platform_admin' THEN p_permission = ANY(ARRAY['overview.read','hospitals.read','hospitals.write','onboarding.write','billing.read','support.read','support.write','operations.read','notifications.read','audit.read','settings.read'])
 WHEN 'finance_manager' THEN p_permission = ANY(ARRAY['overview.read','hospitals.read','billing.read','billing.write','notifications.read','audit.read'])
 WHEN 'support_officer' THEN p_permission = ANY(ARRAY['overview.read','hospitals.read','support.read','support.write','operations.read','notifications.read'])
 WHEN 'technical_admin' THEN p_permission = ANY(ARRAY['overview.read','hospitals.read','onboarding.write','operations.read','operations.write','notifications.read','audit.read','settings.read'])
 ELSE false END, false);
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_bmi()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.weight_kg IS NOT NULL AND NEW.height_cm IS NOT NULL AND NEW.height_cm > 0 THEN
    NEW.bmi := ROUND(NEW.weight_kg / POWER(NEW.height_cm / 100.0, 2), 1);
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_billing_total()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.discount_amount := COALESCE(NEW.unit_price * NEW.quantity * COALESCE(NEW.discount_percent, 0) / 100, 0);
  NEW.total_amount := (NEW.unit_price * NEW.quantity) - NEW.discount_amount + COALESCE(NEW.tax_amount, 0);
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_referrals_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_records_row_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_advanced_features_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_hospital_onboarding_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_hospital_profile_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    (SELECT role FROM users WHERE id = auth.uid()),
    'unauthorized'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.platform_archive_hospital(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT public.platform_can('hospitals.write') OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'Permission and reason required'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_id AND lifecycle_state IN ('onboarding','suspended') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Suspend an active hospital before archiving'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_jobs WHERE tenant_id=p_id AND status IN ('queued','running')) THEN RAISE EXCEPTION 'Resolve queued operations before archiving'; END IF;
 UPDATE public.platform_tenants SET lifecycle_state='archived' WHERE id=p_id;
 INSERT INTO public.platform_audit_log(actor_id,table_name,operation,record_id,new_values) VALUES(auth.uid(),'platform_tenants','archive',p_id,jsonb_build_object('reason',p_reason,'outcome','succeeded'));
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_assign_subscription(p_tenant_id uuid, p_plan_id uuid, p_cycle text, p_trial boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.platform_plans; v_id uuid; v_end date;
BEGIN
 IF NOT public.platform_can('billing.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_cycle NOT IN ('monthly','annual') THEN RAISE EXCEPTION 'Invalid billing cycle'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id AND lifecycle_state<>'archived' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
 SELECT * INTO p FROM public.platform_plans WHERE id=p_plan_id AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active plan'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_invoices WHERE tenant_id=p_tenant_id AND status='issued') THEN RAISE EXCEPTION 'Reconcile or void outstanding invoices before changing plans'; END IF;
 v_end := CASE WHEN p_trial AND p.trial_days>0 THEN current_date+p.trial_days WHEN p_cycle='annual' THEN (current_date+interval '1 year')::date ELSE (current_date+interval '1 month')::date END;
 INSERT INTO public.platform_subscriptions(tenant_id,plan_id,billing_cycle,status,currency,amount,period_start,period_end,trial_end,grace_days)
 VALUES(p_tenant_id,p.id,p_cycle,CASE WHEN p_trial AND p.trial_days>0 THEN 'trialing' ELSE 'active' END,p.currency,
 CASE WHEN p_cycle='annual' THEN p.annual_price ELSE p.monthly_price END,current_date,v_end,CASE WHEN p_trial AND p.trial_days>0 THEN v_end END,p.grace_days)
 ON CONFLICT(tenant_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,billing_cycle=EXCLUDED.billing_cycle,status=EXCLUDED.status,
 currency=EXCLUDED.currency,amount=EXCLUDED.amount,period_start=EXCLUDED.period_start,period_end=EXCLUDED.period_end,trial_end=EXCLUDED.trial_end,grace_days=EXCLUDED.grace_days
 RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_billing_action(p_kind text, p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT public.platform_can('billing.write') OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'Permission and reason required'; END IF;
 IF p_kind='cancel_subscription' THEN UPDATE public.platform_subscriptions SET status='cancelled' WHERE id=p_id;
 ELSIF p_kind='void_invoice' THEN UPDATE public.platform_invoices SET status='void' WHERE id=p_id AND paid_amount=0 AND status='issued';
 ELSE RAISE EXCEPTION 'Unsupported billing action'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Record unavailable or action not allowed'; END IF;
 INSERT INTO public.platform_audit_log(actor_id,table_name,operation,record_id,new_values) VALUES(auth.uid(),'billing',p_kind,p_id,jsonb_build_object('reason',p_reason,'outcome','succeeded'));
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_generate_invoice(p_subscription_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.platform_subscriptions; v_id uuid; v_start date; v_end date;
BEGIN
 IF NOT public.platform_can('billing.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO s FROM public.platform_subscriptions WHERE id=p_subscription_id FOR UPDATE;
 IF NOT FOUND OR s.status='cancelled' THEN RAISE EXCEPTION 'Subscription unavailable'; END IF;
 IF s.status='trialing' AND s.trial_end>current_date THEN RAISE EXCEPTION 'Trial has not ended'; END IF;
 v_start := CASE WHEN s.status='trialing' THEN s.period_end ELSE s.period_start END;
 v_end := CASE WHEN s.status='trialing' THEN (v_start+CASE WHEN s.billing_cycle='annual' THEN interval '1 year' ELSE interval '1 month' END)::date ELSE s.period_end END;
 SELECT id INTO v_id FROM public.platform_invoices WHERE subscription_id=s.id AND period_start=v_start;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 IF s.status='trialing' THEN UPDATE public.platform_subscriptions SET status='active',period_start=v_start,period_end=v_end WHERE id=s.id; END IF;
 INSERT INTO public.platform_invoices(tenant_id,subscription_id,currency,amount,status,period_start,period_end,due_date)
 VALUES(s.tenant_id,s.id,s.currency,s.amount,CASE WHEN s.amount=0 THEN 'paid' ELSE 'issued' END,v_start,v_end,v_start+s.grace_days) RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_register_hospital(p_name text, p_email text, p_region text, p_request_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
 IF NOT public.platform_can('hospitals.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF length(trim(p_name))<2 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Hospital name and valid administrator email required'; END IF;
 INSERT INTO public.platform_tenants(hospital_name,owner_email,region,created_by,request_key,status)
 VALUES(trim(p_name),lower(trim(p_email)),trim(p_region),auth.uid(),p_request_key,'intake')
 ON CONFLICT(request_key) DO UPDATE SET request_key=EXCLUDED.request_key RETURNING id INTO v_id;
 INSERT INTO public.platform_onboarding_tasks(hospital_id,phase,task_name,sort_order)
 SELECT v_id,x.phase,x.name,x.n FROM (VALUES
 ('intake','Verify hospital registration',1),('accounts','Invite hospital administrator',2),
 ('technical','Provision isolated hospital workspace',3),('branding','Confirm initial configuration',4),
 ('database','Assign licensed modules',5),('handover','Complete staff training',6),
 ('security','Verify tenant isolation and readiness',7),('go_live','Approve go-live checklist',8)
 ) x(phase,name,n) WHERE NOT EXISTS(SELECT 1 FROM public.platform_onboarding_tasks WHERE hospital_id=v_id);
 RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_renew_subscription(p_id uuid, p_expected_end date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.platform_subscriptions;
BEGIN
 IF NOT public.platform_can('billing.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO s FROM public.platform_subscriptions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR s.status='cancelled' OR s.status='trialing' THEN RAISE EXCEPTION 'Subscription cannot be renewed'; END IF;
 IF s.period_end<>p_expected_end THEN RETURN; END IF;
 IF s.period_end>current_date THEN RAISE EXCEPTION 'Renewal period has not started'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_invoices WHERE subscription_id=s.id AND period_start=s.period_start AND status='paid') THEN RAISE EXCEPTION 'Current period must be invoiced and paid before renewal'; END IF;
 UPDATE public.platform_subscriptions SET period_start=s.period_end,period_end=(s.period_end+CASE WHEN s.billing_cycle='annual' THEN interval '1 year' ELSE interval '1 month' END)::date,status='active' WHERE id=s.id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_request_job(p_kind text, p_tenant_id uuid, p_payload jsonb, p_reason text, p_request_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid; t public.platform_tenants; s public.platform_subscriptions; v_permission text;
BEGIN
 v_permission := CASE WHEN p_kind='invite_platform' THEN 'team.write' WHEN p_kind IN ('invite_admin','provision','go_live','apply_modules') THEN 'onboarding.write' ELSE 'operations.write' END;
 IF NOT public.platform_can(v_permission) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF length(trim(p_reason))<5 THEN RAISE EXCEPTION 'Provide a reason of at least five characters'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'Invalid request payload'; END IF;
 -- Never accept server URLs, credentials or arbitrary commands from a browser.
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('email','role','modules','backup_id')) THEN RAISE EXCEPTION 'Unsupported request fields'; END IF;
 SELECT id INTO v_id FROM public.platform_jobs WHERE request_key=p_request_key AND requested_by=auth.uid();
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 IF p_kind='invite_platform' THEN
   IF p_tenant_id IS NOT NULL OR p_payload->>'role' NOT IN ('platform_admin','finance_manager','support_officer','technical_admin') OR COALESCE(p_payload->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Valid platform invitation required'; END IF;
 ELSE
   SELECT * INTO t FROM public.platform_tenants WHERE id=p_tenant_id FOR UPDATE;
   IF NOT FOUND OR t.lifecycle_state='archived' THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
   IF EXISTS(SELECT 1 FROM public.platform_jobs WHERE tenant_id=t.id AND status IN ('queued','running') AND kind IN ('provision','go_live','suspend','reactivate','apply_modules','restore')) THEN RAISE EXCEPTION 'Wait for the existing hospital operation to finish'; END IF;
   IF p_kind='go_live' THEN
     IF t.provisioned_at IS NULL OR t.admin_user_id IS NULL OR EXISTS(SELECT 1 FROM public.platform_onboarding_tasks WHERE hospital_id=t.id AND status<>'completed') THEN RAISE EXCEPTION 'Provisioning, administrator invitation and all readiness tasks must be complete'; END IF;
   END IF;
   IF p_kind='suspend' AND t.lifecycle_state<>'active' THEN RAISE EXCEPTION 'Only active hospitals can be suspended'; END IF;
   IF p_kind='reactivate' AND t.lifecycle_state<>'suspended' THEN RAISE EXCEPTION 'Only suspended hospitals can be reactivated'; END IF;
   IF p_kind IN ('go_live','reactivate','apply_modules') THEN
     SELECT * INTO s FROM public.platform_subscriptions WHERE tenant_id=t.id AND status IN ('active','trialing') AND period_end+grace_days>=current_date;
     IF NOT FOUND THEN RAISE EXCEPTION 'An eligible subscription is required'; END IF;
   END IF;
   IF p_kind='apply_modules' THEN
     IF jsonb_typeof(p_payload->'modules') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Module list required'; END IF;
     IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload->'modules') m WHERE NOT m=ANY((SELECT modules FROM public.platform_plans WHERE id=s.plan_id))) THEN RAISE EXCEPTION 'Selected module is not included in the subscription plan'; END IF;
   END IF;
   IF p_kind='restore' AND NOT EXISTS(SELECT 1 FROM public.platform_backups WHERE id=(p_payload->>'backup_id')::uuid AND tenant_id=t.id AND status='available' AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'Choose an available backup for this hospital'; END IF;
   IF p_kind='invite_admin' THEN p_payload:=jsonb_build_object('email',t.owner_email); END IF;
 END IF;
 INSERT INTO public.platform_jobs(kind,tenant_id,payload,reason,request_key,requested_by)
 VALUES(p_kind,p_tenant_id,p_payload,trim(p_reason),p_request_key,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_retry_job(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j public.platform_jobs;
BEGIN
 SELECT * INTO j FROM public.platform_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job unavailable'; END IF;
 IF NOT public.platform_can(CASE WHEN j.kind='invite_platform' THEN 'team.write' WHEN j.kind IN ('invite_admin','provision','go_live','apply_modules') THEN 'onboarding.write' ELSE 'operations.write' END) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF j.status NOT IN ('failed','blocked') THEN RAISE EXCEPTION 'Only failed or blocked jobs can be retried'; END IF;
 UPDATE public.platform_jobs SET status='queued',error=null,lease_token=null,lease_until=null WHERE id=j.id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_run_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE n integer;
BEGIN
 IF NOT public.platform_can('billing.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE public.platform_subscriptions s SET status='past_due' WHERE status='active' AND EXISTS(SELECT 1 FROM public.platform_invoices i WHERE i.subscription_id=s.id AND i.status='issued' AND i.due_date<current_date);
 INSERT INTO public.platform_notifications(recipient_id,title,body,path,dedupe_key)
 SELECT auth.uid(),'Subscription renewal approaching',t.hospital_name||' renews on '||s.period_end,'/platform/subscriptions','renewal:'||s.id||':'||s.period_end
 FROM public.platform_subscriptions s JOIN public.platform_tenants t ON t.id=s.tenant_id,public.platform_settings cfg
 WHERE s.status IN ('active','trialing','past_due') AND s.period_end<=current_date+cfg.renewal_notice_days
 ON CONFLICT(recipient_id,dedupe_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_search(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_result jsonb; v_pattern text;
BEGIN
 IF public.platform_role() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF length(trim(p_query))<2 THEN RETURN '[]'; END IF;
 v_pattern := '%' || replace(replace(replace(left(p_query,100),'\','\\'),'%','\%'),'_','\_') || '%';
 SELECT COALESCE(jsonb_agg(x),'[]') INTO v_result FROM (
 SELECT id,'hospital' AS kind,hospital_name AS label,'/platform/hospitals/'||id AS path FROM public.platform_tenants WHERE public.platform_can('hospitals.read') AND hospital_name ILIKE v_pattern
 UNION ALL SELECT id,'ticket',subject,'/platform/support?ticket='||id FROM public.platform_tickets WHERE public.platform_can('support.read') AND subject ILIKE v_pattern
 UNION ALL SELECT id,'invoice',number,'/platform/billing?invoice='||id FROM public.platform_invoices WHERE public.platform_can('billing.read') AND number ILIKE v_pattern
 LIMIT 20) x;
 RETURN v_result;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_save_onboarding_draft(p_tenant_id uuid, p_revision integer, p_step integer, p_requirements jsonb)
 RETURNS platform_onboarding_drafts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.platform_onboarding_drafts; k text;
BEGIN
 IF NOT public.platform_can('onboarding.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_step IS NULL OR p_step NOT BETWEEN 0 AND 7 THEN RAISE EXCEPTION 'Invalid draft revision or step'; END IF;
 IF p_requirements IS NULL OR jsonb_typeof(p_requirements)<>'object' OR octet_length(p_requirements::text)>24000 THEN RAISE EXCEPTION 'Invalid requirements'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_requirements) LOOP
   IF k NOT IN ('contact_phone','location','primary_color','secondary_color','target_date','notes','modules','training_notes','verification_notes') THEN RAISE EXCEPTION 'Unsupported requirement field'; END IF;
   IF k<>'modules' AND (jsonb_typeof(p_requirements->k)<>'string' OR length(p_requirements->>k)>4000) THEN RAISE EXCEPTION 'Invalid text field'; END IF;
 END LOOP;
 IF p_requirements ? 'modules' THEN
   IF jsonb_typeof(p_requirements->'modules')<>'array' THEN RAISE EXCEPTION 'Module list required'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_requirements->'modules') m WHERE jsonb_typeof(m)<>'string') THEN RAISE EXCEPTION 'Invalid module'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_requirements->'modules') m WHERE m NOT IN ('patients','appointments','laboratory','pharmacy','drug_management','billing','claims','reports','nurse_dashboard','records_dashboard','referrals')) THEN RAISE EXCEPTION 'Unknown module'; END IF;
 END IF;
 -- Serialize first saves as well as updates; no duplicate draft race.
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id AND lifecycle_state<>'archived' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
 SELECT * INTO d FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id;
 IF COALESCE(d.revision,0)<>p_revision THEN RAISE EXCEPTION 'Draft changed by another editor. Reload before saving.'; END IF;
 INSERT INTO public.platform_onboarding_drafts(tenant_id,step,requirements,updated_by)
 VALUES(p_tenant_id,p_step,p_requirements,auth.uid())
 ON CONFLICT(tenant_id) DO UPDATE SET revision=platform_onboarding_drafts.revision+1,
 step=EXCLUDED.step, requirements=EXCLUDED.requirements,updated_by=auth.uid(),updated_at=now()
 RETURNING * INTO d;
 RETURN d;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_actor_can(p_actor uuid, p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND enabled AND instance_kind='platform') AND (
 EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=p_actor) OR EXISTS(
 SELECT 1 FROM public.platform_members WHERE user_id=p_actor AND status='active' AND CASE role
 WHEN 'platform_admin' THEN p_permission IN ('hospitals.write','onboarding.write')
 WHEN 'technical_admin' THEN p_permission IN ('onboarding.write','operations.write')
 WHEN 'finance_manager' THEN p_permission='billing.write' ELSE false END));
$function$
;
CREATE OR REPLACE FUNCTION public.platform_approve_launch(p_tenant_id uuid, p_revision integer, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Owner approval required'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id FOR UPDATE;
 IF p_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Requirements changed'; END IF;
 IF cardinality(public.platform_launch_blockers(p_tenant_id))>0 THEN RAISE EXCEPTION 'Resolve launch blockers first'; END IF;
 INSERT INTO public.platform_launch_approvals(tenant_id,revision,actor_id,reason) VALUES(p_tenant_id,p_revision,auth.uid(),p_reason)
 ON CONFLICT(tenant_id,revision) DO UPDATE SET actor_id=EXCLUDED.actor_id,reason=EXCLUDED.reason,created_at=now();
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_checkpoint_job(p_id uuid, p_token uuid, p_name text, p_result jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM 1 FROM public.platform_jobs WHERE id=p_id AND lease_token=p_token AND status='running' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lease lost'; END IF;
 IF p_name IS NULL OR length(p_name)>80 OR jsonb_typeof(p_result)<>'object' OR octet_length(p_result::text)>12000 THEN RAISE EXCEPTION 'Invalid checkpoint'; END IF;
 INSERT INTO public.platform_job_steps(job_id,name,result) VALUES(p_id,p_name,p_result) ON CONFLICT(job_id,name) DO NOTHING;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_claim_job()
 RETURNS platform_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j public.platform_jobs; perm text;
BEGIN
 -- A transaction advisory lock serializes claim selection across workers, not execution.
 PERFORM pg_advisory_xact_lock(72819401);
 SELECT * INTO j FROM public.platform_jobs q WHERE
 ((q.status='queued' AND q.next_attempt_at<=now()) OR (q.status='running' AND q.lease_until<now()))
 AND NOT EXISTS(SELECT 1 FROM public.platform_jobs r WHERE r.tenant_id=q.tenant_id AND r.id<>q.id AND r.status='running' AND r.lease_until>=now())
 ORDER BY q.created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 perm:=CASE WHEN j.kind='invite_platform' THEN 'team.write' WHEN j.kind IN ('provision','invite_admin','apply_modules','go_live') THEN 'onboarding.write' ELSE 'operations.write' END;
 IF NOT public.platform_actor_can(j.requested_by,perm) OR
 (j.tenant_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.platform_tenants WHERE id=j.tenant_id AND lifecycle_state='archived')) OR
 (j.kind IN ('provision','apply_modules','go_live') AND j.draft_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=j.tenant_id)) THEN
 UPDATE public.platform_jobs SET status='blocked',error='Authorization or requirements changed; submit a new request',lease_token=null,lease_until=null WHERE id=j.id;
 RETURN NULL;
 END IF;
 IF j.kind='go_live' AND (cardinality(public.platform_launch_blockers(j.tenant_id))>0 OR NOT EXISTS(SELECT 1 FROM public.platform_launch_approvals WHERE tenant_id=j.tenant_id AND revision=j.draft_revision)) THEN
 UPDATE public.platform_jobs SET status='blocked',error='Launch approval is no longer valid' WHERE id=j.id; RETURN NULL;
 END IF;
 UPDATE public.platform_jobs SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',error=null WHERE id=j.id RETURNING * INTO j;
 RETURN j;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_snapshot_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.platform_onboarding_drafts;
BEGIN
 IF NEW.tenant_id IS NOT NULL THEN
 SELECT * INTO d FROM public.platform_onboarding_drafts WHERE tenant_id=NEW.tenant_id;
 NEW.draft_revision:=d.revision; NEW.configuration:=COALESCE(d.requirements,'{}');
 IF NEW.kind IN ('provision','apply_modules','go_live') AND d.id IS NULL THEN RAISE EXCEPTION 'Save requirements before requesting this operation'; END IF;
 IF NEW.kind='go_live' AND (cardinality(public.platform_launch_blockers(NEW.tenant_id))>0 OR NOT EXISTS(SELECT 1 FROM public.platform_launch_approvals WHERE tenant_id=NEW.tenant_id AND revision=d.revision)) THEN RAISE EXCEPTION 'Launch evidence and owner approval required'; END IF;
 END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_record_schema(p_tenant_id uuid, p_name text, p_checksum text, p_status text, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''), NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 IF p_checksum IS NULL OR p_status IS NULL OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 160 OR p_checksum !~ '^[a-f0-9]{64}$' OR p_status NOT IN ('applied','failed') THEN RAISE EXCEPTION 'Invalid schema record'; END IF;
 INSERT INTO public.platform_tenant_schema_ledger(tenant_id,migration_name,checksum,status,error) VALUES(p_tenant_id,trim(p_name),p_checksum,p_status,left(p_error,500)) ON CONFLICT(tenant_id,migration_name) DO UPDATE SET checksum=EXCLUDED.checksum,status=EXCLUDED.status,error=EXCLUDED.error,applied_at=now();
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_finish_job(p_id uuid, p_token uuid, p_status text, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j public.platform_jobs;
BEGIN
 SELECT * INTO j FROM public.platform_jobs WHERE id=p_id AND lease_token=p_token AND status='running' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lease lost'; END IF;
 IF p_status NOT IN ('succeeded','failed','blocked','queued') THEN RAISE EXCEPTION 'Invalid result'; END IF;
 UPDATE public.platform_jobs SET status=CASE WHEN p_status='queued' AND attempts>=6 THEN 'failed' ELSE p_status END,error=left(p_error,500),
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)),
 completed_at=CASE WHEN p_status='succeeded' THEN now() ELSE NULL END,lease_token=null,lease_until=null WHERE id=j.id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_job_heartbeat(p_id uuid, p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 UPDATE public.platform_jobs SET lease_until=now()+interval '90 seconds' WHERE id=p_id AND lease_token=p_token AND status='running' AND lease_until>now();
 RETURN FOUND;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_launch_blockers(p_tenant uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t public.platform_tenants; d public.platform_onboarding_drafts; blockers text[] := '{}'; k text;
BEGIN
 SELECT * INTO t FROM public.platform_tenants WHERE id=p_tenant;
 SELECT * INTO d FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant;
 IF t.id IS NULL OR t.lifecycle_state='archived' THEN blockers:=array_append(blockers,'Hospital unavailable'); END IF;
 IF d.id IS NULL THEN blockers:=array_append(blockers,'Save requirements'); END IF;
 IF t.provisioned_at IS NULL THEN blockers:=array_append(blockers,'Provision workspace'); END IF;
 IF t.admin_user_id IS NULL THEN blockers:=array_append(blockers,'Set up administrator'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_subscriptions WHERE tenant_id=p_tenant AND status IN ('active','trialing') AND period_end+grace_days>=current_date) THEN blockers:=array_append(blockers,'Eligible subscription required'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.requirements->'modules','[]')) m WHERE NOT m=ANY(t.enabled_modules)) THEN blockers:=array_append(blockers,'Requested modules not confirmed'); END IF;
 FOREACH k IN ARRAY ARRAY['deployment','isolation','admin_acceptance','account_protection','backup_restore','clinical','training','support'] LOOP
 IF NOT EXISTS(SELECT 1 FROM public.platform_launch_evidence WHERE tenant_id=p_tenant AND revision=d.revision AND kind=k) THEN blockers:=array_append(blockers,'Evidence required: '||k); END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.platform_onboarding_tasks WHERE hospital_id=p_tenant AND status<>'completed') THEN blockers:=array_append(blockers,'Complete onboarding checklist'); END IF;
 RETURN blockers;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_readiness(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT public.platform_can('hospitals.read') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 RETURN jsonb_build_object('blockers',public.platform_launch_blockers(p_tenant_id),'revision',(SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id));
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_record_evidence(p_tenant_id uuid, p_revision integer, p_kind text, p_reference text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT public.platform_can('onboarding.write') OR p_kind NOT IN ('clinical','training','support','backup_restore','account_protection','admin_acceptance') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_tenant_id AND lifecycle_state<>'archived' FOR UPDATE;
 IF NOT FOUND OR p_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Reload the current requirements revision'; END IF;
 INSERT INTO public.platform_launch_evidence(tenant_id,revision,kind,reference,actor_id) VALUES(p_tenant_id,p_revision,p_kind,p_reference,auth.uid())
 ON CONFLICT(tenant_id,revision,kind) DO UPDATE SET reference=EXCLUDED.reference,actor_id=EXCLUDED.actor_id,created_at=now();
 DELETE FROM public.platform_launch_approvals WHERE tenant_id=p_tenant_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_hospital_status(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.platform_can('hospitals.read') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT jsonb_build_object(
   'tenant_id',t.id,'registration_status',t.status,'lifecycle_state',t.lifecycle_state,'provisioned_at',t.provisioned_at,
   'administrator_configured',t.admin_user_id IS NOT NULL,
   'binding',(SELECT (to_jsonb(b) - 'id' - 'tenant_id') - CASE WHEN public.platform_can('billing.read') THEN ARRAY[]::text[] ELSE ARRAY['estimated_monthly_cost','cost_currency'] END FROM public.platform_tenant_bindings b WHERE b.tenant_id=t.id),
   'schema_ledger',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.applied_at DESC) FROM public.platform_tenant_schema_ledger l WHERE l.tenant_id=t.id),'[]'::jsonb),
   'latest_job',(SELECT to_jsonb(j) - 'configuration' - 'lease_token' FROM public.platform_jobs j WHERE j.tenant_id=t.id ORDER BY j.created_at DESC LIMIT 1),
   'steps',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at) FROM public.platform_job_steps s JOIN public.platform_jobs j ON j.id=s.job_id WHERE j.tenant_id=t.id),'[]'::jsonb),
   'readiness_blockers',public.platform_launch_blockers(t.id),
   'owner_approved',EXISTS(SELECT 1 FROM public.platform_launch_approvals a WHERE a.tenant_id=t.id AND a.revision=(SELECT revision FROM public.platform_onboarding_drafts d WHERE d.tenant_id=t.id))
 ) INTO v_result FROM public.platform_tenants t WHERE t.id=p_tenant_id;
 RETURN v_result;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_record_health(p_tenant_id uuid, p_status text, p_latency integer, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''), NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' OR p_status IS NULL OR p_latency IS NULL OR p_latency<0 OR p_status NOT IN ('healthy','degraded','down') THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 INSERT INTO public.platform_health_checks(tenant_id,service,status,latency_ms,detail,created_at) VALUES(p_tenant_id,'provisioning',p_status, greatest(p_latency,0),left(COALESCE(p_error,''),500),now());
 UPDATE public.platform_tenant_bindings SET health_status=p_status,last_health_check_at=now(),last_sync_at=now(),last_error=left(p_error,500),updated_at=now() WHERE tenant_id=p_tenant_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_record_cost(p_tenant_id uuid, p_provider text, p_period date, p_amount numeric, p_currency text, p_source text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''), NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' OR p_provider IS NULL OR p_amount IS NULL OR p_currency IS NULL OR p_source IS NULL OR p_provider NOT IN ('supabase','vercel','other') OR p_amount<0 OR p_currency !~ '^[A-Z]{3}$' OR length(trim(p_source))<2 THEN RAISE EXCEPTION 'Invalid cost record'; END IF;
 INSERT INTO public.platform_tenant_costs(tenant_id,provider,period_start,amount,currency,source) VALUES(p_tenant_id,p_provider,date_trunc('month',COALESCE(p_period,current_date))::date,p_amount,p_currency,trim(p_source)) ON CONFLICT(tenant_id,provider,period_start) DO UPDATE SET amount=EXCLUDED.amount,currency=EXCLUDED.currency,source=EXCLUDED.source,measured_at=now();
 UPDATE public.platform_tenant_bindings SET estimated_monthly_cost=(SELECT sum(amount) FROM public.platform_tenant_costs WHERE tenant_id=p_tenant_id AND currency=p_currency AND period_start=date_trunc('month',COALESCE(p_period,current_date))::date),cost_currency=p_currency,updated_at=now() WHERE tenant_id=p_tenant_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_worker_record(p_id uuid, p_token uuid, p_operation text, p_args jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j public.platform_jobs; permission text;
BEGIN
 SELECT * INTO j FROM public.platform_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR j.status<>'running' OR j.lease_token IS DISTINCT FROM p_token OR j.lease_until IS NULL OR j.lease_until<=now() THEN
   RAISE EXCEPTION 'Lease lost';
 END IF;
 permission:=CASE WHEN j.kind='invite_platform' THEN 'team.write'
 WHEN j.kind IN ('provision','invite_admin','apply_modules','go_live') THEN 'onboarding.write' ELSE 'operations.write' END;
 IF NOT public.platform_actor_can(j.requested_by,permission) THEN RAISE EXCEPTION 'Authorization changed'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=j.tenant_id AND lifecycle_state<>'archived' FOR UPDATE;
 IF NOT FOUND OR j.tenant_id IS DISTINCT FROM (p_args->>'p_tenant_id')::uuid THEN RAISE EXCEPTION 'Hospital unavailable'; END IF;
 IF j.draft_revision IS DISTINCT FROM (SELECT revision FROM public.platform_onboarding_drafts WHERE tenant_id=j.tenant_id) THEN
   RAISE EXCEPTION 'Requirements changed';
 END IF;
 IF p_operation='platform_record_binding' THEN
   PERFORM public.platform_record_binding(j.tenant_id,p_args->'p_state');
 ELSIF p_operation='platform_record_schema' THEN
   PERFORM public.platform_record_schema(j.tenant_id,p_args->>'p_name',p_args->>'p_checksum',p_args->>'p_status',p_args->>'p_error');
 ELSIF p_operation='platform_record_health' THEN
   PERFORM public.platform_record_health(j.tenant_id,p_args->>'p_status',(p_args->>'p_latency')::integer,p_args->>'p_error');
 ELSIF p_operation='platform_record_cost' THEN
   PERFORM public.platform_record_cost(j.tenant_id,p_args->>'p_provider',(p_args->>'p_period')::date,(p_args->>'p_amount')::numeric,p_args->>'p_currency',p_args->>'p_source');
 ELSE RAISE EXCEPTION 'Unsupported worker write'; END IF;
END $function$
;
CREATE OR REPLACE FUNCTION public.platform_record_binding(p_tenant_id uuid, p_state jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_ref text; v_url text; v_checksum text; k text;
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''), NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker permission required'; END IF;
 IF p_state IS NULL OR jsonb_typeof(p_state)<>'object' OR octet_length(p_state::text)>12000 THEN RAISE EXCEPTION 'Invalid binding'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_state) LOOP
   IF k NOT IN ('supabase_project_ref','supabase_url','vercel_project_id','vercel_project_name','deployment_id','deployment_url','domain','provider_status','health_status','admin_invitation_status','schema_version','schema_checksum','estimated_monthly_cost','cost_currency','provisioned_at','last_error') THEN RAISE EXCEPTION 'Unsupported binding field'; END IF;
 END LOOP;
 v_ref:=p_state->>'supabase_project_ref'; v_url:=p_state->>'supabase_url'; v_checksum:=p_state->>'schema_checksum';
 IF v_ref IS NOT NULL AND v_ref !~ '^[a-z0-9]{6,64}$' THEN RAISE EXCEPTION 'Invalid Supabase project reference'; END IF;
 IF v_checksum IS NOT NULL AND v_checksum !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid schema checksum'; END IF;
 INSERT INTO public.platform_tenant_bindings(tenant_id,supabase_project_ref,supabase_url,vercel_project_id,vercel_project_name,deployment_id,deployment_url,domain,provider_status,health_status,admin_invitation_status,schema_version,schema_checksum,estimated_monthly_cost,cost_currency,provisioned_at,last_sync_at,last_error)
 SELECT p_tenant_id,v_ref,p_state->>'supabase_url',p_state->>'vercel_project_id',p_state->>'vercel_project_name',p_state->>'deployment_id',p_state->>'deployment_url',p_state->>'domain',COALESCE(p_state->>'provider_status','pending'),COALESCE(p_state->>'health_status','unknown'),COALESCE(p_state->>'admin_invitation_status','pending'),p_state->>'schema_version',v_checksum,(p_state->>'estimated_monthly_cost')::numeric,p_state->>'cost_currency',(p_state->>'provisioned_at')::timestamptz,now(),left(p_state->>'last_error',500)
 ON CONFLICT(tenant_id) DO UPDATE SET supabase_project_ref=COALESCE(EXCLUDED.supabase_project_ref,platform_tenant_bindings.supabase_project_ref),supabase_url=COALESCE(EXCLUDED.supabase_url,platform_tenant_bindings.supabase_url),vercel_project_id=COALESCE(EXCLUDED.vercel_project_id,platform_tenant_bindings.vercel_project_id),vercel_project_name=COALESCE(EXCLUDED.vercel_project_name,platform_tenant_bindings.vercel_project_name),deployment_id=COALESCE(EXCLUDED.deployment_id,platform_tenant_bindings.deployment_id),deployment_url=COALESCE(EXCLUDED.deployment_url,platform_tenant_bindings.deployment_url),domain=COALESCE(EXCLUDED.domain,platform_tenant_bindings.domain),provider_status=CASE WHEN p_state ? 'provider_status' THEN EXCLUDED.provider_status ELSE platform_tenant_bindings.provider_status END,health_status=CASE WHEN p_state ? 'health_status' THEN EXCLUDED.health_status ELSE platform_tenant_bindings.health_status END,admin_invitation_status=CASE WHEN p_state ? 'admin_invitation_status' THEN EXCLUDED.admin_invitation_status ELSE platform_tenant_bindings.admin_invitation_status END,schema_version=COALESCE(EXCLUDED.schema_version,platform_tenant_bindings.schema_version),schema_checksum=COALESCE(EXCLUDED.schema_checksum,platform_tenant_bindings.schema_checksum),estimated_monthly_cost=COALESCE(EXCLUDED.estimated_monthly_cost,platform_tenant_bindings.estimated_monthly_cost),cost_currency=COALESCE(EXCLUDED.cost_currency,platform_tenant_bindings.cost_currency),provisioned_at=COALESCE(EXCLUDED.provisioned_at,platform_tenant_bindings.provisioned_at),last_sync_at=now(),last_error=CASE WHEN p_state ? 'last_error' THEN EXCLUDED.last_error ELSE platform_tenant_bindings.last_error END,updated_at=now();
 IF COALESCE(p_state->>'provider_status','')='ready' THEN UPDATE public.platform_tenants SET provisioned_at=COALESCE(provisioned_at,now()),status=CASE WHEN status IN ('lead','intake','provisioning') THEN 'training' ELSE status END,updated_at=now() WHERE id=p_tenant_id; END IF;
END $function$
;
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION update_referrals_updated_at();
CREATE TRIGGER update_nurse_notes_updated_at BEFORE UPDATE ON public.nurse_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON public.medical_records FOR EACH ROW EXECUTE FUNCTION set_records_row_updated_at();
CREATE TRIGGER update_record_requests_updated_at BEFORE UPDATE ON public.record_requests FOR EACH ROW EXECUTE FUNCTION set_records_row_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON public.drugs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lab_tests_updated_at BEFORE UPDATE ON public.lab_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION set_hospital_onboarding_updated_at();
CREATE TRIGGER update_hospital_onboarding_tasks_updated_at BEFORE UPDATE ON public.hospital_onboarding_tasks FOR EACH ROW EXECUTE FUNCTION set_hospital_onboarding_updated_at();
CREATE TRIGGER update_queue_timestamp BEFORE UPDATE ON public.queue_management FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();
CREATE TRIGGER update_virtual_consultations_timestamp BEFORE UPDATE ON public.virtual_consultations FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();
CREATE TRIGGER update_wards_timestamp BEFORE UPDATE ON public.wards FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();
CREATE TRIGGER update_beds_timestamp BEFORE UPDATE ON public.beds FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();
CREATE TRIGGER update_admissions_timestamp BEFORE UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();
CREATE TRIGGER update_inventory_items_timestamp BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();
CREATE TRIGGER update_staff_schedules_timestamp BEFORE UPDATE ON public.staff_schedules FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();
CREATE TRIGGER update_leave_requests_timestamp BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION update_advanced_features_timestamp();
CREATE TRIGGER update_hospital_profile_updated_at BEFORE UPDATE ON public.hospital_profile FOR EACH ROW EXECUTE FUNCTION set_hospital_profile_updated_at();
CREATE TRIGGER update_suppliers_timestamp BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_timestamp BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_encounters_timestamp BEFORE UPDATE ON public.encounters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_diagnoses_timestamp BEFORE UPDATE ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_calculate_bmi BEFORE INSERT OR UPDATE ON public.vitals FOR EACH ROW EXECUTE FUNCTION calculate_bmi();
CREATE TRIGGER update_vitals_timestamp BEFORE UPDATE ON public.vitals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clinical_notes_timestamp BEFORE UPDATE ON public.clinical_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clinical_orders_timestamp BEFORE UPDATE ON public.clinical_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_problem_list_timestamp BEFORE UPDATE ON public.problem_list FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_allergies_timestamp BEFORE UPDATE ON public.allergies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mar_timestamp BEFORE UPDATE ON public.medication_administration_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nursing_assessments_timestamp BEFORE UPDATE ON public.nursing_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_care_plans_timestamp BEFORE UPDATE ON public.nursing_care_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ward_rounds_timestamp BEFORE UPDATE ON public.ward_rounds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_handover_notes_timestamp BEFORE UPDATE ON public.handover_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tariff_timestamp BEFORE UPDATE ON public.nhia_tariff_catalog FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fee_schedules_timestamp BEFORE UPDATE ON public.fee_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_billing_total BEFORE INSERT OR UPDATE ON public.billing_items FOR EACH ROW EXECUTE FUNCTION calculate_billing_total();
CREATE TRIGGER update_billing_items_timestamp BEFORE UPDATE ON public.billing_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_claim_batches_timestamp BEFORE UPDATE ON public.claim_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_claim_items_timestamp BEFORE UPDATE ON public.claim_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rad_orders_timestamp BEFORE UPDATE ON public.radiology_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rad_results_timestamp BEFORE UPDATE ON public.radiology_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_theatre_bookings_timestamp BEFORE UPDATE ON public.theatre_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surgical_procedures_timestamp BEFORE UPDATE ON public.surgical_procedures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discharge_summaries_timestamp BEFORE UPDATE ON public.discharge_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_anc_reg_timestamp BEFORE UPDATE ON public.anc_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospital_departments_timestamp BEFORE UPDATE ON public.hospital_departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fhir_config_timestamp BEFORE UPDATE ON public.fhir_endpoint_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_endpoints_timestamp BEFORE UPDATE ON public.integration_endpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_templates_timestamp BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lab_panels_timestamp BEFORE UPDATE ON public.lab_panels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mortuary_records_timestamp BEFORE UPDATE ON public.mortuary_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dental_records_timestamp BEFORE UPDATE ON public.dental_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_physio_sessions_timestamp BEFORE UPDATE ON public.physiotherapy_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliveries_timestamp BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER platform_tenants_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_tenants FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER platform_tasks_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_onboarding_tasks FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_plans FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_subscriptions FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_invoices FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_payments FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_tickets FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_ticket_messages FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_members FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_incidents FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_integrations FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_jobs FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_backups FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER console_audit AFTER INSERT OR DELETE OR UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER draft_audit AFTER INSERT OR UPDATE ON public.platform_onboarding_drafts FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER execution_audit AFTER INSERT OR UPDATE ON public.platform_job_steps FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER execution_audit AFTER INSERT OR UPDATE ON public.platform_launch_evidence FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER execution_audit AFTER INSERT OR UPDATE ON public.platform_launch_approvals FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE TRIGGER snapshot_job BEFORE INSERT ON public.platform_jobs FOR EACH ROW EXECUTE FUNCTION platform_snapshot_job();
CREATE TRIGGER binding_audit AFTER INSERT OR UPDATE ON public.platform_tenant_bindings FOR EACH ROW EXECUTE FUNCTION audit_platform_change();
CREATE VIEW public."fluid_balance_daily" WITH(security_invoker=true) AS  SELECT admission_id,
    patient_id,
    chart_date,
    sum(
        CASE
            WHEN (entry_type = 'intake'::text) THEN volume_ml
            ELSE 0
        END) AS total_intake_ml,
    sum(
        CASE
            WHEN (entry_type = 'output'::text) THEN volume_ml
            ELSE 0
        END) AS total_output_ml,
    (sum(
        CASE
            WHEN (entry_type = 'intake'::text) THEN volume_ml
            ELSE 0
        END) - sum(
        CASE
            WHEN (entry_type = 'output'::text) THEN volume_ml
            ELSE 0
        END)) AS net_balance_ml
   FROM fluid_balance_charts
  GROUP BY admission_id, patient_id, chart_date;
ALTER TABLE public."admissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ai_suggestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."allergies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ambulance_dispatches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ambulance_fleet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."anc_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."anc_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."beds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."billing_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."blood_donations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."blood_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."blood_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."carelink_instance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."claim_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."claim_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."clinical_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."clinical_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."controlled_substance_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."data_access_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."dental_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."dhims2_indicator_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."dhims2_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."diagnoses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."diet_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."discharge_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."drug_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."drug_interactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."drugs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."encounters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fee_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fhir_endpoint_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fhir_resource_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fluid_balance_charts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."handover_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hospital_departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hospital_onboarding_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hospital_profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hospitals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_leaves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_payroll" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."hr_staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integration_endpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inventory_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inventory_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_panels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_specimens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_test_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."maternity_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."medical_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."medication_administration_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."mortuary_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nhia_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nhia_tariff_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nhis_cc_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nurse_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nursing_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nursing_care_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."offline_cache_manifest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patient_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patient_vitals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."physiotherapy_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_backups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_health_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_job_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_launch_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_launch_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_onboarding_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_onboarding_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_owners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_tenant_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_tenant_costs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_tenant_schema_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_ticket_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."postnatal_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."prescription_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."prescriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."problem_list" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."purchase_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."purchase_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."queue_management" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."radiology_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."radiology_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."record_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."registered_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."report_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."report_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_fees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."staff_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."surgical_procedures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sync_checkpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sync_conflicts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sync_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."theatre_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."theatre_operation_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."theatre_post_op" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."theatre_pre_op" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."theatre_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."triage_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."virtual_consultations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vitals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ward_rounds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."wards" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all referrals" ON public."referrals" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Doctors can create referrals" ON public."referrals" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'doctor'::text)))));
CREATE POLICY "Doctors can update received referrals" ON public."referrals" AS PERMISSIVE FOR UPDATE TO "public" USING(((auth.uid() = referred_to_doctor_id) OR (auth.uid() = referring_doctor_id) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "Doctors can view their referrals" ON public."referrals" AS PERMISSIVE FOR SELECT TO "public" USING((((auth.uid() = referring_doctor_id) OR (auth.uid() = referred_to_doctor_id)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))))));
CREATE POLICY "carelink_tenant_boundary" ON public."referrals" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "carelink_tenant_boundary" ON public."prescription_items" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "prescription_items_delete_restricted" ON public."prescription_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "prescription_items_insert_doctors_only" ON public."prescription_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text])));
CREATE POLICY "prescription_items_select_medical_staff" ON public."prescription_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'pharmacist'::text, 'nurse'::text])));
CREATE POLICY "prescription_items_update_medical_staff" ON public."prescription_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'pharmacist'::text]))) WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'pharmacist'::text])));
CREATE POLICY "carelink_tenant_boundary" ON public."users" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "carelink_users_delete_admin" ON public."users" AS RESTRICTIVE FOR DELETE TO "public" USING(is_tenant_admin());
CREATE POLICY "carelink_users_insert_admin" ON public."users" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK(is_tenant_admin());
CREATE POLICY "carelink_users_update_admin" ON public."users" AS RESTRICTIVE FOR UPDATE TO "public" USING(is_tenant_admin()) WITH CHECK(is_tenant_admin());
CREATE POLICY "users_delete_admin_only" ON public."users" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "users_insert_admin_only" ON public."users" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = 'admin'::text));
CREATE POLICY "users_select_authenticated" ON public."users" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "users_update_admin_only" ON public."users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = 'admin'::text)) WITH CHECK((get_user_role() = 'admin'::text));
CREATE POLICY "carelink_tenant_boundary" ON public."patients" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "patients_delete_admin_only" ON public."patients" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "patients_insert_medical_staff" ON public."patients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text])));
CREATE POLICY "patients_select_medical_staff" ON public."patients" AS PERMISSIVE FOR SELECT TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'pharmacist'::text, 'cashier'::text, 'records_officer'::text])));
CREATE POLICY "patients_update_medical_staff" ON public."patients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text]))) WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text])));
CREATE POLICY "Admin manage fee schedules" ON public."fee_schedules" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Staff view fee schedules" ON public."fee_schedules" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."fee_schedules" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "appointments_delete_authorized_staff" ON public."appointments" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text])));
CREATE POLICY "appointments_insert_medical_staff" ON public."appointments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text])));
CREATE POLICY "appointments_select_medical_staff" ON public."appointments" AS PERMISSIVE FOR SELECT TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text])));
CREATE POLICY "appointments_update_medical_staff" ON public."appointments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text]))) WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text])));
CREATE POLICY "carelink_tenant_boundary" ON public."appointments" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "audit_log_delete_admin_only" ON public."audit_log" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "audit_log_insert_all_staff" ON public."audit_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(true);
CREATE POLICY "audit_log_no_updates" ON public."audit_log" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(false);
CREATE POLICY "audit_log_select_all_staff" ON public."audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."audit_log" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Nurses can insert patient vitals" ON public."patient_vitals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['nurse'::text, 'admin'::text]))))));
CREATE POLICY "Nurses can update their own vitals records" ON public."patient_vitals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(((nurse_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "Nurses can view all patient vitals" ON public."patient_vitals" AS PERMISSIVE FOR SELECT TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['nurse'::text, 'doctor'::text, 'admin'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."patient_vitals" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Nurses and doctors can view all notes" ON public."nurse_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['nurse'::text, 'doctor'::text, 'admin'::text]))))));
CREATE POLICY "Nurses can delete their own notes" ON public."nurse_notes" AS PERMISSIVE FOR DELETE TO "authenticated" USING(((nurse_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "Nurses can insert notes" ON public."nurse_notes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['nurse'::text, 'admin'::text]))))));
CREATE POLICY "Nurses can update their own notes" ON public."nurse_notes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(((nurse_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "carelink_tenant_boundary" ON public."nurse_notes" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "carelink_tenant_boundary" ON public."medical_records" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "medical_records_insert" ON public."medical_records" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((((officer_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'records_officer'::text))))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "medical_records_select" ON public."medical_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['records_officer'::text, 'doctor'::text, 'nurse'::text, 'admin'::text]))))));
CREATE POLICY "medical_records_update" ON public."medical_records" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(((officer_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))))) WITH CHECK(((officer_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "carelink_tenant_boundary" ON public."record_requests" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "record_requests_insert" ON public."record_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['records_officer'::text, 'doctor'::text, 'admin'::text]))))));
CREATE POLICY "record_requests_select" ON public."record_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['records_officer'::text, 'doctor'::text, 'admin'::text]))))));
CREATE POLICY "record_requests_update" ON public."record_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['records_officer'::text, 'admin'::text])))))) WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['records_officer'::text, 'admin'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."hospitals" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospitals_insert_admin" ON public."hospitals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "hospitals_select_admin" ON public."hospitals" AS PERMISSIVE FOR SELECT TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "hospitals_update_admin" ON public."hospitals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))) WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_legacy_onboarding_boundary" ON public."hospital_onboarding_tasks" AS RESTRICTIVE FOR ALL TO "public" USING(false) WITH CHECK(false);
CREATE POLICY "carelink_tenant_boundary" ON public."hospital_onboarding_tasks" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_onboarding_tasks_insert_admin" ON public."hospital_onboarding_tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "hospital_onboarding_tasks_select_admin" ON public."hospital_onboarding_tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "hospital_onboarding_tasks_update_admin" ON public."hospital_onboarding_tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))) WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."anc_visits" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_anc_visits" ON public."anc_visits" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT anc_visits.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."maternity_deliveries" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_deliveries" ON public."maternity_deliveries" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT maternity_deliveries.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."postnatal_visits" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_postnatal" ON public."postnatal_visits" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT postnatal_visits.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."diet_orders" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_diet_orders" ON public."diet_orders" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT diet_orders.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "Doctors manage surgical procedures" ON public."surgical_procedures" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
CREATE POLICY "Staff view surgical procedures" ON public."surgical_procedures" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."surgical_procedures" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "carelink_tenant_boundary" ON public."notification_settings" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_notification_settings" ON public."notification_settings" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT notification_settings.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."notification_templates" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_notification_templates" ON public."notification_templates" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT notification_templates.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."notification_logs" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_notification_logs" ON public."notification_logs" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT notification_logs.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "Users can view own notifications" ON public."notifications" AS PERMISSIVE FOR SELECT TO "public" USING(((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "carelink_tenant_boundary" ON public."notifications" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access wards" ON public."wards" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."wards" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access beds" ON public."beds" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."beds" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access inventory_categories" ON public."inventory_categories" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."inventory_categories" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access inventory_items" ON public."inventory_items" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."inventory_items" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "carelink_tenant_boundary" ON public."service_fees" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "service_fees_delete" ON public."service_fees" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "service_fees_insert" ON public."service_fees" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = 'admin'::text));
CREATE POLICY "service_fees_select" ON public."service_fees" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "service_fees_update" ON public."service_fees" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = 'admin'::text)) WITH CHECK((get_user_role() = 'admin'::text));
CREATE POLICY "carelink_tenant_boundary" ON public."hr_leaves" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_hr_leaves" ON public."hr_leaves" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT hr_leaves.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."hr_payroll" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_hr_payroll" ON public."hr_payroll" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT hr_payroll.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."lab_test_catalog" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "lab_test_catalog_delete" ON public."lab_test_catalog" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "lab_test_catalog_insert" ON public."lab_test_catalog" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = 'admin'::text));
CREATE POLICY "lab_test_catalog_select" ON public."lab_test_catalog" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "lab_test_catalog_update" ON public."lab_test_catalog" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = 'admin'::text)) WITH CHECK((get_user_role() = 'admin'::text));
CREATE POLICY "carelink_tenant_boundary" ON public."hr_staff" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_hr_staff" ON public."hr_staff" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT hr_staff.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."hr_attendance" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_hr_attendance" ON public."hr_attendance" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT hr_attendance.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "console_boundary" ON public."platform_onboarding_tasks" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_onboarding_tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('onboarding.write'::text));
CREATE POLICY "console_read" ON public."platform_onboarding_tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "console_update" ON public."platform_onboarding_tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('onboarding.write'::text)) WITH CHECK(platform_can('onboarding.write'::text));
CREATE POLICY "carelink_tenant_boundary" ON public."ambulance_fleet" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_ambulance_fleet" ON public."ambulance_fleet" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT ambulance_fleet.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "console_boundary" ON public."platform_plans" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_plans" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('billing.write'::text));
CREATE POLICY "console_read" ON public."platform_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('billing.read'::text));
CREATE POLICY "console_update" ON public."platform_plans" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('billing.write'::text)) WITH CHECK(platform_can('billing.write'::text));
CREATE POLICY "carelink_tenant_boundary" ON public."ambulance_dispatches" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_ambulance_dispatches" ON public."ambulance_dispatches" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT ambulance_dispatches.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "Admin cashier manage billing items" ON public."billing_items" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'cashier'::text, 'doctor'::text]))))));
CREATE POLICY "Staff view billing items" ON public."billing_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."billing_items" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin view claim batches" ON public."claim_batches" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."claim_batches" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "console_boundary" ON public."platform_tickets" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_tickets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('support.write'::text));
CREATE POLICY "console_read" ON public."platform_tickets" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('support.read'::text));
CREATE POLICY "console_update" ON public."platform_tickets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('support.write'::text)) WITH CHECK(platform_can('support.write'::text));
CREATE POLICY "Doctors manage encounters" ON public."encounters" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'pharmacist'::text, 'cashier'::text, 'records_officer'::text, 'lab_tech'::text]))))));
CREATE POLICY "Staff view encounters" ON public."encounters" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."encounters" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Doctors manage diagnoses" ON public."diagnoses" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
CREATE POLICY "Staff view diagnoses" ON public."diagnoses" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."diagnoses" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff manage vitals" ON public."vitals" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view vitals" ON public."vitals" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."vitals" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff manage notes" ON public."clinical_notes" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view clinical notes" ON public."clinical_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."clinical_notes" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Doctors manage orders" ON public."clinical_orders" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
CREATE POLICY "Staff view orders" ON public."clinical_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."clinical_orders" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Doctors manage problem list" ON public."problem_list" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
CREATE POLICY "Staff view problem list" ON public."problem_list" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."problem_list" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "console_boundary" ON public."platform_incidents" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_incidents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "console_read" ON public."platform_incidents" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('operations.read'::text));
CREATE POLICY "console_update" ON public."platform_incidents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('operations.write'::text)) WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "Clinical staff manage allergies" ON public."allergies" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view allergies" ON public."allergies" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."allergies" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "console_boundary" ON public."platform_integrations" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_integrations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('settings.write'::text));
CREATE POLICY "console_read" ON public."platform_integrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('operations.read'::text));
CREATE POLICY "console_update" ON public."platform_integrations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('settings.write'::text)) WITH CHECK(platform_can('settings.write'::text));
CREATE POLICY "Clinical staff view MAR" ON public."medication_administration_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "Nurses manage MAR" ON public."medication_administration_records" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text, 'doctor'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."medication_administration_records" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff view fluid balance" ON public."fluid_balance_charts" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "Nurses manage fluid balance" ON public."fluid_balance_charts" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text, 'doctor'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."fluid_balance_charts" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "console_boundary" ON public."platform_settings" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('settings.write'::text));
CREATE POLICY "console_read" ON public."platform_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('settings.read'::text));
CREATE POLICY "console_update" ON public."platform_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('settings.write'::text)) WITH CHECK(platform_can('settings.write'::text));
CREATE POLICY "notifications_read" ON public."platform_notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING(((recipient_id = auth.uid()) AND (platform_role() IS NOT NULL)));
CREATE POLICY "notifications_update" ON public."platform_notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(((recipient_id = auth.uid()) AND (platform_role() IS NOT NULL))) WITH CHECK((recipient_id = auth.uid()));
CREATE POLICY "Authenticated read patient_transfers" ON public."patient_transfers" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "Nurse manage patient_transfers" ON public."patient_transfers" AS PERMISSIVE FOR ALL TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text, 'doctor'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."patient_transfers" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "console_boundary" ON public."platform_members" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('team.write'::text));
CREATE POLICY "console_read" ON public."platform_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('team.read'::text));
CREATE POLICY "console_update" ON public."platform_members" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('team.write'::text)) WITH CHECK(platform_can('team.write'::text));
CREATE POLICY "Nurses manage assessments" ON public."nursing_assessments" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view nursing assessments" ON public."nursing_assessments" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."nursing_assessments" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Nurses manage care plans" ON public."nursing_care_plans" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view care plans" ON public."nursing_care_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."nursing_care_plans" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage suppliers" ON public."suppliers" AS PERMISSIVE FOR ALL TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'pharmacist'::text]))))));
CREATE POLICY "Authenticated read suppliers" ON public."suppliers" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."suppliers" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "console_boundary" ON public."platform_subscriptions" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('billing.write'::text));
CREATE POLICY "console_read" ON public."platform_subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('billing.read'::text));
CREATE POLICY "console_update" ON public."platform_subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('billing.write'::text)) WITH CHECK(platform_can('billing.write'::text));
CREATE POLICY "console_boundary" ON public."platform_invoices" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_invoices" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('billing.write'::text));
CREATE POLICY "console_read" ON public."platform_invoices" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('billing.read'::text));
CREATE POLICY "console_update" ON public."platform_invoices" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('billing.write'::text)) WITH CHECK(platform_can('billing.write'::text));
CREATE POLICY "Admin manage purchase_orders" ON public."purchase_orders" AS PERMISSIVE FOR ALL TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'pharmacist'::text]))))));
CREATE POLICY "Authenticated read purchase_orders" ON public."purchase_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."purchase_orders" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage purchase_order_items" ON public."purchase_order_items" AS PERMISSIVE FOR ALL TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'pharmacist'::text]))))));
CREATE POLICY "Authenticated read purchase_order_items" ON public."purchase_order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."purchase_order_items" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "console_boundary" ON public."platform_payments" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_payments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('billing.write'::text));
CREATE POLICY "console_read" ON public."platform_payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('billing.read'::text));
CREATE POLICY "console_update" ON public."platform_payments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('billing.write'::text)) WITH CHECK(platform_can('billing.write'::text));
CREATE POLICY "console_boundary" ON public."platform_backups" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_backups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "console_read" ON public."platform_backups" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('operations.read'::text));
CREATE POLICY "console_update" ON public."platform_backups" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('operations.write'::text)) WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "console_boundary" ON public."platform_usage" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_usage" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "console_read" ON public."platform_usage" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "console_update" ON public."platform_usage" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('operations.write'::text)) WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "console_boundary" ON public."platform_health_checks" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_health_checks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "console_read" ON public."platform_health_checks" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('operations.read'::text));
CREATE POLICY "console_update" ON public."platform_health_checks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('operations.write'::text)) WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "console_boundary" ON public."platform_ticket_messages" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_ticket_messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('support.write'::text));
CREATE POLICY "console_read" ON public."platform_ticket_messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('support.read'::text));
CREATE POLICY "console_update" ON public."platform_ticket_messages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('support.write'::text)) WITH CHECK(platform_can('support.write'::text));
CREATE POLICY "message_author" ON public."platform_ticket_messages" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK((author_id = auth.uid()));
CREATE POLICY "Doctors manage ward rounds" ON public."ward_rounds" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
CREATE POLICY "Staff view ward rounds" ON public."ward_rounds" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."ward_rounds" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Nurses manage handover notes" ON public."handover_notes" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text]))))));
CREATE POLICY "Nurses view handover notes" ON public."handover_notes" AS PERMISSIVE FOR SELECT TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text, 'doctor'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."handover_notes" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage tariff catalog" ON public."nhia_tariff_catalog" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Staff view tariff catalog" ON public."nhia_tariff_catalog" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."nhia_tariff_catalog" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "carelink_tenant_boundary" ON public."claims" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "claims_delete_admin_only" ON public."claims" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "claims_insert_admin_only" ON public."claims" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'cashier'::text])));
CREATE POLICY "claims_select_admin_only" ON public."claims" AS PERMISSIVE FOR SELECT TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'cashier'::text])));
CREATE POLICY "claims_update_admin_only" ON public."claims" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'cashier'::text]))) WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'cashier'::text])));
CREATE POLICY "Admin view claim items" ON public."claim_items" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."claim_items" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin view nhia submissions" ON public."nhia_submissions" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."nhia_submissions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin cashier view payment allocations" ON public."payment_allocations" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'cashier'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."payment_allocations" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Doctors manage radiology orders" ON public."radiology_orders" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'lab_tech'::text]))))));
CREATE POLICY "Staff view radiology orders" ON public."radiology_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."radiology_orders" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Radiographers manage results" ON public."radiology_results" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'lab_tech'::text]))))));
CREATE POLICY "Staff view radiology results" ON public."radiology_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."radiology_results" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Doctors manage theatre bookings" ON public."theatre_bookings" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view theatre bookings" ON public."theatre_bookings" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."theatre_bookings" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "draft_read" ON public."platform_onboarding_drafts" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "carelink_tenant_boundary" ON public."prescriptions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "prescriptions_delete_restricted" ON public."prescriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "prescriptions_insert_doctors_only" ON public."prescriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text])));
CREATE POLICY "prescriptions_select_medical_staff" ON public."prescriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'pharmacist'::text, 'nurse'::text])));
CREATE POLICY "prescriptions_update_medical_staff" ON public."prescriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'pharmacist'::text]))) WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'pharmacist'::text])));
CREATE POLICY "Clinical staff manage discharge summaries" ON public."discharge_summaries" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text]))))));
CREATE POLICY "Staff view discharge summaries" ON public."discharge_summaries" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."discharge_summaries" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "carelink_tenant_boundary" ON public."payments" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "payments_delete_admin_only" ON public."payments" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "payments_insert_cashiers_only" ON public."payments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'cashier'::text])));
CREATE POLICY "payments_select_authorized_staff" ON public."payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'cashier'::text, 'doctor'::text, 'pharmacist'::text])));
CREATE POLICY "payments_update_finance_staff" ON public."payments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'cashier'::text]))) WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'cashier'::text])));
CREATE POLICY "Admin manage roles" ON public."roles" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Staff view roles" ON public."roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."roles" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff manage anc registrations" ON public."anc_registrations" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view anc registrations" ON public."anc_registrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."anc_registrations" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Staff view permissions" ON public."permissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."permissions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage role permissions" ON public."role_permissions" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Staff view role permissions" ON public."role_permissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."role_permissions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage departments" ON public."hospital_departments" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Staff view departments" ON public."hospital_departments" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."hospital_departments" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "System manage sessions" ON public."user_sessions" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Users view own sessions" ON public."user_sessions" AS PERMISSIVE FOR SELECT TO "public" USING(((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "carelink_tenant_boundary" ON public."user_sessions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff manage consent" ON public."consent_records" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'records_officer'::text]))))));
CREATE POLICY "Clinical staff view consent" ON public."consent_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."consent_records" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin view data access log" ON public."data_access_log" AS PERMISSIVE FOR SELECT TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "System insert data access log" ON public."data_access_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(true);
CREATE POLICY "carelink_tenant_boundary" ON public."data_access_log" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin view fhir log" ON public."fhir_resource_log" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."fhir_resource_log" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage fhir config" ON public."fhir_endpoint_config" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."fhir_endpoint_config" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage dhims2 mappings" ON public."dhims2_indicator_mappings" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."dhims2_indicator_mappings" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "execution_read" ON public."platform_launch_evidence" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "execution_read" ON public."platform_launch_approvals" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "console_boundary" ON public."platform_jobs" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_jobs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "console_job_requester" ON public."platform_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING(((requested_by = auth.uid()) AND (platform_role() IS NOT NULL)));
CREATE POLICY "console_read" ON public."platform_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('operations.read'::text));
CREATE POLICY "console_update" ON public."platform_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('operations.write'::text)) WITH CHECK(platform_can('operations.write'::text));
CREATE POLICY "execution_read" ON public."platform_job_steps" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "console_boundary" ON public."platform_tenants" AS RESTRICTIVE FOR ALL TO "public" USING((platform_role() IS NOT NULL)) WITH CHECK((platform_role() IS NOT NULL));
CREATE POLICY "console_insert" ON public."platform_tenants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(platform_can('hospitals.write'::text));
CREATE POLICY "console_read" ON public."platform_tenants" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "console_update" ON public."platform_tenants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING(platform_can('hospitals.write'::text)) WITH CHECK(platform_can('hospitals.write'::text));
CREATE POLICY "Admin manage dhims2 reports" ON public."dhims2_reports" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."dhims2_reports" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage integrations" ON public."integration_endpoints" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."integration_endpoints" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage report templates" ON public."report_templates" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Staff view report templates" ON public."report_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."report_templates" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Staff create report runs" ON public."report_runs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK(true);
CREATE POLICY "Staff view own report runs" ON public."report_runs" AS PERMISSIVE FOR SELECT TO "public" USING(((run_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "carelink_tenant_boundary" ON public."report_runs" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff view ai suggestions" ON public."ai_suggestions" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "System manage ai suggestions" ON public."ai_suggestions" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."ai_suggestions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Users manage own sync queue" ON public."sync_queue" AS PERMISSIVE FOR ALL TO "public" USING(((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "carelink_tenant_boundary" ON public."sync_queue" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage sync conflicts" ON public."sync_conflicts" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."sync_conflicts" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "binding_read" ON public."platform_tenant_bindings" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "schema_ledger_read" ON public."platform_tenant_schema_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('hospitals.read'::text));
CREATE POLICY "Users manage own cache manifest" ON public."offline_cache_manifest" AS PERMISSIVE FOR ALL TO "public" USING((user_id = auth.uid()));
CREATE POLICY "carelink_tenant_boundary" ON public."offline_cache_manifest" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage sync checkpoints" ON public."sync_checkpoints" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."sync_checkpoints" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Users manage own devices" ON public."registered_devices" AS PERMISSIVE FOR ALL TO "public" USING(((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "carelink_tenant_boundary" ON public."registered_devices" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Lab staff manage specimens" ON public."lab_specimens" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'lab_tech'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Lab staff view specimens" ON public."lab_specimens" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."lab_specimens" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage lab panels" ON public."lab_panels" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'lab_tech'::text]))))));
CREATE POLICY "Staff view lab panels" ON public."lab_panels" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."lab_panels" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "cost_read" ON public."platform_tenant_costs" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('billing.read'::text));
CREATE POLICY "Pharmacy staff manage batches" ON public."drug_batches" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'pharmacist'::text]))))));
CREATE POLICY "Pharmacy staff view batches" ON public."drug_batches" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."drug_batches" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin manage drug interactions" ON public."drug_interactions" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'pharmacist'::text]))))));
CREATE POLICY "Staff view drug interactions" ON public."drug_interactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."drug_interactions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Pharmacy staff manage controlled log" ON public."controlled_substance_log" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'pharmacist'::text]))))));
CREATE POLICY "Pharmacy staff view controlled log" ON public."controlled_substance_log" AS PERMISSIVE FOR SELECT TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'pharmacist'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."controlled_substance_log" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff manage mortuary" ON public."mortuary_records" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'records_officer'::text]))))));
CREATE POLICY "Clinical staff view mortuary" ON public."mortuary_records" AS PERMISSIVE FOR SELECT TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'records_officer'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."mortuary_records" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Doctors manage dental records" ON public."dental_records" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view dental records" ON public."dental_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."dental_records" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff manage physio" ON public."physiotherapy_sessions" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Staff view physio sessions" ON public."physiotherapy_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."physiotherapy_sessions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Cashier manage receipts" ON public."receipts" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'cashier'::text]))))));
CREATE POLICY "Staff view receipts" ON public."receipts" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."receipts" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Clinical staff manage deliveries" ON public."deliveries" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text]))))));
CREATE POLICY "Clinical staff view deliveries" ON public."deliveries" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."deliveries" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Staff manage cc codes" ON public."nhis_cc_codes" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'cashier'::text, 'records_officer'::text]))))));
CREATE POLICY "Staff view cc codes" ON public."nhis_cc_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."nhis_cc_codes" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "carelink_tenant_boundary" ON public."lab_tests" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "lab_tests_delete_admin_only" ON public."lab_tests" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "lab_tests_insert_doctors_only" ON public."lab_tests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text])));
CREATE POLICY "lab_tests_select_medical_staff" ON public."lab_tests" AS PERMISSIVE FOR SELECT TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'nurse'::text, 'lab_tech'::text])));
CREATE POLICY "lab_tests_update_medical_staff" ON public."lab_tests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'lab_tech'::text]))) WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'lab_tech'::text])));
CREATE POLICY "platform_audit_read" ON public."platform_audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING(platform_can('audit.read'::text));
CREATE POLICY "carelink_tenant_boundary" ON public."theatre_sessions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_theatre_sessions" ON public."theatre_sessions" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT theatre_sessions.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."theatre_pre_op" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_theatre_pre_op" ON public."theatre_pre_op" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT theatre_pre_op.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."theatre_operation_notes" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_theatre_op_notes" ON public."theatre_operation_notes" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT theatre_operation_notes.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "carelink_tenant_boundary" ON public."drugs" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "drugs_delete_admin_only" ON public."drugs" AS PERMISSIVE FOR DELETE TO "authenticated" USING((get_user_role() = 'admin'::text));
CREATE POLICY "drugs_insert_pharmacists_only" ON public."drugs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'pharmacist'::text])));
CREATE POLICY "drugs_select_medical_staff" ON public."drugs" AS PERMISSIVE FOR SELECT TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'doctor'::text, 'pharmacist'::text, 'nurse'::text])));
CREATE POLICY "drugs_update_pharmacists_only" ON public."drugs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((get_user_role() = ANY (ARRAY['admin'::text, 'pharmacist'::text]))) WITH CHECK((get_user_role() = ANY (ARRAY['admin'::text, 'pharmacist'::text])));
CREATE POLICY "carelink_tenant_boundary" ON public."theatre_post_op" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_theatre_post_op" ON public."theatre_post_op" AS PERMISSIVE FOR ALL TO "public" USING((hospital_id = ( SELECT theatre_post_op.hospital_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY "Admin full access inventory_transactions" ON public."inventory_transactions" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."inventory_transactions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access schedules" ON public."staff_schedules" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."staff_schedules" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access leave_requests" ON public."leave_requests" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."leave_requests" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access blood_inventory" ON public."blood_inventory" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."blood_inventory" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access blood_donations" ON public."blood_donations" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."blood_donations" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access blood_requests" ON public."blood_requests" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."blood_requests" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "View own virtual consultations" ON public."virtual_consultations" AS PERMISSIVE FOR ALL TO "public" USING(((doctor_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));
CREATE POLICY "carelink_tenant_boundary" ON public."virtual_consultations" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Allow public read access" ON public."hospital_profile" AS PERMISSIVE FOR SELECT TO "public" USING(true);
CREATE POLICY "carelink_tenant_boundary" ON public."hospital_profile" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "hospital_profile_insert_admin" ON public."hospital_profile" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "hospital_profile_select_public" ON public."hospital_profile" AS PERMISSIVE FOR SELECT TO "public" USING(true);
CREATE POLICY "hospital_profile_update_admin" ON public."hospital_profile" AS PERMISSIVE FOR UPDATE TO "authenticated" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))) WITH CHECK((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Admin full access admissions" ON public."admissions" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "carelink_tenant_boundary" ON public."admissions" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Staff can view queues" ON public."queue_management" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text, 'doctor'::text, 'pharmacist'::text, 'cashier'::text, 'records_officer'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."queue_management" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
CREATE POLICY "Admin full access triage" ON public."triage_assessments" AS PERMISSIVE FOR ALL TO "public" USING((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'nurse'::text, 'doctor'::text]))))));
CREATE POLICY "carelink_tenant_boundary" ON public."triage_assessments" AS RESTRICTIVE FOR ALL TO "public" USING(is_tenant_user()) WITH CHECK(is_tenant_user());
-- Fixture grants are deliberately broad to exercise restrictive isolation, not a production grant replica.
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
