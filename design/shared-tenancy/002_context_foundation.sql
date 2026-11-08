-- DRAFT: isolated validation only; requires 001. No clinical policies are altered.
BEGIN;
CREATE FUNCTION public.current_hospital_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE headers jsonb; tenant uuid;
BEGIN
 BEGIN
  headers:=NULLIF(current_setting('request.headers',true),'')::jsonb;
  tenant:=(headers->>'x-carelink-hospital')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
 END;
 IF tenant IS NULL OR public.hospital_role(tenant) IS NULL THEN RETURN NULL; END IF;
 RETURN tenant;
END $$;
-- Request-scoped context prevents one browser tab changing another tab's hospital.
-- The header selects a hospital but never grants membership.
REVOKE ALL ON FUNCTION public.current_hospital_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_hospital_id() TO authenticated;
COMMIT;
