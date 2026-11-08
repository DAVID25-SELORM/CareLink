// Separate from the legacy unscoped cache. Never imports legacy clinical records.
export function createHospitalCache({ hospitalId, userId, openDatabase }) {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  if (!uuid.test(hospitalId || '') || !uuid.test(userId || '')) throw new Error('Valid hospital and user required')
  const name = `carelink-hospital-${hospitalId.toLowerCase()}-user-${userId.toLowerCase()}`
  let closed = false
  let pending
  const assertOpen = () => { if (closed) throw new Error('Hospital cache closed') }
  const database = async () => {
    assertOpen()
    pending ||= openDatabase(name, 2, { upgrade(db) {
      if (!db.objectStoreNames.contains('rows')) db.createObjectStore('rows', { keyPath: ['table', 'id'] })
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' })
    } })
    const db = await pending
    assertOpen()
    return db
  }
  const validate = row => {
    if (!row?.id || row.tenant_id !== hospitalId) throw new Error('Cache hospital mismatch')
  }
  return Object.freeze({
    hospitalId, userId,
    async queueMutation(operation) {
      if (!['insert','update','delete'].includes(operation.type) || !operation.recordId || !operation.table) throw new Error('Invalid queued operation')
      if (operation.payload?.tenant_id && operation.payload.tenant_id !== hospitalId) throw new Error('Queue hospital mismatch')
      const db = await database()
      assertOpen()
      const entry = { ...operation, id: crypto.randomUUID(), hospitalId, userId, status: 'pending', created_at: new Date().toISOString() }
      await db.put('queue', entry)
      assertOpen()
      return entry.id
    },
    async pendingMutations() {
      const db = await database()
      const entries = await db.getAll('queue')
      assertOpen()
      return entries.filter(entry => entry.status === 'pending')
    },
    async heldMutations() {
      const db = await database()
      const entries = await db.getAll('queue')
      assertOpen()
      return entries.filter(entry => entry.status === 'sending' && entry.hospitalId === hospitalId && entry.userId === userId)
        .map(({ id, table, type, recordId, created_at }) => ({ id, table, type, recordId, created_at }))
    },
    async completeMutation(id) {
      const db = await database()
      assertOpen()
      await db.delete('queue', id)
      assertOpen()
    },
    async markMutationSending(id) {
      const db = await database()
      assertOpen()
      const tx = db.transaction('queue', 'readwrite')
      const entry = await tx.store.get(id)
      if (!entry || entry.status !== 'pending' || entry.hospitalId !== hospitalId || entry.userId !== userId) {
        tx.abort()
        await tx.done.catch(() => {})
        throw new Error('Queued operation is no longer pending')
      }
      await tx.store.put({ ...entry, status: 'sending' })
      await tx.done
      assertOpen()
    },
    async put(table, row) {
      validate(row)
      const db = await database()
      assertOpen()
      await db.put('rows', { table, id: row.id, row })
      assertOpen()
    },
    async get(table, id) {
      const db = await database()
      const entry = await db.get('rows', [table, id])
      assertOpen()
      if (!entry) return null
      validate(entry.row)
      return entry.row
    },
    async clear() {
      const db = await database()
      await db.clear('rows')
      assertOpen()
    },
    dispose() {
      closed = true
      pending?.then(db => db.close()).catch(() => {})
    },
  })
}
