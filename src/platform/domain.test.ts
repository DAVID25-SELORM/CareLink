import { describe, expect, it } from 'vitest'
import { can, growth, outstandingBalances, recurringRevenue } from './domain'

describe('platform domain calculations', () => {
  it('keeps platform roles separate from tenant roles', () => {
    expect(can('platform_owner', 'billing.write')).toBe(true)
    expect(can('finance_manager', 'billing.write')).toBe(true)
    expect(can('support_officer', 'billing.write')).toBe(false)
    expect(can('admin', 'billing.write')).toBe(false)
  })
  it('normalizes annual subscriptions to monthly recurring revenue', () => {
    expect(recurringRevenue([{ id:'a', tenant_id:'t', period_end:'2026-12-01', status:'active', currency:'GHS', amount:1200, billing_cycle:'annual' }, { id:'b', tenant_id:'t', period_end:'2026-07-01', status:'active', currency:'GHS', amount:100, billing_cycle:'monthly' }])).toEqual({ GHS: 200 })
  })
  it('groups outstanding balances by currency', () => {
    expect(outstandingBalances([{ id:'a', tenant_id:'t', due_date:'2026-07-01', status:'issued', currency:'GHS', amount:100, paid_amount:25 }, { id:'b', tenant_id:'t', due_date:'2026-07-01', status:'paid', currency:'GHS', amount:90, paid_amount:90 }, { id:'c', tenant_id:'t', due_date:'2026-07-01', status:'issued', currency:'USD', amount:50, paid_amount:10 }])).toEqual({ GHS:75, USD:40 })
  })
  it('builds cumulative growth points without fabricated data', () => {
    const points = growth([{ created_at:'2026-01-15', hospital_name:'A', status:'lead', lifecycle_state:'onboarding', id:'a' }], new Date('2026-06-15T00:00:00Z'))
    expect(points).toHaveLength(6)
    expect(points[0].hospitals).toBe(1)
    expect(points[5].hospitals).toBe(1)
  })
})
