import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Protected Route Component
 * Ensures only authenticated users can access protected pages
 * and optionally restricts access by role.
 */

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, userRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="spinner mx-auto mb-4"></div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Loading CareLink</h1>
          <p className="text-slate-600">
            We are checking your session and preparing the page.
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-2xl font-bold text-dark mb-3">Access Restricted</h1>
          <p className="text-gray-600 mb-6">
            Your current role does not have permission to open this page.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Signed in as: <span className="font-semibold capitalize">{userRole || 'unknown'}</span>
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute
