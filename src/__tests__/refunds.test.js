import { describe, it, expect } from 'vitest'
import { buildQueue, checkReason, requestBlocker, requestOutcome, REJECT_MARK } from '../lib/refunds'

describe('refund queue', () => {
  it('needs a reason and a refundable payment', () => {
    expect(checkReason('no').ok).toBe(false)
    expect(checkReason(' wrong amount charged ').reason).toBe('wrong amount charged')
    expect(requestBlocker({ status: 'refunded' })).toMatch(/not refundable/)
    expect(requestBlocker({ status: 'completed', prescriptions: { status: 'dispensed' } })).toMatch(/dispensed/)
    expect(requestBlocker({ status: 'completed', prescriptions: { status: 'paid' } })).toBe('')
  })
  it('derives the outcome from the payment', () => {
    const req = { created_at: '2026-11-19T10:00:00.000Z' }
    expect(requestOutcome(req, { status: 'refunded' })).toBe('approved')
    expect(requestOutcome(req, { status: 'completed', notes: `${REJECT_MARK} 2026-11-19T11:00:00.000Z by a@b: no` })).toBe('rejected')
    expect(requestOutcome({ created_at: '2026-11-19T12:00:00.000Z' }, { status: 'completed', notes: `${REJECT_MARK} 2026-11-19T11:00:00.000Z by a@b: no` })).toBe('pending')
  })
  it('keeps the newest request per payment, pending first', () => {
    const q = buildQueue(
      [{ id: 1, record_id: 'p1', created_at: '2026-11-19T09:00:00Z' }, { id: 2, record_id: 'p1', created_at: '2026-11-19T10:00:00Z' }, { id: 3, record_id: 'p2', created_at: '2026-11-19T08:00:00Z' }],
      [{ id: 'p1', status: 'refunded' }, { id: 'p2', status: 'completed' }],
    )
    expect(q.map((r) => r.request.id)).toEqual([3, 2])
    expect(q[0].outcome).toBe('pending')
    expect(q[1].outcome).toBe('approved')
  })
})
