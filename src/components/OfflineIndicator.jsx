import { useState, useEffect } from 'react'
import { onSyncStatusChange, syncAll } from '../services/syncEngine'
import { getCacheStats } from '../services/offlineDB'

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncStatus, setSyncStatus] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const unsubscribe = onSyncStatusChange((status) => {
      setSyncStatus(status)
      if (status.type === 'sync_start') setSyncing(true)
      if (status.type === 'sync_complete' || status.type === 'sync_error') {
        setSyncing(false)
        refreshStats()
      }
    })

    refreshStats()
    const interval = setInterval(refreshStats, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  async function refreshStats() {
    try {
      const stats = await getCacheStats()
      setPendingCount(stats.pendingSync)
    } catch {
      // IndexedDB may not be available
    }
  }

  async function handleManualSync() {
    setSyncing(true)
    await syncAll()
  }

  // Don't show anything if online and no pending items
  if (isOnline && pendingCount === 0 && !syncing) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Main Indicator Pill */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg text-xs font-medium transition-all ${
          !isOnline
            ? 'bg-amber-500 text-white'
            : syncing
              ? 'bg-blue-500 text-white'
              : pendingCount > 0
                ? 'bg-orange-500 text-white'
                : 'bg-green-500 text-white'
        }`}
      >
        {!isOnline && (
          <>
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Offline Mode
          </>
        )}
        {isOnline && syncing && (
          <>
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Syncing...
          </>
        )}
        {isOnline && !syncing && pendingCount > 0 && (
          <>
            <span className="w-2 h-2 rounded-full bg-white" />
            {pendingCount} pending
          </>
        )}
      </button>

      {/* Detail Panel */}
      {showDetails && (
        <div className="absolute bottom-12 right-0 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 text-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-800">Sync Status</h4>
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
          </div>

          <div className="space-y-2 text-slate-600">
            <div className="flex justify-between">
              <span>Connection</span>
              <span className={`font-medium ${isOnline ? 'text-green-700' : 'text-amber-700'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pending changes</span>
              <span className="font-medium">{pendingCount}</span>
            </div>
            {syncStatus?.type === 'sync_complete' && (
              <div className="flex justify-between">
                <span>Last sync</span>
                <span className="font-medium text-green-700">Just now</span>
              </div>
            )}
          </div>

          {isOnline && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncing}
              className="mt-3 w-full px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}

          {!isOnline && (
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
              Working offline. Changes will sync automatically when connection is restored.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default OfflineIndicator
