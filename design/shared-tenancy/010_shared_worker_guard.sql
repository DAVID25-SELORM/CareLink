-- DRAFT: block dedicated-infrastructure jobs when the database is shared.
-- Existing dedicated worker operations are not shared-hospital provisioning.
BEGIN;
CREATE FUNCTION public.guard_shared_infrastructure_job() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.carelink_instance WHERE singleton AND instance_kind='shared')
 AND NEW.status IN ('queued','running') THEN
   RAISE EXCEPTION 'Dedicated infrastructure jobs are disabled for shared hospitals';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_shared_infrastructure_job() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER shared_infrastructure_guard BEFORE INSERT OR UPDATE ON public.platform_jobs
 FOR EACH ROW EXECUTE FUNCTION public.guard_shared_infrastructure_job();
-- Activation must wait for all running workers to stop. An already dispatched
-- provider request cannot be cancelled by a PostgreSQL trigger.
CREATE FUNCTION public.guard_shared_activation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.instance_kind='shared' AND EXISTS(
   SELECT 1 FROM public.platform_jobs WHERE status IN ('queued','running')
 ) THEN RAISE EXCEPTION 'Stop workers and resolve queued or running jobs before shared activation'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_shared_activation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER shared_activation_guard BEFORE INSERT OR UPDATE ON public.carelink_instance
 FOR EACH ROW EXECUTE FUNCTION public.guard_shared_activation();
COMMIT;
