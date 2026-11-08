// Creates only a disposable, network-isolated database. Never reads worker.env.
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { rmSync } from 'node:fs'

const name = `carelink-shared-test-${randomUUID()}`
const image = 'postgres:16-alpine'
const directory = fileURLToPath(new URL('.', import.meta.url))
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 60000, windowsHide: true })
  if (result.error || result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${result.error?.message || result.stderr}`)
  return result.stdout
}
let created = false
try {
  // Require a local image; no implicit downloads or provider access.
  docker(['image', 'inspect', image])
  docker(['run', '-d', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image])
  created = true
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    try { docker(['exec', name, 'psql', '-U', 'postgres', '-c', 'SELECT 1']); ready = true; break } catch { await setTimeout(500) }
  }
  if (!ready) throw new Error('Disposable database did not start')
  const rehearse = process.argv.includes('--rehearse-conversion')
  const bundle = fileURLToPath(new URL('conversion-bundle.rehearsal.sql', import.meta.url))
  if (rehearse) {
    // Seeded pre-conversion fixture -> generated atomic bundle -> assertions. Synthetic data, disposable database only.
    const built = spawnSync(process.execPath, [fileURLToPath(new URL('build-conversion-bundle.mjs', import.meta.url)), '10000000-0000-0000-0000-000000000001', bundle], { encoding: 'utf8' })
    if (built.status !== 0) throw new Error(`Bundle build failed: ${built.stderr}`)
  }
  docker(['cp', directory, `${name}:/tmp/shared-tenancy`])
  if (rehearse) rmSync(bundle, { force: true })
  const restore = process.argv.includes('--restore')
  const tests = rehearse ? ['conversion-rehearsal.sql'] : process.argv.includes('--full-schema') || restore ? ['full-schema-test.sql'] : ['membership-test.sql', 'clinical-isolation-test.sql', 'membership-commands-test.sql', 'clinical-keys-test.sql', 'core-roles-test.sql']
  for (const test of tests) {
    docker(['exec', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', `/tmp/shared-tenancy/${test}`])
    console.log(`PASS ${test}`)
  }
  if (restore) {
    docker(['exec', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/shared-tenancy/restore-fixture.sql'])
    docker(['exec', name, 'pg_dump', '-U', 'postgres', '-Fc', '-f', '/tmp/shared.dump', 'postgres'])
    docker(['exec', name, 'createdb', '-U', 'postgres', 'restored'])
    docker(['exec', name, 'pg_restore', '-U', 'postgres', '--exit-on-error', '-d', 'restored', '/tmp/shared.dump'])
    docker(['exec', name, 'psql', '-U', 'postgres', '-d', 'restored', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/shared-tenancy/restore-verify.sql'])
    console.log('PASS backup/restore: synthetic rows, auth identity, membership, RLS and composite foreign keys')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (created) {
    try { docker(['rm', '-f', name]) } catch (error) { console.error(error.message); process.exitCode = 1 }
  }
}
