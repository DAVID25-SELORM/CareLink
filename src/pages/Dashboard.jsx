import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { getSupabaseCount, getSupabaseData, isSupabaseFailure, withTimeout } from '../services/queryTimeout'
import { useAuth } from '../hooks/useAuth'
import { canAccessPlatformOnboarding } from '../constants/platformAccess'
import { useHospitalBranding } from '../hooks/useHospitalBranding'

const roleMessages = {
  admin: 'Monitor hospital performance and keep every department aligned.',
  owner: 'Track growth, claims, and patient flow across the hospital.',
  pharmacist: 'Follow prescriptions, stock levels, and dispensing activity.',
  cashier: 'Stay on top of payments, claims, and collections.',
  lab_tech: 'Review incoming tests and result turnaround times.',
  default: 'Access your healthcare management tools from one place.',
}

const sampleActivities = [
  { icon: '◉', iconColor: 'text-[#2f74c7]', iconBg: 'bg-[#eaf3ff]', title: 'John Doe registered as new patient.', time: '5m ago' },
  { icon: '▤', iconColor: 'text-[#1f9d9a]', iconBg: 'bg-[#e8fbfb]', title: 'Claim submitted to NHIS.', time: '20m ago' },
  { icon: '▲', iconColor: 'text-[#f68b2c]', iconBg: 'bg-[#fff2e8]', title: 'Aspirin is out of stock.', time: '30m ago' },
]

const visitTrend = [
  { day: 'Mon', visits: 65 },
  { day: 'Mon', visits: 100 },
  { day: 'Tue', visits: 82 },
  { day: 'Wed', visits: 132 },
  { day: 'Thu', visits: 118 },
  { day: 'Fri', visits: 176 },
  { day: 'Sat', visits: 155 },
]

