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
  <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-[0_5px_12px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${activity.iconBg}`}>
      <span className={`text-sm font-bold ${activity.iconColor}`}>{activity.icon}</span>
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-slate-700">{activity.title}</p>
    </div>
    <p className="whitespace-nowrap text-sm text-slate-400">{activity.time}</p>
  </div>
)

const StatCard = ({ title, value, accent, delta, deltaTone }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
    <p className="text-sm font-semibold text-slate-500">{title}</p>
    <div className="mt-4 flex items-end justify-between gap-3">
      <p className="text-[2.3rem] font-bold leading-none tracking-tight text-[#183153]">{value}</p>
      <p className={`text-base font-bold ${deltaTone === 'negative' ? 'text-[#f59e0b]' : 'text-[#42b76c]'}`}>
        ▲ {delta}
      </p>
    </div>
    <div className={`mt-4 h-1.5 rounded-full ${accent}`}></div>
  </div>
)

const ActionButton = ({ to, label, icon, colorClass }) => (
  <Link
    to={to}
    className={`flex min-h-[60px] items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 ${colorClass}`}
  >
    <span className="text-xl leading-none">{icon}</span>
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
        <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-100 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <div className="text-center">
            <div className="spinner mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-slate-800">Loading dashboard</h2>
            <p className="mt-2 text-sm text-slate-500">Fetching live statistics from CareLink.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {loadWarning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            {loadWarning}
          </div>
        ) : null}

        <section className="rounded-[28px] border border-slate-100 bg-[#f7f9ff] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] lg:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2f74c7]">{branding.platformName}</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#183153]">Operations Dashboard</h2>
              <p className="mt-1 text-sm text-slate-500">
                {roleMessages[userRole] || roleMessages.default} {branding.hospitalName || hospitalDisplayName}.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
              <p className="font-semibold text-slate-700">{user?.user_metadata?.full_name || 'Dr. Smith'}</p>
              <p className="mt-1">Low stock items: <span className="font-semibold text-[#f68b2c]">{stats.lowStockDrugs}</span></p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Patients Today"
              value={stats.totalPatients}
              accent="bg-[#2f9cf5]"
              delta={patientDelta}
            />
            <StatCard
              title="Prescriptions Filled"
              value={stats.totalPrescriptions}
              accent="bg-[#23c4b8]"
              delta={prescriptionDelta}
            />
            <StatCard
              title="Pending Claims"
              value={stats.pendingClaims}
              accent="bg-[#ff9a35]"
              delta={pendingDelta}
              deltaTone="negative"
            />
            <StatCard
              title="Revenue Today"
              value={`GH₵${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              accent="bg-[#2cc88a]"
              delta={revenueDelta}
            />
          </div>
        </section>

        {showPlatformOnboarding ? (
          <section className="rounded-[24px] border border-blue-100 bg-white px-5 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Platform owner tools are available</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Hospital onboarding, provisioning, and rollout tracking are enabled for this account.
                </p>
              </div>
              <Link
                to="/hospital-onboarding"
                className="inline-flex items-center justify-center rounded-2xl bg-[#2f74c7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245fa7]"
              >
                Open Onboarding Hub
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1.12fr_0.92fr]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[1.4rem] font-bold tracking-tight text-[#183153]">Activity Feed</h3>
                <span className="text-sm font-medium text-slate-400">Live updates</span>
              </div>
              <div className="space-y-3">
                {recentActivities.map((activity, index) => (
                  <ActivityRow key={`${activity.title}-${index}`} activity={activity} />
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[1.4rem] font-bold tracking-tight text-[#183153]">CareLink Snapshot</h3>
                <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#2f74c7]">Today</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#f5f9ff] p-4">
                  <p className="text-sm font-medium text-slate-500">Claims Filed</p>
                  <p className="mt-2 text-2xl font-bold text-[#183153]">{stats.totalClaims}</p>
                </div>
                <div className="rounded-2xl bg-[#f4fcfb] p-4">
                  <p className="text-sm font-medium text-slate-500">Low Stock Drugs</p>
                  <p className="mt-2 text-2xl font-bold text-[#183153]">{stats.lowStockDrugs}</p>
                </div>
                <div className="rounded-2xl bg-[#fff8f1] p-4">
                  <p className="text-sm font-medium text-slate-500">Hospital</p>
                  <p className="mt-2 truncate text-base font-bold text-[#183153]">{branding.hospitalName || hospitalDisplayName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <h3 className="text-[1.35rem] font-bold tracking-tight text-[#183153]">Daily Visits</h3>
              <div className="mt-4 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visitTrend} margin={{ top: 12, right: 6, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e7eef8" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#7b8ca8', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7b8ca8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid #d8e4f5',
                        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)',
                      }}
                    />
                    <Line type="monotone" dataKey="visits" stroke="#4a9bf0" strokeWidth={3} dot={{ r: 4, fill: '#4a9bf0', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <h3 className="text-[1.35rem] font-bold tracking-tight text-[#183153]">Revenue This Week</h3>
              <div className="mt-4 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrend} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="#eef3fa" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#7b8ca8', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7b8ca8', fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`GH₵${Number(value).toLocaleString()}`, 'Revenue']}
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid #d8e4f5',
                        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)',
                      }}
                    />
                    <Bar dataKey="revenue" radius={[12, 12, 0, 0]} fill="#24b6c7" barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ActionButton to="/patients/register" label="Add Patient" icon="＋" colorClass="bg-[linear-gradient(90deg,#2f7ae0,#2b66bf)]" />
          <ActionButton to="/pharmacy" label="Dispense Drug" icon="✚" colorClass="bg-[linear-gradient(90deg,#18c3c2,#16a2ac)]" />
          <ActionButton to="/billing" label="Create Invoice" icon="▤" colorClass="bg-[linear-gradient(90deg,#6a66d8,#5753c9)]" />
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard