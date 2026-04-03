import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { getSupabaseCount, getSupabaseData, isSupabaseFailure, withTimeout } from '../services/queryTimeout'
import { useAuth } from '../hooks/useAuth'
import { canAccessPlatformOnboarding } from '../constants/platformAccess'

/**
 * Dashboard Page
 * Overview and statistics for CareLink HMS
 * Redirects doctors to their specialized dashboard
 */

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, userRole } = useAuth()
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

  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <div className={`bg-white rounded-lg shadow p-4 sm:p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-gray-600 text-xs sm:text-sm font-medium truncate">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate">{value}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>}
        </div>
        <div className="text-3xl sm:text-4xl shrink-0">{icon}</div>
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

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-dark mb-2">Welcome to CareLink HMS</h2>
          <p className="text-sm sm:text-base text-gray-600">Your comprehensive hospital management solution</p>
        </div>

        {showPlatformOnboarding ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-blue-900 shadow-sm">
            <h3 className="text-lg font-semibold">Platform owner tools are available</h3>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              Use the hospital onboarding hub to track new client rollouts, intake details, provisioning tasks, and go-live readiness across implementations.
            </p>
          </div>
        ) : null}

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <StatCard
            title="Total Patients"
            value={stats.totalPatients}
            icon="👥"
            color="border-blue-500"
          />
          <StatCard
            title="Prescriptions"
            value={stats.totalPrescriptions}
            icon="📋"
            color="border-green-500"
          />
          <StatCard
            title="Total Revenue"
            value={`GH₵ ${stats.totalRevenue.toFixed(2)}`}
            icon="💰"
            color="border-yellow-500"
          />
          <StatCard
            title="Total Claims"
            value={stats.totalClaims}
            icon="🧾"
            color="border-purple-500"
            subtitle={`${stats.pendingClaims} pending`}
          />
          <StatCard
            title="Low Stock Drugs"
            value={stats.lowStockDrugs}
            icon="⚠️"
            color="border-red-500"
            subtitle="Below 10 units"
          />
          <StatCard
            title="System Status"
            value="Active"
            icon="✅"
            color="border-green-500"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-4">Quick Actions</h3>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 ${showPlatformOnboarding ? 'xl:grid-cols-4' : 'lg:grid-cols-3'}`}>
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
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
