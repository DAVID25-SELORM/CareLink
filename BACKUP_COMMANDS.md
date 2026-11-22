# Free backup, restore and rehearsal commands

For use without Supabase Pro. Run in **PowerShell**, from a folder where you want the backups kept
(for example `D:\carelink-backups`). Docker Desktop must be running. Nothing is installed.
None of this has been run by the assistant against your database: run the check in step 3 before trusting a backup.

## 0. One-time setup (each PowerShell window)
Get the **Session pooler** connection details: Supabase dashboard > your project > Connect > Session pooler.
Use the pooler, not the "Direct connection": on the Free plan the direct host is IPv6-only and Docker on Windows often cannot reach it.
The password is the database password. Type it yourself; never paste it into chat or a file.

```powershell
$env:PGPASSWORD = Read-Host "Database password"
$HOST_ = "aws-0-REGION.pooler.supabase.com"   # from the Session pooler screen
$USER_ = "postgres.wjlpywztfjruqnavwsvr"      # postgres.<project ref>
$CONN  = "host=$HOST_ port=5432 dbname=postgres user=$USER_ sslmode=require"
```

## 1. Back up (do this before every risky step, and daily during the pilot)
```powershell
$F = "carelink-$(Get-Date -Format yyyyMMdd-HHmm).dump"
docker run --rm -e PGPASSWORD -v "${PWD}:/backup" postgres:17 pg_dump "$CONN" --no-owner --no-privileges --schema=public --schema=auth --schema=storage -Fc -f "/backup/$F"
Get-Item $F | Select-Object Name, Length
Get-FileHash $F -Algorithm SHA256
```
Copy the file to a second place (USB drive or a private cloud folder). Patient data: keep it private and encrypted at rest.

## 2. Check the backup file is readable
```powershell
docker run --rm -v "${PWD}:/backup" postgres:17 pg_restore --list "/backup/$F" | Select-Object -First 20
```
It should list tables such as `patients` and `users`. An empty or erroring list means the backup is bad.

## 3. Rehearse a restore into a NEW free Supabase project
Create a second project (the Free plan allows two). Set the new project's pooler details:
```powershell
$env:PGPASSWORD = Read-Host "NEW project database password"
$HOST2 = "aws-0-REGION.pooler.supabase.com"
$USER2 = "postgres.NEWPROJECTREF"
$CONN2 = "host=$HOST2 port=5432 dbname=postgres user=$USER2 sslmode=require"
docker run --rm -e PGPASSWORD -v "${PWD}:/backup" postgres:17 pg_restore -d "$CONN2" --no-owner --no-privileges --clean --if-exists "/backup/$F"
```
Expect some harmless "already exists" or permission messages for Supabase's own objects. Real problems are errors about
`public` tables. Then count the rows on **both** projects (run in each project's SQL editor); the numbers must match:
```sql
SELECT
  (SELECT count(*) FROM public.patients)      AS patients,
  (SELECT count(*) FROM public.users)         AS staff_profiles,
  (SELECT count(*) FROM auth.users)           AS auth_users,
  (SELECT count(*) FROM public.audit_log)     AS audit_rows,
  (SELECT count(*) FROM public.immunizations) AS immunizations,
  (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS public_tables;
```
Then point a Vercel preview at the new project (its URL and anon key) and log in as a known user.
Delete or pause the rehearsal project when done.

## 4. Run the conversion rehearsal on that copy
Follow "Before the window" and "Window" in `design/shared-tenancy/CONVERSION_RUNBOOK.md`, but with the copy's connection
string. Run the bundle through Docker too:
```powershell
docker run --rm -e PGPASSWORD -v "D:\APPS\CareLink\design\shared-tenancy:/bundle" postgres:17 psql "$CONN2" -v ON_ERROR_STOP=1 -f /bundle/conversion-bundle.sql
```
(Build `conversion-bundle.sql` first with `build-conversion-bundle.mjs`, as the runbook says.) Note how long it takes.

## 5. Rollback on the live project (only if the conversion commits and then fails)
The bundle runs as one transaction, so an error before COMMIT rolls back by itself. After COMMIT, rollback is a manual
restore of the backup you took just before the window. Data entered after that backup is lost.
```powershell
# Re-point $CONN / PGPASSWORD at the LIVE project first, and be certain this is what you want.
docker run --rm -e PGPASSWORD -v "${PWD}:/backup" postgres:17 pg_restore -d "$CONN" --no-owner --no-privileges --clean --if-exists "/backup/$F"
```
Then redeploy the previous Vercel build and unset `VITE_TENANCY_MODE`.

## Limits of this approach
- A dump is one point in time. There is no rewinding to "10 minutes ago".
- Edge Function secrets, project settings and the auth configuration are not in the dump; keep a written list of them.
- Free projects pause after about a week of inactivity, and have no Supabase-side backups. Take your own dumps.
- A backup you have never restored does not count. Do step 3 before real patients.
