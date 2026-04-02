import { useState, useEffect } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

/**
 * Reports & Analytics Page
 * Comprehensive analytics for hospital operations
 * 
 * Author: David Gabion Selorm
 */

const Reports = () => {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState({
    totalPatients: 0,
    totalRevenue: 0,
    totalClaims: 0,
    pendingClaims: 0,
    approvedClaims: 0,
    totalPrescriptions: 0,
    lowStockDrugs: 0,
    revenueByMethod: [],
    claimsByStatus: [],
    monthlyRevenue: [],
    topDrugs: [],
  })

  const COLORS = ['#1E88E5', '#2ECC71', '#F39C12', '#E74C3C', '#9B59B6']

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      // Total patients
      const { count: patientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })

      // Total prescriptions
      const { count: prescriptionsCount } = await supabase
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })

      // Total claims
      const { count: claimsCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })

      // Claims by status
      const { count: pendingClaimsCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: approvedClaimsCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')

      // Total revenue
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_method, created_at')
        .eq('status', 'completed')

      const totalRevenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0

      // Revenue by payment method
      const revenueByMethod = payments?.reduce((acc, payment) => {
        const method = payment.payment_method || 'unknown'
        const existing = acc.find((item) => item.name === method)
        if (existing) {
          existing.value += parseFloat(payment.amount || 0)
        } else {
          acc.push({ name: method, value: parseFloat(payment.amount || 0) })
        }
        return acc
      }, []) || []

      // Monthly revenue (last 6 months)
      const monthlyRevenue = payments?.reduce((acc, payment) => {
        const month = new Date(payment.created_at).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
        const existing = acc.find((item) => item.month === month)
        if (existing) {
          existing.revenue += parseFloat(payment.amount || 0)
        } else {
          acc.push({ month, revenue: parseFloat(payment.amount || 0) })
        }
        return acc
      }, []) || []

      // Low stock drugs
      const { count: lowStockCount } = await supabase
        .from('drugs')
        .select('*', { count: 'exact', head: true })
        .lt('stock', 10)

      // Top prescribed drugs
      const { data: prescriptionItems } = await supabase
        .from('prescription_items')
        .select('drug_name, quantity')

      const topDrugs = prescriptionItems?.reduce((acc, item) => {
        const existing = acc.find((d) => d.name === item.drug_name)
        if (existing) {
          existing.count += item.quantity
        } else {
          acc.push({ name: item.drug_name, count: item.quantity })
        }
        return acc
      }, [])
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) || []

      // Claims by status
      const { data: allClaims } = await supabase.from('claims').select('status')

      const claimsByStatus = allClaims?.reduce((acc, claim) => {
        const status = claim.status || 'unknown'
        const existing = acc.find((item) => item.name === status)
        if (existing) {
          existing.value += 1
        } else {
          acc.push({ name: status, value: 1 })
        }
        return acc
      }, []) || []

      setAnalytics({
        totalPatients: patientsCount || 0,
        totalRevenue,
        totalClaims: claimsCount || 0,
        pendingClaims: pendingClaimsCount || 0,
        approvedClaims: approvedClaimsCount || 0,
        totalPrescriptions: prescriptionsCount || 0,
        lowStockDrugs: lowStockCount || 0,
        revenueByMethod,
        claimsByStatus,
        monthlyRevenue: monthlyRevenue.slice(-6),
        topDrugs,
      })
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

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
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800">Reports & Analytics</h2>
          <p className="text-gray-600 mt-1">Comprehensive insights into hospital operations</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-sm font-medium text-gray-600">Total Patients</p>
            <p className="text-3xl font-bold mt-2">{analytics.totalPatients}</p>
            <p className="text-xs text-gray-500 mt-1">All registered patients</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
            <p className="text-3xl font-bold mt-2">GH₵ {analytics.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">All time revenue</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <p className="text-sm font-medium text-gray-600">Pending Claims</p>
            <p className="text-3xl font-bold mt-2">{analytics.pendingClaims}</p>
            <p className="text-xs text-gray-500 mt-1">
              Out of {analytics.totalClaims} total
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <p className="text-sm font-medium text-gray-600">Low Stock Drugs</p>
            <p className="text-3xl font-bold mt-2">{analytics.lowStockDrugs}</p>
            <p className="text-xs text-gray-500 mt-1">Drugs below 10 units</p>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Revenue Trend</h3>
            {analytics.monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#1E88E5"
                    strokeWidth={2}
                    name="Revenue (GH₵)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No revenue data available</p>
            )}
          </div>

          {/* Revenue by Payment Method */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue by Payment Method</h3>
            {analytics.revenueByMethod.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.revenueByMethod}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.revenueByMethod.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No payment data available</p>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Prescribed Drugs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Top Prescribed Drugs</h3>
            {analytics.topDrugs.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.topDrugs}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#2ECC71" name="Quantity Prescribed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No prescription data available</p>
            )}
          </div>

          {/* Claims by Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Claims by Status</h3>
            {analytics.claimsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.claimsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.claimsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No claims data available</p>
            )}
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Operations Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Prescriptions</p>
              <p className="text-2xl font-bold">{analytics.totalPrescriptions}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Claims Approved</p>
              <p className="text-2xl font-bold">{analytics.approvedClaims}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Approval Rate</p>
              <p className="text-2xl font-bold">
                {analytics.totalClaims > 0
                  ? ((analytics.approvedClaims / analytics.totalClaims) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Reports
