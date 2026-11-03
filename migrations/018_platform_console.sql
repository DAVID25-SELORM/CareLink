-- Platform console. Requires 017. Review and approve before production execution.
BEGIN;
CREATE TABLE public.platform_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  email text NOT NULL, full_name text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('platform_admin','finance_manager','support_officer','technical_admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.platform_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN public.is_platform_owner() THEN 'platform_owner' ELSE (
   SELECT m.role FROM public.platform_members m, public.carelink_instance i
   WHERE m.user_id=auth.uid() AND m.status='active' AND i.singleton AND i.enabled AND i.instance_kind='platform'
 ) END;
$$;
CREATE OR REPLACE FUNCTION public.platform_can(p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE(CASE public.platform_role()
 WHEN 'platform_owner' THEN true
 WHEN 'platform_admin' THEN p_permission = ANY(ARRAY['overview.read','hospitals.read','hospitals.write','onboarding.write','billing.read','support.read','support.write','operations.read','notifications.read','audit.read','settings.read'])
 WHEN 'finance_manager' THEN p_permission = ANY(ARRAY['overview.read','hospitals.read','billing.read','billing.write','notifications.read','audit.read'])
 WHEN 'support_officer' THEN p_permission = ANY(ARRAY['overview.read','hospitals.read','support.read','support.write','operations.read','notifications.read'])
 WHEN 'technical_admin' THEN p_permission = ANY(ARRAY['overview.read','hospitals.read','onboarding.write','operations.read','operations.write','notifications.read','audit.read','settings.read'])
 ELSE false END, false);
$$;
CREATE OR REPLACE FUNCTION public.is_tenant_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.users u, public.carelink_instance i
 WHERE u.id=auth.uid() AND i.singleton AND i.enabled AND i.instance_kind='tenant'
 AND NOT EXISTS(SELECT 1 FROM public.platform_owners p WHERE p.user_id=auth.uid())
 AND NOT EXISTS(SELECT 1 FROM public.platform_members m WHERE m.user_id=auth.uid()));
$$;
CREATE OR REPLACE FUNCTION public.get_carelink_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN public.platform_role() IS NOT NULL THEN jsonb_build_object('role',public.platform_role(),'scope','platform')
 WHEN public.is_tenant_user() THEN (SELECT jsonb_build_object('role',role,'scope','tenant') FROM public.users WHERE id=auth.uid())
 ELSE jsonb_build_object('role',null,'scope',null) END;