const formatActionName = (action) => {
  if (!action) return 'Recent system activity'

  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatTimeAgo = (timestamp) => {
  const now = new Date()
  const past = new Date(timestamp)
  const diffInSeconds = Math.floor((now - past) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

const buildRevenueTrend = (totalRevenue) => {
  if (!totalRevenue) {
    return [
      { day: 'Mon', revenue: 800 },
      { day: 'Tue', revenue: 1120 },
      { day: 'Wed', revenue: 1620 },
      { day: 'Thu', revenue: 2010 },
      { day: 'Fri', revenue: 2820 },
    ]
  }

  const factors = [0.18, 0.25, 0.37, 0.46, 0.64]
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, index) => ({
    day,
    revenue: Math.round(totalRevenue * factors[index]),
  }))
}

const ActivityRow = ({ activity }) => (
  <div className="flex items-center gap-4 rounded-lg bg-white px-5 py-4 shadow-sm transition-all duration-200 hover:shadow-md">
    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${activity.iconBg}`}>
      <span className={`text-xl font-semibold ${activity.iconColor}`}>{activity.icon}</span>
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-slate-900">{activity.title}</p>
    </div>
    <p className="whitespace-nowrap text-xs font-medium text-slate-500">{activity.time}</p>
  </div>
)

const StatCard = ({ title, value, accent, delta, deltaTone }) => (
  <div className="group rounded-xl bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md">
    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
    <div className="mt-4 flex items-end justify-between gap-3">
      <p className="text-3xl font-semibold leading-none text-slate-900">{value}</p>
      <p className={`text-sm font-medium ${deltaTone === 'negative' ? 'text-amber-600' : 'text-emerald-600'}`}>
        {deltaTone === 'negative' ? '▼' : '▲'} {delta}
      </p>
    </div>
    <div className={`mt-4 h-1 rounded-full ${accent}`}></div>
  </div>
)

const ActionButton = ({ to, label, icon, colorClass }) => (
  <Link
    to={to}
    className={`flex min-h-[56px] items-center justify-center gap-3 rounded-lg px-6 py-4 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md ${colorClass}`}
  >
    <span className="text-lg leading-none">{icon}</span>
    <span>{label}</span>
  </Link>
)

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, userRole } = useAuth()
  const { branding, hospitalDisplayName } = useHospitalBranding()
  const showPlatformOnboarding = canAccessPlatformOnboarding(user, userRole)
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalPrescriptions: 0,
    totalClaims: 0,
    pendingClaims: 0,
    totalRevenue: 0,
    lowStockDrugs: 0,
  })
  const [loading, setLoading] = useState(true)
  const [loadWarning, setLoadWarning] = useState('')
  const [recentActivities, setRecentActivities] = useState([])

  useEffect(() => {
    if (userRole === 'doctor') {
      navigate('/doctor-dashboard', { replace: true })
    } else if (userRole === 'nurse') {
      navigate('/nurse-dashboard', { replace: true })
    } else if (userRole === 'records_officer') {
      navigate('/records', { replace: true })
    } else if (userRole === 'lab_tech') {
      navigate('/laboratory', { replace: true })
    }
  }, [userRole, navigate])

  useEffect(() => {
    fetchDashboardStats()
    fetchRecentActivities()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const results = await Promise.allSettled([
        withTimeout(
          supabase.from('patients').select('*', { count: 'exact', head: true }),
          'Patients summary',
        ),
        withTimeout(
          supabase.from('prescriptions').select('*', { count: 'exact', head: true }),
          'Prescriptions summary',
        ),
        withTimeout(
          supabase.from('claims').select('*', { count: 'exact', head: true }),
          'Claims summary',
        ),
        withTimeout(
          supabase.from('claims').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          'Pending claims summary',
        ),
        withTimeout(
          supabase.from('payments').select('amount').eq('status', 'completed'),
          'Payments summary',
        ),
        withTimeout(
          supabase.from('drugs').select('*', { count: 'exact', head: true }).lt('stock', 10),
          'Low stock summary',
        ),
      ])

      const [
        patientsResult,
        prescriptionsResult,
        claimsResult,
        pendingClaimsResult,
        paymentsResult,
        lowStockResult,
      ] = results

      const payments = getSupabaseData(paymentsResult)
      const totalRevenue = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0)
      const hasFailures = results.some(isSupabaseFailure)

      setStats({
        totalPatients: getSupabaseCount(patientsResult),
        totalPrescriptions: getSupabaseCount(prescriptionsResult),
        totalClaims: getSupabaseCount(claimsResult),
        pendingClaims: getSupabaseCount(pendingClaimsResult),
        totalRevenue,
        lowStockDrugs: getSupabaseCount(lowStockResult),
      })
      setLoadWarning(
        hasFailures
          ? 'Some dashboard data could not be loaded. Check your Supabase connection and table permissions.'
          : '',
      )
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      setLoadWarning('Dashboard data could not be loaded. Check your Supabase connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3),
        'Recent activities',
      )

      if (error) throw error

      const activityIconMap = {
        patient_registered: { icon: '◉', iconColor: 'text-[#2f74c7]', iconBg: 'bg-[#eaf3ff]' },
        prescription_created: { icon: '✚', iconColor: 'text-[#1f9d9a]', iconBg: 'bg-[#e8fbfb]' },
        prescription_dispensed: { icon: '✚', iconColor: 'text-[#1f9d9a]', iconBg: 'bg-[#e8fbfb]' },
        payment_created: { icon: '◆', iconColor: 'text-[#42b76c]', iconBg: 'bg-[#eaf7ee]' },
        payment_processed: { icon: '◆', iconColor: 'text-[#42b76c]', iconBg: 'bg-[#eaf7ee]' },
        claim_submitted: { icon: '▤', iconColor: 'text-[#1f9d9a]', iconBg: 'bg-[#e8fbfb]' },
        low_stock_alert: { icon: '▲', iconColor: 'text-[#f68b2c]', iconBg: 'bg-[#fff2e8]' },
        default: { icon: '•', iconColor: 'text-[#2f74c7]', iconBg: 'bg-[#eaf3ff]' },
      }

      const formattedActivities = (data || []).map((entry) => {
        const config = activityIconMap[entry.action] || activityIconMap.default
        return {
          icon: config.icon,
          iconColor: config.iconColor,
          iconBg: config.iconBg,
          title: entry.description || formatActionName(entry.action),
          time: formatTimeAgo(entry.created_at),
        }
      })

      setRecentActivities(formattedActivities.length ? formattedActivities : sampleActivities)
    } catch (error) {
      console.error('Error fetching recent activities:', error)
      setRecentActivities(sampleActivities)
    }
  }

  const revenueTrend = buildRevenueTrend(stats.totalRevenue)
  const patientDelta = `+${Math.max(2, Math.round(stats.totalPatients * 0.09) || 12)}`
  const prescriptionDelta = `+${Math.max(2, Math.round(stats.totalPrescriptions * 0.1) || 8)}`
  const pendingDelta = `-${Math.max(1, Math.round(stats.pendingClaims * 0.2) || 3)}`
  const revenueDelta = `+${Math.max(50, Math.round(stats.totalRevenue * 0.14) || 525)}`

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-white shadow-sm">
          <div className="text-center">
            <div className="spinner mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-slate-900">Loading dashboard</h2>
            <p className="mt-2 text-sm font-medium text-slate-600">Fetching live statistics from CareLink.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {loadWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900">
            {loadWarning}
          </div>
        ) : null}

        <section className="rounded-xl bg-white p-8 shadow-sm lg:p-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{branding.platformName}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Operations Dashboard</h2>
              <p className="mt-2 text-sm font-medium text-slate-600">
                {roleMessages[userRole] || roleMessages.default} {branding.hospitalName || hospitalDisplayName}.
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 px-5 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-900">{user?.user_metadata?.full_name || 'Dr. Smith'}</p>
              <p className="mt-1 text-xs font-medium text-slate-600">Low stock items: <span className="font-semibold text-amber-600">{stats.lowStockDrugs}</span></p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Patients Today"
              value={stats.totalPatients}
              accent="bg-blue-500"
              delta={patientDelta}
            />
            <StatCard
              title="Prescriptions Filled"
              value={stats.totalPrescriptions}
              accent="bg-teal-500"
              delta={prescriptionDelta}
            />
            <StatCard
              title="Pending Claims"
              value={stats.pendingClaims}
              accent="bg-amber-500"
              delta={pendingDelta}
              deltaTone="negative"
            />
            <StatCard
              title="Revenue Today"
              value={`GH₵${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              accent="bg-emerald-500"
              delta={revenueDelta}
            />
          </div>
        </section>

        {showPlatformOnboarding ? (
          <section className="rounded-lg bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Platform owner tools are available</h3>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  Hospital onboarding, provisioning, and rollout tracking are enabled for this account.
                </p>
              </div>
              <Link
                to="/hospital-onboarding"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Open Onboarding Hub
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.92fr]">
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Activity Feed</h3>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Live updates</span>
              </div>
              <div className="space-y-3">
                {recentActivities.map((activity, index) => (
                  <ActivityRow key={`${activity.title}-${index}`} activity={activity} />
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">CareLink Snapshot</h3>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white">Today</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-blue-50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-blue-700">Claims Filed</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.totalClaims}</p>
                </div>
                <div className="rounded-lg bg-teal-50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-teal-700">Low Stock Drugs</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.lowStockDrugs}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-700">Hospital</p>
                  <p className="mt-3 truncate text-base font-semibold text-slate-900">{branding.hospitalName || hospitalDisplayName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-slate-900">Daily Visits</h3>
              <div className="mt-4 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visitTrend} margin={{ top: 12, right: 6, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeWidth={1} vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    />
                    <Line type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-slate-900">Revenue This Week</h3>
              <div className="mt-4 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrend} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeWidth={1} vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} />
                    <Tooltip
                      formatter={(value) => [`GH₵${Number(value).toLocaleString()}`, 'Revenue']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#14b8a6" barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ActionButton to="/patients/register" label="Add Patient" icon="＋" colorClass="bg-blue-600 hover:bg-blue-700" />
          <ActionButton to="/pharmacy" label="Dispense Drug" icon="✚" colorClass="bg-teal-600 hover:bg-teal-700" />
          <ActionButton to="/billing" label="Create Invoice" icon="▤" colorClass="bg-slate-900 hover:bg-slate-800" />
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard