-- Runs inside the full-schema test transaction, with synthetic owner/tenants.
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000011','a@example.invalid',now()),
 ('00000000-0000-0000-0000-000000000012','wrong@example.invalid',now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
SELECT set_config('test.invitation',public.platform_invite_shared_administrator('10000000-0000-0000-0000-000000000001',1)::text,true);
DO $$ BEGIN
 IF public.platform_invite_shared_administrator('10000000-0000-0000-0000-000000000001',1)::text<>current_setting('test.invitation') THEN RAISE EXCEPTION 'Invitation retry duplicated'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',true);
DO $$ BEGIN
 IF jsonb_array_length(public.hospital_pending_invitations())<>0 THEN RAISE EXCEPTION 'Foreign invitation disclosed'; END IF;
 BEGIN
  PERFORM public.hospital_accept_invitation(current_setting('test.invitation')::uuid);
  RAISE EXCEPTION 'Foreign recipient accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Invitation unavailable' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=NULL WHERE id='00000000-0000-0000-0000-000000000011';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.hospital_accept_invitation(current_setting('test.invitation')::uuid);
  RAISE EXCEPTION 'Unverified recipient accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Invitation unavailable' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=now() WHERE id='00000000-0000-0000-0000-000000000011';
UPDATE public.platform_hospital_invitations SET expires_at=now()-interval '1 second';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.hospital_accept_invitation(current_setting('test.invitation')::uuid);
  RAISE EXCEPTION 'Expired invitation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Invitation unavailable' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE public.platform_hospital_invitations SET expires_at=now()+interval '1 day';
UPDATE public.platform_onboarding_drafts SET revision=2 WHERE tenant_id='10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.hospital_accept_invitation(current_setting('test.invitation')::uuid);
  RAISE EXCEPTION 'Stale invitation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Invitation unavailable' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE public.platform_onboarding_drafts SET revision=1 WHERE tenant_id='10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT public.hospital_accept_invitation(current_setting('test.invitation')::uuid);
SELECT public.hospital_accept_invitation(current_setting('test.invitation')::uuid);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.hospital_membership_audit WHERE user_id='00000000-0000-0000-0000-000000000011')<>1 THEN RAISE EXCEPTION 'Acceptance retry duplicated audit'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.hospital_memberships WHERE tenant_id='10000000-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-000000000011' AND role='admin') THEN RAISE EXCEPTION 'Administrator membership missing'; END IF;
END $$;
