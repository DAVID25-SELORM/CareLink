import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { getSupabaseCount, getSupabaseData, isSupabaseFailure, withTimeout } from '../services/queryTimeout'
import { useAuth } from '../hooks/useAuth'

/**
 * Dashboard Page
 * Overview and statistics for CareLink HMS
 * Redirects doctors to their specialized dashboard
 */

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, userRole } = useAuth()
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
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <h3 className="text-3xl font-bold mt-2">{value}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl">{icon}</div>
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

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-dark mb-2">Welcome to CareLink HMS</h2>
          <p className="text-gray-600">Your comprehensive hospital management solution</p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/patients/register"
              className="flex items-center p-4 bg-primary text-white rounded-lg hover:bg-blue-600 transition"
            >
              <span className="mr-3 text-2xl">➕</span>
              <span className="font-medium">Register New Patient</span>
            </a>
            <a
              href="/pharmacy"
              className="flex items-center p-4 bg-medical text-white rounded-lg hover:bg-green-600 transition"
            >
              <span className="mr-3 text-2xl">💊</span>
              <span className="font-medium">Pharmacy Dashboard</span>
            </a>
            <a
              href="/reports"
              className="flex items-center p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              <span className="mr-3 text-2xl">📊</span>
              <span className="font-medium">View Reports</span>
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
