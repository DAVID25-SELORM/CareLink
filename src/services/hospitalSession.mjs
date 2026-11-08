// Hospital selection is a verified server operation. Callers must remount clinical
// screens on revision changes and use only the returned database in those screens.
export function createHospitalSession({ createDatabase, clearCache }) {
  let revision = 0
  let database = null
  let selection = null
  let cacheReset = Promise.resolve()
  const reset = () => {
    revision += 1
    database?.dispose()
    database = null
    selection = null
    // IndexedDB clearing is asynchronous. Do not expose a new hospital until
    // it finishes; retain rejection so a failed cleanup denies access.
    cacheReset = cacheReset.then(() => clearCache())
    cacheReset.catch(() => {})
    return revision
  }
  return Object.freeze({
    reset,
    current: () => selection,
    async select(hospitalId, userId) {
      const request = reset()
      let candidate
      try {
        await cacheReset
        if (request !== revision) throw new Error('Hospital selection changed')
        candidate = createDatabase(hospitalId, userId)
        database = candidate
        const { data, error } = await candidate.rpc('hospital_session')
        if (request !== revision) throw new Error('Hospital selection changed')
        if (error) throw new Error('Unable to verify hospital access')
        if (data?.tenant_id !== hospitalId || data?.user_id !== userId ||
          !['admin','doctor','pharmacist','nurse','cashier','records_officer'].includes(data?.role)) {
          throw new Error('Hospital access denied')
        }
        selection = Object.freeze({ hospitalId, userId, name: data.hospital_name || '', role: data.role, database: candidate, revision: request })
        return selection
      } catch (error) {
        candidate?.dispose()
        if (request === revision) reset()
        throw error
      }
    },
  })
}