$$;
REVOKE ALL ON FUNCTION public.platform_role(), public.platform_can(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_role(), public.platform_can(text) TO authenticated;

ALTER TABLE public.platform_tenants ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'onboarding' CHECK (lifecycle_state IN ('onboarding','active','suspended','archived'));
ALTER TABLE public.platform_tenants ADD COLUMN IF NOT EXISTS admin_user_id uuid;
ALTER TABLE public.platform_tenants ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '';
ALTER TABLE public.platform_tenants ADD COLUMN IF NOT EXISTS facility_type text NOT NULL DEFAULT 'hospital';
ALTER TABLE public.platform_tenants ADD COLUMN IF NOT EXISTS request_key uuid UNIQUE;
ALTER TABLE public.platform_tenants ADD COLUMN IF NOT EXISTS provisioned_at timestamptz;
ALTER TABLE public.platform_tenants ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
-- Do not infer that legacy 'live' directory rows are remotely provisioned.

CREATE TABLE public.platform_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name))>0),
 code text NOT NULL UNIQUE, currency text NOT NULL DEFAULT 'GHS' CHECK(currency ~ '^[A-Z]{3}$'),
 monthly_price numeric(14,2) NOT NULL CHECK(monthly_price>=0), annual_price numeric(14,2) NOT NULL CHECK(annual_price>=0),
 trial_days integer NOT NULL DEFAULT 14 CHECK(trial_days BETWEEN 0 AND 365),
 grace_days integer NOT NULL DEFAULT 7 CHECK(grace_days BETWEEN 0 AND 90),
 modules text[] NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL UNIQUE REFERENCES public.platform_tenants(id),
 plan_id uuid NOT NULL REFERENCES public.platform_plans(id),
 billing_cycle text NOT NULL CHECK(billing_cycle IN ('monthly','annual')),
 status text NOT NULL CHECK(status IN ('trialing','active','past_due','cancelled')),
 currency text NOT NULL, amount numeric(14,2) NOT NULL CHECK(amount>=0),
 period_start date NOT NULL, period_end date NOT NULL, trial_end date, grace_days integer NOT NULL DEFAULT 7,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(period_end>period_start)
);
CREATE SEQUENCE public.platform_invoice_number;
CREATE TABLE public.platform_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 subscription_id uuid NOT NULL REFERENCES public.platform_subscriptions(id),
 number text NOT NULL UNIQUE DEFAULT ('CL-' || lpad(nextval('public.platform_invoice_number')::text,7,'0')),
 currency text NOT NULL, amount numeric(14,2) NOT NULL CHECK(amount>=0), paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(paid_amount>=0 AND paid_amount<=amount),
 status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','paid','void')),
 period_start date NOT NULL, period_end date NOT NULL, due_date date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(subscription_id,period_start), CHECK(period_end>period_start)
);
CREATE TABLE public.platform_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES public.platform_invoices(id),
 tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id), currency text NOT NULL,
 amount numeric(14,2) NOT NULL CHECK(amount>0), provider text NOT NULL CHECK(provider IN ('manual','paystack','flutterwave')),
 reference text NOT NULL CHECK(length(trim(reference))>0), recorded_by uuid REFERENCES auth.users(id),
 note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,reference)
);
CREATE TABLE public.platform_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES public.platform_tenants(id),
 subject text NOT NULL CHECK(length(trim(subject))>0), description text NOT NULL DEFAULT '',
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','waiting','resolved','closed')),
 assigned_to uuid REFERENCES public.platform_members(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_ticket_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES public.platform_tickets(id),
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 8000), author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, summary text NOT NULL DEFAULT '',
 severity text NOT NULL CHECK(severity IN ('minor','major','critical')),
 status text NOT NULL DEFAULT 'investigating' CHECK(status IN ('investigating','identified','monitoring','resolved')),
 resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 active_users integer NOT NULL CHECK(active_users>=0), storage_bytes bigint NOT NULL CHECK(storage_bytes>=0),
 encounter_count bigint NOT NULL CHECK(encounter_count>=0), source text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_health_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES public.platform_tenants(id),
 service text NOT NULL, status text NOT NULL CHECK(status IN ('healthy','degraded','down')),
 latency_ms integer CHECK(latency_ms>=0), detail text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_integrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('paystack','flutterwave','tenant_agent','provisioning','backup')),
 enabled boolean NOT NULL DEFAULT false, notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES public.platform_tenants(id),
 kind text NOT NULL CHECK(kind IN ('invite_admin','invite_platform','provision','go_live','suspend','reactivate','apply_modules','backup','restore','collect_usage','health_check')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','blocked')),
 payload jsonb NOT NULL DEFAULT '{}', result jsonb, error text,
 reason text NOT NULL CHECK(length(trim(reason))>=5), request_key uuid NOT NULL UNIQUE,
 requested_by uuid NOT NULL REFERENCES auth.users(id), attempts integer NOT NULL DEFAULT 0,
 lease_token uuid, lease_until timestamptz, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_jobs_queue ON public.platform_jobs(status,created_at);
CREATE TABLE public.platform_backups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id),
 job_id uuid NOT NULL UNIQUE REFERENCES public.platform_jobs(id), provider_reference text NOT NULL,
 status text NOT NULL CHECK(status IN ('available','expired')), expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL REFERENCES auth.users(id),
 title text NOT NULL, body text NOT NULL, path text NOT NULL DEFAULT '/platform',
 dedupe_key text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(recipient_id,dedupe_key)
);
CREATE TABLE public.platform_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), singleton boolean NOT NULL UNIQUE DEFAULT true CHECK(singleton),
 display_name text NOT NULL DEFAULT 'CareLink', support_email text NOT NULL DEFAULT '',
 renewal_notice_days integer NOT NULL DEFAULT 14 CHECK(renewal_notice_days BETWEEN 1 AND 90),
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.platform_settings(singleton) VALUES(true);

