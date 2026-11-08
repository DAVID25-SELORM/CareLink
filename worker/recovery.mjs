import { createHash } from 'node:crypto'

// Resume only the exact schema and application revision originally requested.
export function provisioningIdentity(sql, commit) {
  if (!sql?.trim()) throw new Error('Approved tenant schema required')
  if (!/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('Immutable deployment commit required')
  return { schema_checksum:createHash('sha256').update(sql).digest('hex'), commit:commit.toLowerCase() }
}

export function validateRecovery(previous, identity) {
  const intent = previous.find(step => step.name === 'provisioning_identity')?.result
  if (!intent && previous.length) throw new Error('Legacy provisioning requires manual reconciliation before resume')
  if (intent && (intent.schema_checksum !== identity.schema_checksum || intent.commit !== identity.commit)) {
    throw new Error('Provisioning inputs changed; reconcile the existing resources before a new request')
  }
}
