-- Disposable platform database with migrations 017-026 only. Rolls back fixtures.
BEGIN;
DO $$
DECLARE actor uuid:=gen_random_uuid(); reader uuid:=gen_random_uuid(); tenant uuid:=gen_random_uuid(); job uuid:=gen_random_uuid(); token uuid:=gen_random_uuid(); rejected boolean;
BEGIN
 INSERT INTO auth.users(id) VALUES(actor);
 INSERT INTO public.platform_owners(user_id) VALUES(actor);
 UPDATE public.carelink_instance SET instance_kind='platform',enabled=true;
 INSERT INTO public.platform_tenants(id,hospital_name,owner_email) VALUES(tenant,'Synthetic metadata test','test@example.invalid');
 INSERT INTO public.platform_onboarding_drafts(tenant_id,updated_by) VALUES(tenant,actor);
 INSERT INTO public.platform_jobs(id,tenant_id,kind,reason,request_key,requested_by,status,lease_token,lease_until)
 VALUES(job,tenant,'provision','Local regression test',gen_random_uuid(),actor,'running',token,now()+interval '90 seconds');
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 PERFORM set_config('request.jwt.claim.role','',true);
 PERFORM public.platform_worker_record(job,token,'platform_record_binding',jsonb_build_object('p_tenant_id',tenant,'p_state',jsonb_build_object('provider_status','creating','health_status','healthy','last_error','old error')));
 PERFORM public.platform_worker_record(job,token,'platform_record_binding',jsonb_build_object('p_tenant_id',tenant,'p_state',jsonb_build_object('admin_invitation_status','requested','last_error',null)));
 IF NOT EXISTS(SELECT 1 FROM public.platform_tenant_bindings WHERE tenant_id=tenant AND provider_status='creating' AND health_status='healthy' AND admin_invitation_status='requested' AND last_error IS NULL) THEN RAISE EXCEPTION 'Partial update corrupted state'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.platform_worker_record(job,gen_random_uuid(),'platform_record_health',jsonb_build_object('p_tenant_id',tenant,'p_status','healthy','p_latency',1));
 EXCEPTION WHEN OTHERS THEN rejected:=SQLERRM='Lease lost'; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Wrong lease accepted'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.platform_worker_record(job,token,'platform_record_health',jsonb_build_object('p_tenant_id',gen_random_uuid(),'p_status','healthy','p_latency',1));
 EXCEPTION WHEN OTHERS THEN rejected:=SQLERRM='Hospital unavailable'; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-hospital write accepted'; END IF;
 UPDATE public.platform_onboarding_drafts SET revision=2 WHERE tenant_id=tenant;
 rejected:=false;
 BEGIN
  PERFORM public.platform_worker_record(job,token,'platform_record_health',jsonb_build_object('p_tenant_id',tenant,'p_status','healthy','p_latency',1));
 EXCEPTION WHEN OTHERS THEN rejected:=SQLERRM='Requirements changed'; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Stale revision accepted'; END IF;
 IF has_function_privilege('authenticated','public.platform_worker_record(uuid,uuid,text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.platform_worker_record(uuid,uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Browser can call worker write'; END IF;
 IF has_function_privilege('service_role','public.platform_record_binding(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Worker can bypass fenced RPC'; END IF;
 INSERT INTO auth.users(id) VALUES(reader);
 INSERT INTO public.platform_members(user_id,email,role) VALUES(reader,'support@example.invalid','support_officer');
 PERFORM set_config('request.jwt.claim.sub',reader::text,true);
 IF public.platform_hospital_status(tenant)->'binding' ? 'estimated_monthly_cost' THEN RAISE EXCEPTION 'Support reader received financial data'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 IF NOT (public.platform_hospital_status(tenant)->'binding' ? 'estimated_monthly_cost') THEN RAISE EXCEPTION 'Owner financial access lost'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 rejected:=false;
 BEGIN
  PERFORM public.platform_hospital_status(tenant);
 EXCEPTION WHEN OTHERS THEN rejected:=SQLERRM='Not authorized'; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unassigned user can inspect hospital'; END IF;
 IF has_column_privilege('authenticated','public.platform_tenant_bindings','estimated_monthly_cost','SELECT')
 OR has_column_privilege('authenticated','public.platform_tenant_bindings','cost_currency','SELECT') THEN
  RAISE EXCEPTION 'Direct column grants bypass financial redaction';
 END IF;
 IF NOT has_column_privilege('authenticated','public.platform_tenant_bindings','provider_status','SELECT') THEN
  RAISE EXCEPTION 'Operational metadata grant lost';
 END IF;
END $$;
ROLLBACK;
