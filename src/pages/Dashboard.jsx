import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { getSupabaseCount, getSupabaseData, isSupabaseFailure, withTimeout } from '../services/queryTimeout'
import { useAuth } from '../hooks/useAuth'
import { canAccessPlatformOnboarding } from '../constants/platformAccess'
import { useHospitalBranding } from '../hooks/useHospitalBranding'

/**
 * Dashboard Page
 * Overview and statistics for CareLink HMS
 * Redirects doctors to their specialized dashboard
 */

// Helper function to get time-based greeting
const getTimeGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

// Role-based welcome messages
const roleMessages = {
  admin: 'Manage your hospital operations and oversee all departments',
  owner: 'Monitor your hospital performance and growth metrics',
  pharmacist: 'Track prescriptions and manage pharmacy inventory',
  cashier: 'Process payments and manage billing operations',
  lab_tech: 'View laboratory requests and upload test results',
  default: 'Access your healthcare management tools'
}

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
    lowStockDrugs: 0
  })
  const [loading, setLoading] = useState(true)
  const [loadWarning, setLoadWarning] = useState('')
  const [recentActivities, setRecentActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  // Redirect doctors and nurses to their specialized dashboards
  useEffect(() => {
    if (userRole === 'doctor') {
      navigate('/doctor-dashboard', { replace: true })
    } else if (userRole === 'nurse') {
      navigate('/nurse-dashboard', { replace: true })
    } else if (userRole === 'records_officer') {
      navigate('/records', { replace: true })
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
          .limit(5),
        'Recent activities'
      )

      if (error) throw error

      // Map audit log entries to activity format with icons
      const activityIconMap = {
        'patient_registered': { icon: '🏥', color: 'bg-blue-100' },
        'prescription_created': { icon: '💊', color: 'bg-green-100' },
        'prescription_dispensed': { icon: '💊', color: 'bg-green-100' },
        'payment_created': { icon: '💰', color: 'bg-yellow-100' },
        'payment_processed': { icon: '💰', color: 'bg-yellow-100' },
        'lab_test_created': { icon: '📋', color: 'bg-purple-100' },
        'lab_result_uploaded': { icon: '📋', color: 'bg-purple-100' },
        'appointment_created': { icon: '📅', color: 'bg-indigo-100' },
        'claim_submitted': { icon: '🧾', color: 'bg-pink-100' },
        'user_created': { icon: '👤', color: 'bg-slate-100' },
        'default': { icon: '📝', color: 'bg-gray-100' }
      }

      const formattedActivities = (data || []).map(entry => {
        const config = activityIconMap[entry.action] || activityIconMap.default
        return {
          icon: config.icon,
          title: entry.description || formatActionName(entry.action),
          time: formatTimeAgo(entry.created_at),
          color: config.color
        }
      })

      setRecentActivities(formattedActivities)
    } catch (error) {
      console.error('Error fetching recent activities:', error)
      // Fallback to empty array instead of hardcoded data
      setRecentActivities([])
    }
  }

  // Helper to format action names
  const formatActionName = (action) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Helper to format time ago
  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffInSeconds = Math.floor((now - past) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    return `${Math.floor(diffInSeconds / 86400)} days ago`
  }

  const StatCard = ({ title, value, icon, gradient, subtitle }) => (
    <div className="card group cursor-pointer relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${gradient}`}></div>
      <div className="flex items-center justify-between pt-2">
        <div className="min-w-0 flex-1 pr-2">
          <h4 className="text-sm text-gray-600 font-medium truncate">{title}</h4>
          <h2 className="text-3xl font-bold text-slate-800 mt-2 truncate">{value}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>}
        </div>
        <div className="text-4xl opacity-80 group-hover:scale-110 transition-transform duration-200 shrink-0">{icon}</div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[320px] flex flex-col items-center justify-center text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Loading dashboard</h2>
          <p className="text-slate-600">Fetching summary data from CareLink.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loadWarning ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
            {loadWarning}
          </div>
        ) : null}

        {/* Enhanced Personalized Greeting */}
        <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50 rounded-xl shadow p-4 sm:p-5 border border-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                {branding.platformName}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-xs text-gray-600">Good {getTimeGreeting()},</p>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                  {user?.user_metadata?.full_name || 'Admin'}
                </h2>
              </div>
              <p className="text-gray-600 text-xs sm:text-sm mt-1">
                {roleMessages[userRole] || roleMessages.default} • {branding.hospitalName || hospitalDisplayName}
              </p>
            </div>
            <div className="text-3xl ml-3">👋</div>
          </div>
        </div>

        {showPlatformOnboarding ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-blue-900 shadow-sm">
            <h3 className="text-lg font-semibold">Platform owner tools are available</h3>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              Use the hospital onboarding hub to track new client rollouts, intake details, provisioning tasks, and go-live readiness across implementations.
            </p>
          </div>
        ) : null}

        {/* Featured Critical Alerts Card */}
        <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden">
          {/* Diagonal pattern background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0" 
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, white 10px, white 20px)'
              }}>
            </div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Today's Priority</h3>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/20 transition">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                  <span className="text-sm sm:text-base">Pending Claims</span>
                </div>
                <span className="font-bold text-2xl">{stats.pendingClaims}</span>
              </div>
              <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/20 transition">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                  <span className="text-sm sm:text-base">Low Stock Items</span>
                </div>
                <span className="font-bold text-2xl">{stats.lowStockDrugs}</span>
              </div>
              <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/20 transition">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="text-sm sm:text-base">Total Patients</span>
                </div>
                <span className="font-bold text-2xl">{stats.totalPatients}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <StatCard
            title="Total Patients"
            value={stats.totalPatients}
            icon="👥"
            gradient="from-blue-500 to-blue-600"
          />
          <StatCard
            title="Prescriptions"
            value={stats.totalPrescriptions}
            icon="📋"
            gradient="from-green-500 to-green-600"
          />
          <StatCard
            title="Total Revenue"
            value={`GH₵ ${stats.totalRevenue.toFixed(2)}`}
            icon="💰"
            gradient="from-yellow-500 to-yellow-600"
          />
          <StatCard
            title="Total Claims"
            value={stats.totalClaims}
            icon="🧾"
            gradient="from-purple-500 to-purple-600"
            subtitle={`${stats.pendingClaims} pending`}
          />
          <StatCard
            title="Low Stock Drugs"
            value={stats.lowStockDrugs}
            icon="⚠️"
            gradient="from-red-500 to-red-600"
            subtitle="Below 10 units"
          />
          <StatCard
            title="System Status"
            value="Active"
            icon="✅"
            gradient="from-green-500 to-emerald-600"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-4">Quick Actions</h3>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 ${showPlatformOnboarding ? 'xl:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {userRole === 'admin' ? (
              <Link
                to="/hospital-profile"
                className="flex items-center min-h-[44px] p-3 sm:p-4 bg-slate-800 text-white rounded-lg hover:bg-slate-900 active:bg-black transition"
              >
                <span className="mr-3 text-xl sm:text-2xl">HP</span>
                <span className="text-sm sm:text-base font-medium">Update Hospital Name</span>
              </Link>
            ) : null}
            <Link
              to="/patients/register"
              className="flex items-center min-h-[44px] p-3 sm:p-4 bg-primary text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition"
            >
              <span className="mr-3 text-xl sm:text-2xl">➕</span>
              <span className="text-sm sm:text-base font-medium">Register New Patient</span>
            </Link>
            <Link
              to="/pharmacy"
              className="flex items-center min-h-[44px] p-3 sm:p-4 bg-medical text-white rounded-lg hover:bg-green-600 active:bg-green-700 transition"
            >
              <span className="mr-3 text-xl sm:text-2xl">💊</span>
              <span className="text-sm sm:text-base font-medium">Pharmacy Dashboard</span>
            </Link>
            <Link
              to="/reports"
              className="flex items-center min-h-[44px] p-3 sm:p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 active:bg-purple-700 transition"
            >
              <span className="mr-3 text-xl sm:text-2xl">📊</span>
              <span className="text-sm sm:text-base font-medium">View Reports</span>
            </Link>
            {showPlatformOnboarding ? (
              <Link
                to="/hospital-onboarding"
                className="flex items-center min-h-[44px] p-3 sm:p-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:bg-slate-950 transition"
              >
                <span className="mr-3 text-xl sm:text-2xl">HM</span>
                <span className="text-sm sm:text-base font-medium">Onboard Hospitals</span>
              </Link>
            ) : null}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-slate-800">Recent Activity</h3>
            <button className="text-blue-600 text-sm hover:text-blue-700 font-medium transition">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No recent activity to display</p>
                <p className="text-xs mt-1">Activity will appear here as staff use the system</p>
              </div>
            ) : (
              recentActivities.map((activity, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition cursor-pointer group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.color} group-hover:scale-110 transition-transform`}>
                    <span className="text-xl">{activity.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
