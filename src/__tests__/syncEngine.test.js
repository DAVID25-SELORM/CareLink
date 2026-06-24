import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const offlineDbMocks = vi.hoisted(() => ({
  putMany: vi.fn(),
  clearStore: vi.fn(),
  getPendingMutations: vi.fn(),
  markMutationProcessed: vi.fn(),
  markMutationFailed: vi.fn(),
  getSyncCheckpoint: vi.fn(),
  setSyncCheckpoint: vi.fn(),
  getDeviceId: vi.fn(),
  clearProcessedMutations: vi.fn(),
}))

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../services/offlineDB', () => offlineDbMocks)
vi.mock('../supabaseClient', () => ({
  supabase: supabaseMocks,
}))

import { initialCache, startAutoSync, stopAutoSync, syncAll } from '../services/syncEngine'

const createQueryBuilder = (tableName, responseMap, calls) => {
  const state = {
    checkpoint: null,
    range: null,
  }

  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn((from, to) => {
      state.range = [from, to]
      return builder
    }),
    gt: vi.fn((_column, value) => {
      state.checkpoint = value
      return builder
    }),
    then(resolve, reject) {
      calls.push({
        tableName,
        checkpoint: state.checkpoint,
        range: state.range,
      })

      const tableResponses = responseMap[tableName] || []
      const nextResponse = tableResponses.shift() || { data: [], error: null }
      return Promise.resolve(nextResponse).then(resolve, reject)
    },
  }

  return builder
}

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    offlineDbMocks.getPendingMutations.mockResolvedValue([])
    offlineDbMocks.getSyncCheckpoint.mockResolvedValue(null)
    offlineDbMocks.getDeviceId.mockResolvedValue('device-1')
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    stopAutoSync()
  })

  it('pulls all pages for a table during syncAll and updates the checkpoint once', async () => {
    const calls = []
    const patientsPageOne = Array.from({ length: 1000 }, (_, index) => ({
      id: `patient-${index + 1}`,
      updated_at: '2026-04-19T10:00:00.000Z',
    }))
    const responseMap = {
      patients: [
        { data: patientsPageOne, error: null },
        {
          data: [{ id: 'patient-1001', updated_at: '2026-04-19T11:00:00.000Z' }],
          error: null,
        },
      ],
    }

    supabaseMocks.from.mockImplementation((tableName) => createQueryBuilder(tableName, responseMap, calls))

    const result = await syncAll()

    expect(result).toMatchObject({
      status: 'success',
      results: {
        push: { pushed: 0, failed: 0 },
      },
    })
    expect(result.results.pulled.patients).toBe(1001)
    expect(offlineDbMocks.putMany).toHaveBeenCalledTimes(2)
    expect(offlineDbMocks.putMany).toHaveBeenNthCalledWith(1, 'patients', patientsPageOne)
    expect(offlineDbMocks.putMany).toHaveBeenNthCalledWith(2, 'patients', [
      { id: 'patient-1001', updated_at: '2026-04-19T11:00:00.000Z' },
    ])
    expect(offlineDbMocks.setSyncCheckpoint).toHaveBeenCalledWith('patients', '2026-04-19T11:00:00.000Z')
    expect(calls.filter((call) => call.tableName === 'patients')).toHaveLength(2)
    expect(calls.filter((call) => call.tableName === 'patients').map((call) => call.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('caches all pages during initialCache instead of stopping at the first page', async () => {
    const calls = []
    const drugsPageOne = Array.from({ length: 1000 }, (_, index) => ({
      id: `drug-${index + 1}`,
      updated_at: '2026-04-19T10:00:00.000Z',
    }))
    const responseMap = {
      drugs: [
        { data: drugsPageOne, error: null },
        {
          data: [{ id: 'drug-1001', updated_at: '2026-04-19T11:00:00.000Z' }],
          error: null,
        },
      ],
    }

    supabaseMocks.from.mockImplementation((tableName) => createQueryBuilder(tableName, responseMap, calls))

    await initialCache()

    expect(offlineDbMocks.clearStore).toHaveBeenCalledWith('drugs')
    expect(offlineDbMocks.putMany).toHaveBeenCalledWith('drugs', drugsPageOne)
    expect(offlineDbMocks.putMany).toHaveBeenCalledWith('drugs', [
      { id: 'drug-1001', updated_at: '2026-04-19T11:00:00.000Z' },
    ])
    expect(offlineDbMocks.setSyncCheckpoint).toHaveBeenCalledWith('drugs', '2026-04-19T11:00:00.000Z')
    expect(calls.filter((call) => call.tableName === 'drugs').map((call) => call.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('registers auto-sync listeners only once and fully cleans them up', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const documentAddEventListenerSpy = vi.spyOn(document, 'addEventListener')
    const documentRemoveEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    startAutoSync(1000)
    startAutoSync(1000)

    expect(addEventListenerSpy).toHaveBeenCalledTimes(2)
    expect(documentAddEventListenerSpy).toHaveBeenCalledTimes(1)
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)

    stopAutoSync()

    expect(removeEventListenerSpy).toHaveBeenCalledTimes(2)
    expect(documentRemoveEventListenerSpy).toHaveBeenCalledTimes(1)
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
  })
})
