import { useState, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

/**
 * Dashboard Page
 * Overview and statistics for CareLink HMS
 */

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalPrescriptions: 0,
    totalClaims: 0,
    pendingClaims: 0,
    totalRevenue: 0,
    lowStockDrugs: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // Fetch total patients
      const { count: patientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })

      // Fetch total prescriptions
      const { count: prescriptionsCount } = await supabase
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })

      // Fetch total claims
      const { count: claimsCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })

      // Fetch pending claims
      const { count: pendingClaimsCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // Fetch total revenue
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed')

      const totalRevenue = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0) || 0

      // Fetch low stock drugs
      const { count: lowStockCount } = await supabase
        .from('drugs')
        .select('*', { count: 'exact', head: true })
        .lt('stock', 10)

      setStats({
        totalPatients: patientsCount || 0,
        totalPrescriptions: prescriptionsCount || 0,
        totalClaims: claimsCount || 0,
        pendingClaims: pendingClaimsCount || 0,
        totalRevenue: totalRevenue,
        lowStockDrugs: lowStockCount || 0
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      toast.error('Failed to load dashboard statistics')
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
        <div className="flex items-center justify-center h-full">
          <div className="spinner"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
