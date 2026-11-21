import { describe, it, expect } from 'vitest'
import { evaluateReadiness } from '../lib/goLive'

describe('go-live readiness', () => {
  it('flags an empty facility', () => {
    const items = evaluateReadiness({ roles: {}, drugs: 0, batches: 0, fees: 0, patients: 0, smsSent: 0, dayCloses: 0 })
    expect(items.every((i) => !i.ok)).toBe(true)
  })
  it('passes a configured facility and names missing roles', () => {
    const ready = { profile: { hospital_name: 'Grace', contact_phone: '0244000000' }, roles: { admin: 1, doctor: 2, nurse: 3, pharmacist: 1, cashier: 1 }, drugs: 50, batches: 50, fees: 10, patients: 5, smsSent: 1, dayCloses: 1 }
    expect(evaluateReadiness(ready).every((i) => i.ok)).toBe(true)
    const partial = evaluateReadiness({ ...ready, roles: { admin: 1 } }).find((i) => i.id === 'roles')
    expect(partial.ok).toBe(false)
    expect(partial.hint).toContain('Cashier')
  })
})
