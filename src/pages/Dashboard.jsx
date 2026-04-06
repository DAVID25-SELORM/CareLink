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
  <div className="flex items-center gap-5 rounded-2xl border-2 border-slate-300 bg-white px-6 py-5 shadow-[0_10px_20px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-[0_20px_40px_rgba(15,23,42,0.15)]">
    <div className={`flex h-16 w-16 items-center justify-center rounded-full ${activity.iconBg} shadow-md`}>
      <span className={`text-2xl font-extrabold ${activity.iconColor}`}>{activity.icon}</span>
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-lg font-bold text-slate-900">{activity.title}</p>
    </div>
    <p className="whitespace-nowrap text-lg font-bold text-slate-600">{activity.time}</p>
  </div>
)

const StatCard = ({ title, value, accent, delta, deltaTone }) => (
  <div className="group rounded-2xl border-3 border-slate-300 bg-white p-7 shadow-[0_15px_40px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-1.5 hover:border-blue-400 hover:shadow-[0_25px_60px_rgba(15,23,42,0.18)]">
    <p className="text-lg font-extrabold uppercase tracking-wide text-slate-700">{title}</p>
    <div className="mt-6 flex items-end justify-between gap-4">
      <p className="text-[3.2rem] font-black leading-none tracking-tight text-[#0f172a]">{value}</p>
      <p className={`text-2xl font-black ${deltaTone === 'negative' ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>
        {deltaTone === 'negative' ? '▼' : '▲'} {delta}
      </p>
    </div>
    <div className={`mt-6 h-2.5 rounded-full ${accent} shadow-md`}></div>
  </div>
)

const ActionButton = ({ to, label, icon, colorClass }) => (
  <Link
    to={to}
    className={`flex min-h-[84px] items-center justify-center gap-5 rounded-2xl border-2 border-white/30 px-8 py-6 text-xl font-extrabold text-white shadow-[0_25px_50px_rgba(15,23,42,0.2)] transition-all duration-200 hover:-translate-y-2 hover:scale-[1.03] hover:shadow-[0_35px_70px_rgba(15,23,42,0.28)] active:scale-[0.98] ${colorClass}`}
  >
    <span className="text-3xl leading-none">{icon}</span>
    <span className="tracking-wide">{label}</span>
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
        <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border-2 border-slate-300 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.1)]">
          <div className="text-center">
            <div className="spinner mx-auto mb-5"></div>
            <h2 className="text-2xl font-extrabold text-slate-900">Loading dashboard</h2>
            <p className="mt-3 text-lg font-semibold text-slate-600">Fetching live statistics from CareLink.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loadWarning ? (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-6 py-4 text-base font-bold text-amber-900 shadow-md">
            {loadWarning}
          </div>
        ) : null}

        <section className="rounded-[32px] border-3 border-blue-300 bg-gradient-to-br from-[#f0f7ff] to-[#e6f2ff] p-8 shadow-[0_25px_55px_rgba(15,23,42,0.1)] lg:p-10">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-black uppercase tracking-[0.28em] text-[#2563eb]">{branding.platformName}</p>
              <h2 className="mt-4 text-5xl font-black tracking-tight text-[#0f172a]">Operations Dashboard</h2>
              <p className="mt-3 text-lg font-bold text-slate-700">
                {roleMessages[userRole] || roleMessages.default} {branding.hospitalName || hospitalDisplayName}.
              </p>
            </div>
            <div className="rounded-2xl border-3 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 px-6 py-5 shadow-xl">
              <p className="text-lg font-black text-slate-900">{user?.user_metadata?.full_name || 'Dr. Smith'}</p>
              <p className="mt-2.5 text-base font-extrabold text-slate-700">Low stock items: <span className="text-xl font-black text-[#ea580c]">{stats.lowStockDrugs}</span></p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
          <section className="rounded-[24px] border-2 border-blue-200 bg-white px-7 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Platform owner tools are available</h3>
                <p className="mt-2 text-base font-semibold text-slate-600">
                  Hospital onboarding, provisioning, and rollout tracking are enabled for this account.
                </p>
              </div>
              <Link
                to="/hospital-onboarding"
                className="inline-flex items-center justify-center rounded-2xl bg-[#2f74c7] px-7 py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-[#245fa7] hover:shadow-xl active:scale-95"
              >
                Open Onboarding Hub
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.92fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border-3 border-slate-300 bg-white p-7 shadow-[0_25px_55px_rgba(15,23,42,0.1)]">
              <div className="mb-7 flex items-center justify-between border-b-2 border-slate-200 pb-5">
                <h3 className="text-[2rem] font-black tracking-tight text-[#0f172a]">Activity Feed</h3>
                <span className="rounded-full bg-blue-100 px-5 py-2.5 text-base font-extrabold text-blue-700 shadow-md">Live updates</span>
              </div>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <ActivityRow key={`${activity.title}-${index}`} activity={activity} />
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border-3 border-slate-300 bg-white p-7 shadow-[0_25px_55px_rgba(15,23,42,0.1)]">
              <div className="mb-7 flex items-center justify-between border-b-2 border-slate-200 pb-5">
                <h3 className="text-[2rem] font-black tracking-tight text-[#0f172a]">CareLink Snapshot</h3>
                <span className="rounded-full bg-blue-600 px-5 py-2.5 text-base font-black uppercase tracking-[0.18em] text-white shadow-xl">Today</span>
              </div>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="rounded-2xl border-3 border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-lg">
                  <p className="text-base font-extrabold uppercase tracking-wider text-blue-800">Claims Filed</p>
                  <p className="mt-4 text-4xl font-black text-[#0f172a]">{stats.totalClaims}</p>
                </div>
                <div className="rounded-2xl border-3 border-teal-300 bg-gradient-to-br from-teal-50 to-teal-100 p-6 shadow-lg">
                  <p className="text-base font-extrabold uppercase tracking-wider text-teal-800">Low Stock Drugs</p>
                  <p className="mt-4 text-4xl font-black text-[#0f172a]">{stats.lowStockDrugs}</p>
                </div>
                <div className="rounded-2xl border-3 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100 p-6 shadow-lg">
                  <p className="text-base font-extrabold uppercase tracking-wider text-amber-800">Hospital</p>
                  <p className="mt-4 truncate text-xl font-black text-[#0f172a]">{branding.hospitalName || hospitalDisplayName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border-3 border-slate-300 bg-white p-7 shadow-[0_25px_55px_rgba(15,23,42,0.1)]">
              <h3 className="mb-3 text-[2rem] font-black tracking-tight text-[#0f172a]">Daily Visits</h3>
              <div className="mt-5 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visitTrend} margin={{ top: 12, right: 6, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeWidth={1.5} vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 14, fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 14, fontWeight: 600 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        border: '2px solid #cbd5e1',
                        boxShadow: '0 24px 48px rgba(15, 23, 42, 0.15)',
                        fontSize: '15px',
                        fontWeight: 700,
                      }}
                    />
                    <Line type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={4} dot={{ r: 5, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 3 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[28px] border-3 border-slate-300 bg-white p-7 shadow-[0_25px_55px_rgba(15,23,42,0.1)]">
              <h3 className="mb-3 text-[2rem] font-black tracking-tight text-[#0f172a]">Revenue This Week</h3>
              <div className="mt-5 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrend} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeWidth={1.5} vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 14, fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 14, fontWeight: 600 }} />
                    <Tooltip
                      formatter={(value) => [`GH₵${Number(value).toLocaleString()}`, 'Revenue']}
                      contentStyle={{
                        borderRadius: '16px',
                        border: '2px solid #cbd5e1',
                        boxShadow: '0 24px 48px rgba(15, 23, 42, 0.15)',
                        fontSize: '15px',
                        fontWeight: 700,
                      }}
                    />
                    <Bar dataKey="revenue" radius={[12, 12, 0, 0]} fill="#14b8a6" barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <ActionButton to="/patients/register" label="Add Patient" icon="＋" colorClass="bg-[linear-gradient(90deg,#2f7ae0,#2b66bf)]" />
          <ActionButton to="/pharmacy" label="Dispense Drug" icon="✚" colorClass="bg-[linear-gradient(90deg,#18c3c2,#16a2ac)]" />
          <ActionButton to="/billing" label="Create Invoice" icon="▤" colorClass="bg-[linear-gradient(90deg,#6a66d8,#5753c9)]" />
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard