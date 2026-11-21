import { describe, it, expect } from 'vitest'
import { checkDispensing, daysToExpiry } from '../lib/drugAlerts'

const now = new Date('2026-11-17T10:00:00')
const line = (name, expiry_date) => ({ drugs: { name, expiry_date } })

describe('drug dispensing alerts', () => {
  it('counts whole days and treats today as still valid', () => {
    expect(daysToExpiry('2026-11-17', now)).toBe(0)
    expect(daysToExpiry('2026-11-16', now)).toBe(-1)
    expect(daysToExpiry(null, now)).toBeNull()
  })

  it('blocks expired stock and warns about near expiry', () => {
    const out = checkDispensing([line('Amoxicillin', '2026-11-01'), line('ORS', '2026-12-01'), line('Paracetamol', '2027-06-01'), line('Unknown', null)], now)
    expect(out.blocked).toEqual(['Amoxicillin expired on 2026-11-01.'])
    expect(out.warnings).toEqual(['ORS expires in 14 days.'])
  })
})
