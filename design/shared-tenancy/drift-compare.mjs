// Compares live-drift-fingerprint.sql output from the live project with the tested fixture.
// Usage:
//   node drift-compare.mjs expected   -> writes drift-expected.tsv from a disposable fixture database (needs Docker)
//   node drift-compare.mjs live.tsv   -> diffs a live export (category<TAB>name<TAB>hash, or the SQL editor CSV) against it
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'

const dir = fileURLToPath(new URL('.', import.meta.url))
const expectedFile = fileURLToPath(new URL('drift-expected.tsv', import.meta.url))
const docker = (args, input) => {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 120000, windowsHide: true, input })
  if (r.error || r.status !== 0) throw new Error(`docker ${args[0]} failed: ${r.error?.message || r.stderr}`)
  return r.stdout
}
const parse = text => new Map(text.trim().split(/\r?\n/).map(line => line.replace(/"/g, '').split(/\t|,(?=[0-9a-f]{32}$)/))
  .filter(parts => parts.length >= 3 && /^[0-9a-f]{32}$/.test(parts[2])).map(([category, name, hash]) => [`${category}\t${name}`, hash]))

if (process.argv[2] === 'expected') {
  const name = `carelink-drift-${randomUUID()}`
  try {
    docker(['run', '-d', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16-alpine'])
    for (let i = 0; i < 30; i++) { try { docker(['exec', name, 'psql', '-U', 'postgres', '-c', 'SELECT 1']); break } catch { await setTimeout(500) } }
    docker(['cp', dir, `${name}:/tmp/st`])
    docker(['exec', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/st/schema-fixture.sql'])
    const out = docker(['exec', name, 'psql', '-U', 'postgres', '-At', '-F', '\t', '-f', '/tmp/st/live-drift-fingerprint.sql'])
    writeFileSync(expectedFile, out)
    console.log(`wrote ${out.trim().split('\n').length} fingerprints to drift-expected.tsv`)
  } finally { try { docker(['rm', '-f', name]) } catch { /* ignore */ } }
} else {
  const expected = parse(readFileSync(expectedFile, 'utf8')), live = parse(readFileSync(process.argv[2], 'utf8'))
  const rows = []
  for (const [key, hash] of expected) if (!live.has(key)) rows.push(`MISSING ON LIVE  ${key}`); else if (live.get(key) !== hash) rows.push(`DIFFERENT        ${key}`)
  for (const key of live.keys()) if (!expected.has(key)) rows.push(`EXTRA ON LIVE    ${key}`)
  console.log(rows.length ? rows.join('\n') : 'No differences.')
  process.exitCode = rows.length ? 1 : 0
}