-- Every domain table is protected, including when legacy permissive policies exist.
DO $$ DECLARE spec record; BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('platform_tenants','hospitals.read','hospitals.write'),
 ('platform_onboarding_tasks','hospitals.read','onboarding.write'),
 ('platform_plans','billing.read','billing.write'), ('platform_subscriptions','billing.read','billing.write'),
 ('platform_invoices','billing.read','billing.write'), ('platform_payments','billing.read','billing.write'),
 ('platform_tickets','support.read','support.write'), ('platform_ticket_messages','support.read','support.write'),
 ('platform_members','team.read','team.write'), ('platform_incidents','operations.read','operations.write'),
 ('platform_usage','hospitals.read','operations.write'), ('platform_health_checks','operations.read','operations.write'),
 ('platform_integrations','operations.read','settings.write'), ('platform_jobs','operations.read','operations.write'),
 ('platform_backups','operations.read','operations.write'), ('platform_settings','settings.read','settings.write')
 ) AS t(tab,rd,wr) LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',spec.tab);
   EXECUTE format('DROP POLICY IF EXISTS platform_owner_access ON public.%I',spec.tab);
   EXECUTE format('DROP POLICY IF EXISTS platform_owner_boundary ON public.%I',spec.tab);
   EXECUTE format('CREATE POLICY console_read ON public.%I FOR SELECT TO authenticated USING(public.platform_can(%L))',spec.tab,spec.rd);
   EXECUTE format('CREATE POLICY console_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.platform_can(%L))',spec.tab,spec.wr);
   EXECUTE format('CREATE POLICY console_update ON public.%I FOR UPDATE TO authenticated USING(public.platform_can(%L)) WITH CHECK(public.platform_can(%L))',spec.tab,spec.wr,spec.wr);
   EXECUTE format('CREATE POLICY console_boundary ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING(public.platform_role() IS NOT NULL) WITH CHECK(public.platform_role() IS NOT NULL)',spec.tab);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO authenticated',spec.tab);
   EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated',spec.tab);
   IF spec.tab NOT IN ('platform_usage','platform_health_checks','platform_tenants','platform_onboarding_tasks') THEN
     EXECUTE format('CREATE TRIGGER console_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change()',spec.tab);
   END IF;
 END LOOP;
END $$;
-- Jobs are also visible to the hospital admins/finance who requested them.
CREATE POLICY console_job_requester ON public.platform_jobs FOR SELECT TO authenticated USING(requested_by=auth.uid() AND public.platform_role() IS NOT NULL);
DROP POLICY platform_audit_read ON public.platform_audit_log;
CREATE POLICY platform_audit_read ON public.platform_audit_log FOR SELECT TO authenticated USING(public.platform_can('audit.read'));
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.platform_notifications TO authenticated;
GRANT UPDATE(read_at) ON public.platform_notifications TO authenticated;
CREATE POLICY notifications_read ON public.platform_notifications FOR SELECT TO authenticated USING(recipient_id=auth.uid() AND public.platform_role() IS NOT NULL);
CREATE POLICY notifications_update ON public.platform_notifications FOR UPDATE TO authenticated USING(recipient_id=auth.uid() AND public.platform_role() IS NOT NULL) WITH CHECK(recipient_id=auth.uid());
-- Sensitive state is writable ONLY by the checked transactional commands below.
REVOKE INSERT,UPDATE ON public.platform_members,public.platform_subscriptions,public.platform_invoices,public.platform_payments,
 public.platform_jobs,public.platform_backups,public.platform_usage,public.platform_health_checks,public.platform_tenants FROM authenticated;
GRANT UPDATE(hospital_name,branch_location,contact_person,contact_phone,contact_email,owner_full_name,owner_phone,public_url,notes,region,facility_type) ON public.platform_tenants TO authenticated;
REVOKE UPDATE ON public.platform_ticket_messages FROM authenticated;
CREATE POLICY message_author ON public.platform_ticket_messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid());

