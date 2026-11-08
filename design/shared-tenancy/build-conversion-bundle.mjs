// Builds ONE atomic SQL file that converts a single-hospital CareLink instance to shared tenancy.
//   node design/shared-tenancy/build-conversion-bundle.mjs <initial-tenant-uuid> [out.sql]
// The output is a build artifact: review it, rehearse it on a restored copy, take a backup, then run it
// with psql (-v ON_ERROR_STOP=1). Nothing here connects to a database or applies anything.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const tenant = process.argv[2]
const out = process.argv[3] || path.join(dir, 'conversion-bundle.sql')
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant || '')) {
  console.error('Usage: build-conversion-bundle.mjs <initial-tenant-uuid> [out.sql]'); process.exit(1)
}
const drafts = readdirSync(dir).filter(f => /^0(0[1-9]|1[0-6])_.*\.sql$/.test(f)).sort()
if (drafts.length !== 16) { console.error(`Expected drafts 001-016, found ${drafts.length}`); process.exit(1) }

const parts = [`-- CareLink shared-tenancy conversion bundle. GENERATED - do not edit; rebuild from the drafts.
-- Initial hospital (owns retained catalog/configuration rows): ${tenant}
-- Atomic: any failure rolls everything back. Rollback after COMMIT = restore from backup (see CONVERSION_RUNBOOK.md).
${String.fromCharCode(92)}set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT set_config('carelink.initial_tenant_id','${tenant}',true);
${readFileSync(path.join(dir, 'conversion-preflight.sql'), 'utf8')}`]
for (const f of drafts) {
  const body = readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).filter(l => !/^(BEGIN|COMMIT);\s*$/.test(l)).join('\n')
  parts.push(`\n-- ===== ${f} =====\n${body}`)
}
parts.push(`\n-- ===== activation =====\n${readFileSync(path.join(dir, 'conversion-activate.sql'), 'utf8')}\nCOMMIT;\n`)
writeFileSync(out, parts.join('\n'))
console.log(`Wrote ${out} (${drafts.length} drafts)`)
