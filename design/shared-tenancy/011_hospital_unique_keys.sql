-- DRAFT: natural keys are unique within a hospital, not across all hospitals.
BEGIN;
DO $$ DECLARE c record; names text; BEGIN
 FOR c IN SELECT k.oid,k.conrelid,k.conname,k.conkey,t.relname
 FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid
 JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname='public' AND k.contype='u'
 AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=t.oid AND a.attname='tenant_id' AND NOT a.attisdropped)
 AND t.relname NOT LIKE 'platform_%'
 AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=t.oid AND a.attnum=ANY(k.conkey) AND a.attname='tenant_id')
 LOOP
  SELECT string_agg(quote_ident(a.attname),',' ORDER BY cols.ordinality) INTO names
  FROM unnest(c.conkey) WITH ORDINALITY cols(num,ordinality)
  JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=cols.num;
  -- RESTRICT deliberately fails if a reference still depends on a global key.
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',c.relname,c.conname);
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE(tenant_id,%s)',c.relname,c.conname,names);
 END LOOP;
END $$;
COMMIT;
