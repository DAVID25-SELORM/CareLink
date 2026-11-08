-- DRAFT: new staff assignments must belong to the same hospital.
BEGIN;
CREATE FUNCTION public.hospital_check_staff_reference() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE field text; staff uuid; tenant uuid:=(to_jsonb(NEW)->>'tenant_id')::uuid;
BEGIN
 FOREACH field IN ARRAY TG_ARGV LOOP
  staff:=(to_jsonb(NEW)->>field)::uuid;
  IF staff IS NULL THEN CONTINUE; END IF;
  IF TG_OP='UPDATE' THEN
   IF (to_jsonb(OLD)->>field) IS NOT DISTINCT FROM (to_jsonb(NEW)->>field)
   AND (to_jsonb(OLD)->>'tenant_id') IS NOT DISTINCT FROM (to_jsonb(NEW)->>'tenant_id') THEN CONTINUE; END IF;
  END IF;
  PERFORM 1 FROM public.hospital_memberships WHERE tenant_id=tenant AND user_id=staff AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff member is not active in this hospital' USING ERRCODE='23503'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hospital_check_staff_reference() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT c.relname,string_agg(DISTINCT quote_literal(a.attname),',') AS fields
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=ANY(k.conkey)
 WHERE k.contype='f' AND k.confrelid='public.users'::regclass AND n.nspname='public'
 AND c.relname NOT LIKE 'platform_%'
 -- Platform creation and security attribution are not staff assignment.
 AND c.relname NOT IN ('hospitals','audit_log','data_access_log')
 AND EXISTS(SELECT 1 FROM pg_attribute ta WHERE ta.attrelid=c.oid AND ta.attname='tenant_id' AND NOT ta.attisdropped)
 GROUP BY c.relname LOOP
 EXECUTE format('CREATE TRIGGER hospital_staff_boundary BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hospital_check_staff_reference(%s)',t.relname,t.fields);
 END LOOP;
END $$;
COMMIT;
