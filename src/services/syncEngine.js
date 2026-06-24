import { supabase } from '../supabaseClient'
import {
  putMany,
  clearStore,
  getPendingMutations,
  markMutationProcessed,
  markMutationFailed,
  getSyncCheckpoint,
  setSyncCheckpoint,
  getDeviceId,
  clearProcessedMutations,
} from './offlineDB'

const SYNC_PAGE_SIZE = 1000

// Tables that support delta sync (have updated_at columns)
const SYNCABLE_TABLES = [
  { name: 'patients', direction: 'bidirectional' },
  { name: 'drugs', direction: 'server_to_client' },
  { name: 'appointments', direction: 'bidirectional' },
  { name: 'encounters', direction: 'bidirectional' },
  { name: 'vitals', direction: 'client_to_server' },
  { name: 'diagnoses', direction: 'bidirectional' },
  { name: 'prescriptions', direction: 'bidirectional' },
  { name: 'lab_tests', direction: 'bidirectional' },
  { name: 'admissions', direction: 'bidirectional' },
  { name: 'wards', direction: 'server_to_client' },
  { name: 'beds', direction: 'server_to_client' },
]

let isSyncing = false
let syncListeners = []

export function onSyncStatusChange(listener) {
  syncListeners.push(listener)
  return () => {
    syncListeners = syncListeners.filter((entry) => entry !== listener)
  }
}

function notifyListeners(status) {
  syncListeners.forEach((listener) => listener(status))
}

async function pullTable(tableName) {
  const checkpoint = await getSyncCheckpoint(tableName)
  let total = 0
  let offset = 0
  let lastTimestamp = checkpoint
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select('*')
      .order('updated_at', { ascending: true })
      .range(offset, offset + SYNC_PAGE_SIZE - 1)

    if (checkpoint) {
      query = query.gt('updated_at', checkpoint)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data?.length) {
      hasMore = false
      continue
    }

    await putMany(tableName, data)
    total += data.length
    lastTimestamp = data[data.length - 1]?.updated_at || lastTimestamp

    hasMore = data.length === SYNC_PAGE_SIZE
    if (hasMore) {
      offset += data.length
    }
  }

  if (lastTimestamp && lastTimestamp !== checkpoint) {
    await setSyncCheckpoint(tableName, lastTimestamp)
  }

  return total
}

async function pushMutations() {
  const pending = await getPendingMutations()
  let pushed = 0
  let failed = 0

  for (const mutation of pending) {
    try {
      const { table_name, operation_type, payload, record_id } = mutation

      if (operation_type === 'insert') {
        const { error } = await supabase.from(table_name).insert(payload)
        if (error) throw error
      } else if (operation_type === 'update') {
        const { error } = await supabase.from(table_name).update(payload).eq('id', record_id)
        if (error) throw error
      } else if (operation_type === 'delete') {
        const { error } = await supabase.from(table_name).delete().eq('id', record_id)
        if (error) throw error
      }

      await markMutationProcessed(mutation.id)
      pushed++
    } catch (error) {
      console.error(`Sync push failed for mutation ${mutation.id}:`, error)
      await markMutationFailed(mutation.id, error.message)
      failed++
    }
  }

  if (pushed > 0) {
    await clearProcessedMutations()
  }

  return { pushed, failed }
}

export async function syncAll() {
  if (isSyncing) return { status: 'already_running' }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { status: 'offline' }
  }

  isSyncing = true
  notifyListeners({ type: 'sync_start' })

  const results = { pulled: {}, push: { pushed: 0, failed: 0 } }

  try {
    results.push = await pushMutations()
    notifyListeners({ type: 'push_complete', ...results.push })

    for (const table of SYNCABLE_TABLES) {
      if (table.direction !== 'client_to_server') {
        try {
          const count = await pullTable(table.name)
          results.pulled[table.name] = count
        } catch (error) {
          console.error(`Pull failed for ${table.name}:`, error)
          results.pulled[table.name] = { error: error.message }
        }
      }
    }

    notifyListeners({ type: 'sync_complete', results })
    return { status: 'success', results }
  } catch (error) {
    notifyListeners({ type: 'sync_error', error: error.message })
    return { status: 'error', error: error.message }
  } finally {
    isSyncing = false
  }
}

export async function initialCache() {
  const deviceId = await getDeviceId()
  notifyListeners({ type: 'initial_cache_start', deviceId })

  for (const table of SYNCABLE_TABLES) {
    if (table.direction !== 'client_to_server') {
      try {
        await clearStore(table.name)

        let offset = 0
        let lastTimestamp = null
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from(table.name)
            .select('*')
            .order('updated_at', { ascending: true })
            .range(offset, offset + SYNC_PAGE_SIZE - 1)

          if (error) throw error
          if (!data?.length) {
            hasMore = false
            continue
          }

          await putMany(table.name, data)
          lastTimestamp = data[data.length - 1]?.updated_at || lastTimestamp

          hasMore = data.length === SYNC_PAGE_SIZE
          if (hasMore) {
            offset += data.length
          }
        }

        if (lastTimestamp) {
          await setSyncCheckpoint(table.name, lastTimestamp)
        }
      } catch (error) {
        console.error(`Initial cache failed for ${table.name}:`, error)
      }
    }
  }

  notifyListeners({ type: 'initial_cache_complete' })
}

let autoSyncInterval = null
let autoSyncStarted = false

const handleOnline = () => {
  notifyListeners({ type: 'online' })
  syncAll()
}

const handleOffline = () => {
  notifyListeners({ type: 'offline' })
}

const handleVisibilityChange = () => {
  if (!document.hidden && navigator.onLine) {
    syncAll()
  }
}

export function startAutoSync(intervalMs = 5 * 60 * 1000) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (autoSyncStarted) return

  autoSyncStarted = true

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  autoSyncInterval = window.setInterval(() => {
    if (navigator.onLine) {
      syncAll()
    }
  }, intervalMs)

  document.addEventListener('visibilitychange', handleVisibilityChange)
}

export function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval)
    autoSyncInterval = null
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }

  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  autoSyncStarted = false
}
