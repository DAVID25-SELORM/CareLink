import { describe, it, expect } from 'vitest'
import { buildRecallMessage, lastRecallByPatient, recalledRecently, recallBlocker, RECALL_KIND } from '../lib/immunisationRecall'

describe('immunisation recall', () => {
  it('builds a message without vaccine names', () => {
    const m = buildRecallMessage({ childName: 'Ama Mensah', hospital: 'Grace Clinic' })
    expect(m).toContain('Ama')
    expect(m).toContain('Grace Clinic')
    expect(m).not.toMatch(/vaccine|BCG|Penta|measles/i)
    expect(m.length).toBeLessThanOrEqual(160)
  })
  it('finds the latest recall per patient and applies the cooldown', () => {
    const map = lastRecallByPatient([
      { record_id: 'a', created_at: '2026-11-01T10:00:00Z', new_values: { kind: RECALL_KIND } },
      { record_id: 'a', created_at: '2026-11-10T10:00:00Z', new_values: { kind: RECALL_KIND } },
      { record_id: 'b', created_at: '2026-11-10T10:00:00Z', new_values: { kind: 'custom' } },
    ])
    expect(map.has('b')).toBe(false)
    const now = new Date('2026-11-18T00:00:00Z').getTime()
    expect(recalledRecently(map.get('a'), now)).toBe(true)
    expect(recalledRecently(map.get('a'), now + 10 * 86400000)).toBe(false)
    expect(recalledRecently(undefined, now)).toBe(false)
  })
  it('explains why a child cannot be texted', () => {
    expect(recallBlocker({ consent_sms: false, phone: '0244123456' })).toBe('No SMS consent')
    expect(recallBlocker({ consent_sms: true, phone: '12' })).toBe('No valid phone')
    expect(recallBlocker({ consent_sms: true, phone: '+233 24 412 3456' })).toBe('')
  })
})
