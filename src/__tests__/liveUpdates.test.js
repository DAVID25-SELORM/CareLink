import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const channel = vi.fn()
const state = vi.hoisted(() => ({ shared: false }))
vi.mock('../supabaseClient', () => ({
  get sharedHospitalMode() { return state.shared },
  supabase: { channel: (...args) => channel(...args) },
}))

beforeEach(() => { vi.resetModules(); channel.mockReset(); vi.useFakeTimers() })
afterEach(() => vi.useRealTimers())

describe('subscribeToTable', () => {
  it('uses a realtime channel in dedicated mode', async () => {
    state.shared = false
    const unsubscribe = vi.fn()
    const chain = { on: vi.fn(() => chain), subscribe: vi.fn(() => ({ unsubscribe })) }
    channel.mockReturnValue(chain)
    const { subscribeToTable } = await import('../services/liveUpdates')
    const stop = subscribeToTable({ channel: 'c', table: 't', onChange: vi.fn() })
    expect(channel).toHaveBeenCalledWith('c')
    stop()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('polls instead of opening a channel in shared mode', async () => {
    state.shared = true
    const refresh = vi.fn().mockResolvedValue()
    const { subscribeToTable, POLL_INTERVAL_MS } = await import('../services/liveUpdates')
    const stop = subscribeToTable({ channel: 'c', table: 't', refresh, onChange: vi.fn() })
    expect(channel).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
    expect(refresh).toHaveBeenCalledTimes(2)
    stop()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
