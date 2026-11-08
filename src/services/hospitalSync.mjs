const writable = new Set(['patients','appointments','lab_tests','prescriptions','prescription_items','payments','referrals'])

// A runner captures one verified hospital session. It never follows a global
// selection or reads the old unscoped queue. Failed writes remain pending.
export function createHospitalSync({ database, cache, hospitalId, userId }) {
  let closed = false
  let running = false
  const check = () => { if (closed) throw new Error('Hospital sync stopped') }
  return Object.freeze({
    dispose() { closed = true; cache.dispose() },
    async run() {
      check()
      if (running) return { status: 'already_running' }
      running = true
      let pushed = 0
      try {
        const entries = await cache.pendingMutations()
        for (const entry of entries) {
          check()
          if (entry.hospitalId !== hospitalId || entry.userId !== userId || !writable.has(entry.table)) throw new Error('Queued operation scope denied')
          if (entry.payload?.tenant_id && entry.payload.tenant_id !== hospitalId) throw new Error('Queued operation scope denied')
          if (entry.payload?.id && entry.payload.id !== entry.recordId) throw new Error('Queued record identity mismatch')
          if (!['insert','update','delete'].includes(entry.type)) throw new Error('Invalid queued operation')
          // Persist before dispatch. A crash or lost response must not silently
          // replay a potentially committed clinical write on the next login.
          await cache.markMutationSending(entry.id)
          check()
          let query = database.from(entry.table)
          if (entry.type === 'insert') query = query.insert({ ...entry.payload, id: entry.recordId, tenant_id: hospitalId })
          else if (entry.type === 'update') query = query.update({ ...entry.payload, tenant_id: hospitalId }).eq('tenant_id', hospitalId).eq('id', entry.recordId)
          else if (entry.type === 'delete') query = query.delete().eq('tenant_id', hospitalId).eq('id', entry.recordId)
          else throw new Error('Invalid queued operation')
          const { data, error } = await query.select('id')
          check()
          if (error || data?.length !== 1 || data[0].id !== entry.recordId) throw new Error('Queued write was not confirmed; review before retrying')
          await cache.completeMutation(entry.id)
          check()
          pushed += 1
        }
        return { status: 'success', results: { push: { pushed, failed: 0 }, pulled: {} } }
      } finally { running = false }
    },
  })
}
