import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import PlatformLayout from '../layouts/PlatformLayout'
import { fetchAll } from '../platform/api'
import { growth, money, outstandingBalances, recurringRevenue } from '../platform/domain'
import { Badge, PageHeader, ResourceState, Table, dateLabel } from '../platform/ui'
import { useResource } from '../platform/useResource'

const loadOverview = async () => {
  const [tenants, subscriptions, invoices, tickets, incidents] = await Promise.all([
    fetchAll('platform_tenants'), fetchAll('platform_subscriptions'), fetchAll('platform_invoices'),
    fetchAll('platform_tickets'), fetchAll('platform_incidents'),
  ])
  return { tenants, subscriptions, invoices, tickets, incidents }
}

export default function PlatformOverview() {
  const resource = useResource(loadOverview)
  const data = resource.data || { tenants: [], subscriptions: [], invoices: [], tickets: [], incidents: [] }
  const revenue = useMemo(() => recurringRevenue(data.subscriptions), [data.subscriptions])
  const outstanding = useMemo(() => outstandingBalances(data.invoices), [data.invoices])
  const active = data.tenants.filter(t => t.lifecycle_state === 'active').length
  const onboarding = data.tenants.filter(t => t.lifecycle_state === 'onboarding').length
  const openTickets = data.tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length
  const incidents = data.incidents.filter(i => i.status !== 'resolved').length
  const primaryCurrency = Object.keys(revenue)[0] || 'GHS'
  const stats = [
    ['Total hospitals', data.tenants.length, 'Registered platform tenants'],
    ['Active hospitals', active, 'Confirmed workspace status'],
    ['Onboarding', onboarding, 'Awaiting readiness approval'],
    ['Monthly recurring revenue', money(revenue[primaryCurrency] || 0, primaryCurrency), `${primaryCurrency} active subscriptions`],
    ['Outstanding invoices', money(outstanding[primaryCurrency] || 0, primaryCurrency), 'Issued balances only'],
    ['Open support tickets', openTickets, 'Needs platform attention'],
    ['Platform incidents', incidents, incidents ? 'Requires review' : 'No unresolved incidents'],
  ]
  const recent = [...data.tenants].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6)
  return <PlatformLayout><PageHeader title="Platform overview" description="A live view of independent hospital workspaces, commercial status and operational work."><Link className="pc-btn pc-primary" to="/platform/hospitals">Register hospital</Link></PageHeader>
    <ResourceState resource={resource}>
      <div className="pc-stats">{stats.map(([label, value, hint]) => <article className="pc-stat" key={label}><span className="pc-stat-icon">◆</span><p>{label}</p><strong>{value}</strong><small>{hint}</small></article>)}</div>
      <div className="pc-grid"><section className="pc-panel"><div className="pc-panel-head"><div><h2>Hospital growth</h2><p className="pc-muted">Cumulative registered hospitals by month</p></div><Link to="/platform/analytics">View analytics</Link></div><div className="pc-panel-body"><div className="pc-chart" style={{ display:'flex', alignItems:'end', gap:12 }}>{growth(data.tenants).map(item => <div key={item.month} style={{ flex:1, textAlign:'center' }}><div title={`${item.hospitals} hospitals`} style={{ height:`${Math.max(8, item.hospitals * 22)}px`, background:'#008F83', borderRadius:'5px 5px 0 0' }} /><small className="pc-muted">{item.month}</small></div>)}</div></div></section>
        <section className="pc-panel"><div className="pc-panel-head"><div><h2>Onboarding progress</h2><p className="pc-muted">Directory records awaiting go-live</p></div><Link to="/platform/onboarding">Open checklist</Link></div><ul className="pc-list">{data.tenants.filter(t => t.lifecycle_state === 'onboarding').slice(0, 5).map(t => <li key={t.id}><div style={{ display:'flex', justifyContent:'space-between', gap:12 }}><strong>{t.hospital_name}</strong><Badge>{t.status}</Badge></div><p className="pc-muted">Created {dateLabel(t.created_at)}</p></li>)}{!onboarding && <li><p className="pc-muted">No hospitals are waiting in onboarding.</p></li>}</ul></section></div>
      <section className="pc-panel"><div className="pc-panel-head"><div><h2>Recent hospitals</h2><p className="pc-muted">Latest platform directory activity</p></div><Link to="/platform/hospitals">View all hospitals</Link></div><Table rows={recent} onRow={() => {}} columns={[{ key:'hospital_name', label:'Hospital' }, { key:'lifecycle_state', label:'Lifecycle', render:r => <Badge>{r.lifecycle_state}</Badge> }, { key:'status', label:'Onboarding', render:r => <Badge>{r.status}</Badge> }, { key:'created_at', label:'Registered', render:r => dateLabel(r.created_at) }]} /></section>
    </ResourceState>
  </PlatformLayout>
}
