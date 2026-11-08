-- Synthetic gate fixtures, not operational verification evidence.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.platform_launch_shared_hospital('10000000-0000-0000-0000-000000000001',1);
  RAISE EXCEPTION 'Launch accepted missing evidence/subscription';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Resolve launch blockers first' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
INSERT INTO public.platform_plans(id,name,code,monthly_price,annual_price) VALUES('30000000-0000-0000-0000-000000000001','Synthetic','synthetic',0,0);
INSERT INTO public.platform_subscriptions(tenant_id,plan_id,billing_cycle,status,currency,amount,period_start,period_end)
 VALUES('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','monthly','trialing','GHS',0,current_date,current_date+30);
INSERT INTO public.platform_launch_evidence(tenant_id,revision,kind,reference,actor_id)
 SELECT '10000000-0000-0000-0000-000000000001',1,k,'Synthetic test evidence only','00000000-0000-0000-0000-000000000009'
 FROM unnest(ARRAY['deployment','isolation','admin_acceptance','account_protection','backup_restore','clinical','training','support']) k;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF jsonb_array_length(public.platform_readiness('10000000-0000-0000-0000-000000000001')->'blockers')<>0 THEN RAISE EXCEPTION 'Synthetic prerequisites incomplete'; END IF;
END $$;
DO $$ BEGIN
 BEGIN
  PERFORM public.platform_launch_shared_hospital('10000000-0000-0000-0000-000000000001',1);
  RAISE EXCEPTION 'Launch accepted without approval';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Current owner approval required' THEN RAISE; END IF; END;
 PERFORM public.platform_approve_launch('10000000-0000-0000-0000-000000000001',1,'Synthetic approval');
 PERFORM public.platform_record_shared_verification('10000000-0000-0000-0000-000000000001',1,'isolation','Updated synthetic evidence');
 BEGIN
  PERFORM public.platform_launch_shared_hospital('10000000-0000-0000-0000-000000000001',1);
  RAISE EXCEPTION 'Evidence update retained approval';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Current owner approval required' THEN RAISE; END IF; END;
 PERFORM public.platform_approve_launch('10000000-0000-0000-0000-000000000001',1,'Synthetic approval after evidence');
 PERFORM public.platform_launch_shared_hospital('10000000-0000-0000-0000-000000000001',1);
 PERFORM public.platform_launch_shared_hospital('10000000-0000-0000-0000-000000000001',1);
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.platform_launch_shared_hospital('10000000-0000-0000-0000-000000000001',1);
  RAISE EXCEPTION 'Hospital administrator launched without owner permission';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Owner permission required' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_tenants WHERE id='10000000-0000-0000-0000-000000000001' AND status='live' AND lifecycle_state='active' AND provisioned_at IS NOT NULL) THEN RAISE EXCEPTION 'Approved hospital did not launch'; END IF;
END $$;