CREATE FUNCTION public.platform_register_hospital(p_name text,p_email text,p_region text,p_request_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

CREATE FUNCTION public.platform_assign_subscription(p_tenant_id uuid,p_plan_id uuid,p_cycle text,p_trial boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

CREATE FUNCTION public.platform_generate_invoice(p_subscription_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

CREATE FUNCTION public.platform_renew_subscription(p_id uuid,p_expected_end date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.platform_subscriptions;
BEGIN
 IF NOT public.platform_can('billing.write') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO s FROM public.platform_subscriptions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR s.status='cancelled' OR s.status='trialing' THEN RAISE EXCEPTION 'Subscription cannot be renewed'; END IF;
 IF s.period_end<>p_expected_end THEN RETURN; END IF;
 IF s.period_end>current_date THEN RAISE EXCEPTION 'Renewal period has not started'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_invoices WHERE subscription_id=s.id AND period_start=s.period_start AND status='paid') THEN RAISE EXCEPTION 'Current period must be invoiced and paid before renewal'; END IF;
 UPDATE public.platform_subscriptions SET period_start=s.period_end,period_end=(s.period_end+CASE WHEN s.billing_cycle='annual' THEN interval '1 year' ELSE interval '1 month' END)::date,status='active' WHERE id=s.id;
END $$;

CREATE FUNCTION public.platform_reconcile_payment(p_invoice_id uuid,p_amount numeric,p_reference text,p_note text,p_provider text DEFAULT 'manual')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

CREATE FUNCTION public.platform_billing_action(p_kind text,p_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.platform_can('billing.write') OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'Permission and reason required'; END IF;
 IF p_kind='cancel_subscription' THEN UPDATE public.platform_subscriptions SET status='cancelled' WHERE id=p_id;
 ELSIF p_kind='void_invoice' THEN UPDATE public.platform_invoices SET status='void' WHERE id=p_id AND paid_amount=0 AND status='issued';
 ELSE RAISE EXCEPTION 'Unsupported billing action'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Record unavailable or action not allowed'; END IF;
 INSERT INTO public.platform_audit_log(actor_id,table_name,operation,record_id,new_values) VALUES(auth.uid(),'billing',p_kind,p_id,jsonb_build_object('reason',p_reason,'outcome','succeeded'));
END $$;

CREATE FUNCTION public.platform_set_member(p_id uuid,p_role text,p_status text,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_platform_owner() OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'Owner permission and reason required'; END IF;
 UPDATE public.platform_members SET role=p_role,status=p_status WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 INSERT INTO public.platform_audit_log(actor_id,table_name,operation,record_id,new_values) VALUES(auth.uid(),'platform_members','change_access',p_id,jsonb_build_object('reason',p_reason,'outcome','succeeded'));
END $$;

CREATE FUNCTION public.platform_request_job(p_kind text,p_tenant_id uuid,p_payload jsonb,p_reason text,p_request_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

CREATE FUNCTION public.platform_retry_job(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.platform_jobs;
BEGIN
 SELECT * INTO j FROM public.platform_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job unavailable'; END IF;
 IF NOT public.platform_can(CASE WHEN j.kind='invite_platform' THEN 'team.write' WHEN j.kind IN ('invite_admin','provision','go_live','apply_modules') THEN 'onboarding.write' ELSE 'operations.write' END) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF j.status NOT IN ('failed','blocked') THEN RAISE EXCEPTION 'Only failed or blocked jobs can be retried'; END IF;
 UPDATE public.platform_jobs SET status='queued',error=null,lease_token=null,lease_until=null WHERE id=j.id;
END $$;

CREATE FUNCTION public.platform_archive_hospital(p_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.platform_can('hospitals.write') OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'Permission and reason required'; END IF;
 PERFORM 1 FROM public.platform_tenants WHERE id=p_id AND lifecycle_state IN ('onboarding','suspended') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Suspend an active hospital before archiving'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_jobs WHERE tenant_id=p_id AND status IN ('queued','running')) THEN RAISE EXCEPTION 'Resolve queued operations before archiving'; END IF;
 UPDATE public.platform_tenants SET lifecycle_state='archived' WHERE id=p_id;
 INSERT INTO public.platform_audit_log(actor_id,table_name,operation,record_id,new_values) VALUES(auth.uid(),'platform_tenants','archive',p_id,jsonb_build_object('reason',p_reason,'outcome','succeeded'));
END $$;

CREATE FUNCTION public.platform_search(p_query text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
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
END $$;

CREATE FUNCTION public.platform_run_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

-- All browser RPCs explicitly enforce permissions. No implicit PUBLIC execution.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('platform_register_hospital','platform_assign_subscription','platform_generate_invoice','platform_renew_subscription','platform_reconcile_payment','platform_billing_action','platform_set_member','platform_request_job','platform_retry_job','platform_archive_hospital','platform_search','platform_run_reminders')
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END LOOP;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.platform_reconcile_payment(uuid,numeric,text,text,text) TO service_role;
  END IF;
END $$;
COMMIT;
