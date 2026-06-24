import { openDB } from 'idb'

const DB_NAME = 'carelink-offline'
const DB_VERSION = 1

// Tables that should be cached offline per the sync manifest
const OFFLINE_STORES = [
  'patients',
  'encounters',
  'vitals',
  'diagnoses',
  'clinical_notes',
  'prescriptions',
  'drugs',
  'lab_tests',
  'appointments',
  'queue',
  'admissions',
  'beds',
  'wards',
]

const SYNC_QUEUE_STORE = 'sync_queue'
const META_STORE = 'sync_meta'

let dbInstance = null

async function getDB() {
  if (dbInstance) return dbInstance

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object stores for each offline table
      for (const store of OFFLINE_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          const s = db.createObjectStore(store, { keyPath: 'id' })
          s.createIndex('updated_at', 'updated_at', { unique: false })
        }
      }

      // Sync queue — mutations queued while offline
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const sq = db.createObjectStore(SYNC_QUEUE_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        })
        sq.createIndex('status', 'status', { unique: false })
        sq.createIndex('created_at', 'created_at', { unique: false })
      }

      // Metadata — sync checkpoints, device info
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    },
  })

  return dbInstance
}

// ─── Read/Write Operations ───────────────────────────────────────────

export async function getAll(storeName) {
  const db = await getDB()
  return db.getAll(storeName)
}

export async function getById(storeName, id) {
  const db = await getDB()
  return db.get(storeName, id)
}

export async function put(storeName, record) {
  const db = await getDB()
  return db.put(storeName, { ...record, _cachedAt: Date.now() })
}

export async function putMany(storeName, records) {
  const db = await getDB()
  const tx = db.transaction(storeName, 'readwrite')
  for (const record of records) {
    tx.store.put({ ...record, _cachedAt: Date.now() })
  }
  await tx.done
}

export async function deleteRecord(storeName, id) {
  const db = await getDB()
  return db.delete(storeName, id)
}

export async function clearStore(storeName) {
  const db = await getDB()
  return db.clear(storeName)
}

// ─── Sync Queue ──────────────────────────────────────────────────────

export async function queueMutation(operation) {
  const db = await getDB()
  const entry = {
    table_name: operation.table,
    operation_type: operation.type, // 'insert' | 'update' | 'delete'
    record_id: operation.recordId,
    payload: operation.payload,
    status: 'pending',
    created_at: new Date().toISOString(),
    retry_count: 0,
  }
  return db.add(SYNC_QUEUE_STORE, entry)
}

export async function getPendingMutations() {
  const db = await getDB()
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly')
  const idx = tx.store.index('status')
  return idx.getAll('pending')
}

export async function markMutationProcessed(id) {
  const db = await getDB()
  const entry = await db.get(SYNC_QUEUE_STORE, id)
  if (entry) {
    entry.status = 'applied'
    entry.processed_at = new Date().toISOString()
    await db.put(SYNC_QUEUE_STORE, entry)
  }
}

export async function markMutationFailed(id, error) {
  const db = await getDB()
  const entry = await db.get(SYNC_QUEUE_STORE, id)
  if (entry) {
    entry.status = 'failed'
    entry.error = error
    entry.retry_count += 1
    await db.put(SYNC_QUEUE_STORE, entry)
  }
}

export async function clearProcessedMutations() {
  const db = await getDB()
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
  let cursor = await tx.store.index('status').openCursor('applied')
  while (cursor) {
    cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

// ─── Sync Metadata ───────────────────────────────────────────────────

export async function getSyncCheckpoint(tableName) {
  const db = await getDB()
  const meta = await db.get(META_STORE, `checkpoint_${tableName}`)
  return meta?.value || null
}

export async function setSyncCheckpoint(tableName, timestamp) {
  const db = await getDB()
  return db.put(META_STORE, { key: `checkpoint_${tableName}`, value: timestamp })
}

export async function getDeviceId() {
  const db = await getDB()
  let meta = await db.get(META_STORE, 'device_id')
  if (!meta) {
    const id = crypto.randomUUID()
    await db.put(META_STORE, { key: 'device_id', value: id })
    return id
  }
  return meta.value
}

// ─── Cache Stats ─────────────────────────────────────────────────────

export async function getCacheStats() {
  const db = await getDB()
  const stats = {}
  for (const store of OFFLINE_STORES) {
    const count = await db.count(store)
    stats[store] = count
  }
  const pendingSync = await db.countFromIndex(SYNC_QUEUE_STORE, 'status', 'pending')
  return { stores: stats, pendingSync }
}
