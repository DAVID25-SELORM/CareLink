import { describe, it, expect } from 'vitest'
import { summarizeDay, checkDayClose, refundBlocker } from '../lib/dayClose'

const at = (d) => new Date(`${d}T12:00:00`).toISOString()
const rows = [
  { amount: 50, payment_method: 'cash', status: 'completed', created_at: at('2026-11-18') },
  { amount: 30.5, payment_method: 'momo', momo_provider: 'mtn', status: 'completed', created_at: at('2026-11-18') },
  { amount: 20, payment_method: 'cash', status: 'refunded', created_at: at('2026-11-18') },
  { amount: 99, payment_method: 'cash', status: 'completed', created_at: at('2026-11-17') },
]
describe('day close', () => {
  it('summarises one day and excludes refunds', () => {
    const s = summarizeDay(rows, '2026-11-18')
    expect(s).toMatchObject({ count: 2, total: 80.5, cashExpected: 50, refundedCount: 1, refundedTotal: 20 })
    expect(s.byMethod['momo:mtn']).toBe(30.5)
  })
  it('needs a note for any variance', () => {
    expect(checkDayClose({ expectedCash: 50, countedCash: '50' }).ok).toBe(true)
    expect(checkDayClose({ expectedCash: 50, countedCash: '45' }).ok).toBe(false)
    expect(checkDayClose({ expectedCash: 50, countedCash: '45', note: 'GH 5 given as change' })).toMatchObject({ ok: true, variance: -5 })
    expect(checkDayClose({ expectedCash: 50, countedCash: '' }).ok).toBe(false)
  })
  it('limits refunds', () => {
    expect(refundBlocker({ status: 'completed', prescriptions: { status: 'paid' } }, 'cashier')).toMatch(/administrator/)
    expect(refundBlocker({ status: 'completed', prescriptions: { status: 'dispensed' } }, 'admin')).toMatch(/dispensed/)
    expect(refundBlocker({ status: 'completed', prescriptions: { status: 'paid' } }, 'admin')).toBe('')
  })
})
