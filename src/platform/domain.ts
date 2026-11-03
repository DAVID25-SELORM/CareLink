export const PLATFORM_ROLES = ['platform_owner', 'platform_admin', 'finance_manager', 'support_officer', 'technical_admin'] as const
export type PlatformRole = typeof PLATFORM_ROLES[number]
export const MODULES = ['patients', 'appointments', 'laboratory', 'pharmacy', 'drug_management', 'billing', 'claims', 'reports', 'nurse_dashboard', 'records_dashboard', 'referrals'] as const
export const ROLE_PERMISSIONS: Record<PlatformRole, readonly string[]> = {
  platform_owner: ['*'],
  platform_admin: ['overview.read','hospitals.read','hospitals.write','onboarding.write','billing.read','support.read','support.write','operations.read','notifications.read','audit.read','settings.read'],
  finance_manager: ['overview.read','hospitals.read','billing.read','billing.write','notifications.read','audit.read'],
  support_officer: ['overview.read','hospitals.read','support.read','support.write','operations.read','notifications.read'],
  technical_admin: ['overview.read','hospitals.read','onboarding.write','operations.read','operations.write','notifications.read','audit.read','settings.read'],
}
export function isPlatformRole(role: unknown): role is PlatformRole {
  return PLATFORM_ROLES.includes(role as PlatformRole)
}
export function can(role: unknown, permission: string): boolean {
  if (!isPlatformRole(role)) return false
  return ROLE_PERMISSIONS[role].includes('*') || ROLE_PERMISSIONS[role].includes(permission)
}
export interface Subscription {
  id: string; tenant_id: string; status: string; currency: string;
  amount: number | string; billing_cycle: 'monthly' | 'annual'; period_end: string;
}
export interface Invoice { id: string; tenant_id: string; currency: string; amount: number | string; paid_amount: number | string; status: string; due_date: string }
export interface Tenant { id: string; hospital_name: string; status: string; lifecycle_state: string; created_at: string }
export function recurringRevenue(subscriptions: Subscription[]): Record<string, number> {
  return subscriptions.filter(s => s.status === 'active').reduce<Record<string, number>>((totals, s) => {
    totals[s.currency] = (totals[s.currency] || 0) + Number(s.amount) / (s.billing_cycle === 'annual' ? 12 : 1)
    return totals
  }, {})
}
export function outstandingBalances(invoices: Invoice[]): Record<string, number> {
  return invoices.filter(i => i.status === 'issued').reduce<Record<string, number>>((totals, i) => {
    totals[i.currency] = (totals[i.currency] || 0) + Math.max(0, Number(i.amount) - Number(i.paid_amount))
    return totals
  }, {})
}
export function money(amount: number | string, currency = 'GHS'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount))
}
export function growth(tenants: Tenant[], now = new Date()): { month: string; hospitals: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1))
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    return { month: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), hospitals: tenants.filter(t => new Date(t.created_at) < end).length }
  })
}
export function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const escape = (value: unknown) => {
    let text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')
    // Prevent spreadsheet formula injection in exported user-authored fields.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return [keys.map(escape).join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\r\n')
}
