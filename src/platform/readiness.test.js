import { describe, it, expect } from 'vitest'
import { describeBlocker, summarizeReadiness } from './readiness'

describe('readiness blockers', () => {
  it('flags evidence that cannot be recorded outside shared mode', () => {
    expect(describeBlocker('Evidence required: admin_acceptance').blockedByMode).toBe(true)
    expect(describeBlocker('Evidence required: admin_acceptance', { sharedMode: true }).blockedByMode).toBe(false)
  })
  it('points recordable evidence to the verification step', () => {
    const item = describeBlocker('Evidence required: backup_restore')
    expect(item.blockedByMode).toBe(false)
    expect(item.action).toMatch(/backup restore evidence/)
  })
  it('links subscription blockers and counts mode-blocked items', () => {
    expect(describeBlocker('Eligible subscription required').link).toBe('/platform/subscriptions')
    const summary = summarizeReadiness(['Evidence required: deployment', 'Evidence required: clinical', 'Set up administrator'])
    expect(summary).toMatchObject({ total: 3, blockedByMode: 1 })
  })
  it('handles an empty list', () => {
    expect(summarizeReadiness(undefined)).toEqual({ items: [], total: 0, blockedByMode: 0 })
  })
})
