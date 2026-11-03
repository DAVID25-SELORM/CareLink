import PlatformLayout from '../layouts/PlatformLayout'
import { fetchAll } from '../platform/api'
import { Badge, PageHeader, ResourceState, Table, dateLabel, titleCase } from '../platform/ui'
import { useResource } from '../platform/useResource'

const MODULES = {
  subscriptions: { title:'Subscriptions', description:'Active plans, billing periods and tenant commercial status.', table:'platform_subscriptions', columns:[['status','Status'],['currency','Currency'],['amount','Amount'],['billing_cycle','Cycle'],['period_end','Period end']] },
  plans: { title:'Plans & pricing', description:'Versioned commercial plans and licensed modules.', table:'platform_plans', columns:[['name','Plan'],['code','Code'],['currency','Currency'],['monthly_price','Monthly'],['annual_price','Annual'],['active','Active']] },
  billing: { title:'Invoices & payments', description:'Issued balances and reconciled payment history.', table:'platform_invoices', columns:[['number','Invoice'],['currency','Currency'],['amount','Amount'],['paid_amount','Paid'],['status','Status'],['due_date','Due']] },
  support: { title:'Support tickets', description:'Tenant support requests and response ownership.', table:'platform_tickets', columns:[['subject','Subject'],['priority','Priority'],['status','Status'],['created_at','Created']] },
  monitoring: { title:'System monitoring', description:'Platform health signals reported by trusted server workers.', table:'platform_health_checks', columns:[['service','Service'],['status','Status'],['latency_ms','Latency'],['created_at','Checked']] },
  integrations: { title:'Integrations', description:'Provider metadata and connection state. Secrets stay server-side.', table:'platform_integrations', columns:[['name','Integration'],['provider','Provider'],['enabled','Enabled'],['created_at','Updated']] },
  backups: { title:'Backups & recovery', description:'Available backup metadata. Restore operations require explicit server-side approval.', table:'platform_backups', columns:[['provider_reference','Backup'],['status','Status'],['expires_at','Expires'],['created_at','Created']] },
  team: { title:'Platform team', description:'Platform roles and account status.', table:'platform_members', columns:[['full_name','Name'],['email','Email'],['role','Role'],['status','Status']] },
  notifications: { title:'Notifications', description:'Platform notifications assigned to your account.', table:'platform_notifications', columns:[['title','Title'],['body','Message'],['read_at','Read'],['created_at','Created']] },
  audit: { title:'Audit log', description:'Privileged platform actions with actor, target, outcome and timestamp.', table:'platform_audit_log', columns:[['operation','Operation'],['table_name','Target'],['actor_id','Actor'],['created_at','Created']] },
  analytics: { title:'Analytics', description:'Aggregate platform reporting sourced from tenant metadata and billing records.', table:'platform_usage', columns:[['tenant_id','Hospital'],['active_users','Users'],['storage_bytes','Storage'],['encounter_count','Encounters'],['created_at','Reported']] },
  settings: { title:'Platform settings', description:'Console preferences and support configuration.', table:'platform_settings', columns:[['display_name','Display name'],['support_email','Support email'],['renewal_notice_days','Renewal notice'],['created_at','Updated']] },
}
function renderValue(key, row) {
  const value = row[key]
  if (key.endsWith('_at') || key.endsWith('_date')) return dateLabel(value)
  if (key === 'status' || key === 'role' || key === 'priority' || key === 'billing_cycle' || key === 'provider') return <Badge>{value}</Badge>
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}
export default function PlatformModulePage({ module }) {
  const config = MODULES[module] || MODULES.analytics
  const resource = useResource(() => fetchAll(config.table))
  return <PlatformLayout><PageHeader title={config.title} description={config.description} /><ResourceState resource={resource}><section className="pc-panel"><Table rows={resource.data || []} columns={config.columns.map(([key,label]) => ({ key, label, render: row => renderValue(key,row) }))} /></section></ResourceState></PlatformLayout>
}
