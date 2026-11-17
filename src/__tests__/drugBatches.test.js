import { describe, it, expect } from 'vitest'
import { allocateFefo, earliestBatchExpiry } from '../lib/drugBatches'

const now = new Date('2026-11-17T10:00:00')
const batch = (id, expiry_date, quantity_remaining, status = 'active') => ({ id, batch_number: id, expiry_date, quantity_remaining, status })

describe('allocateFefo', () => {
  it('uses the earliest expiry first and spans batches', () => {
    const out = allocateFefo([batch('B', '2027-03-01', 50), batch('A', '2026-12-01', 30)], 40, now)
    expect(out.allocations.map((a) => [a.batch_id, a.quantity, a.remaining_after])).toEqual([['A', 30, 0], ['B', 10, 40]])
    expect(out.shortfall).toBe(0)
  })

  it('skips expired, quarantined, recalled and empty batches', () => {
    const out = allocateFefo([
      batch('old', '2026-11-01', 100),
      batch('q', '2027-01-01', 100, 'quarantined'),
      batch('r', '2027-01-01', 100, 'recalled'),
      batch('e', '2027-01-01', 0),
      batch('ok', '2027-02-01', 5),
    ], 20, now)
    expect(out.usable).toBe(5)
    expect(out.shortfall).toBe(15)
    expect(out.allocations).toHaveLength(1)
  })

  it('keeps a batch expiring today usable', () => {
    expect(allocateFefo([batch('t', '2026-11-17', 4)], 4, now).shortfall).toBe(0)
  })
})

describe('earliestBatchExpiry', () => {
  it('ignores empty and unavailable batches', () => {
    expect(earliestBatchExpiry([batch('a', '2026-12-01', 0), batch('b', '2027-05-01', 3), batch('c', '2026-11-20', 9, 'recalled')])).toBe('2027-05-01')
    expect(earliestBatchExpiry([])).toBeNull()
  })
})
