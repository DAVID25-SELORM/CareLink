import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Dashboard Layout Component
 * Provides consistent sidebar navigation and header across all pages
 */

const DashboardLayout = ({ children }) => {
  const { user, userRole, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'DB', roles: ['admin', 'doctor', 'pharmacist'] },
    { name: 'Patients', path: '/patients', icon: 'PT', roles: ['admin', 'doctor', 'pharmacist'] },
    { name: 'Prescriptions', path: '/prescriptions', icon: 'Rx', roles: ['admin', 'doctor'] },
    { name: 'Pharmacy', path: '/pharmacy', icon: 'PH', roles: ['admin', 'pharmacist'] },
    { name: 'Drugs', path: '/drugs', icon: 'DR', roles: ['admin', 'pharmacist'] },
    { name: 'Billing', path: '/billing', icon: 'BL', roles: ['admin'] },
    { name: 'Claims', path: '/claims', icon: 'CL', roles: ['admin'] },
    { name: 'Laboratory', path: '/laboratory', icon: 'LB', roles: ['admin', 'doctor'] },
    { name: 'Appointments', path: '/appointments', icon: 'AP', roles: ['admin', 'doctor'] },
    { name: 'Reports', path: '/reports', icon: 'RP', roles: ['admin'] },
  ]

  const filteredMenuItems = menuItems.filter((item) => {
    if (userRole === 'admin') return true
    if (!userRole || userRole === 'staff') {
      return ['/dashboard', '/patients', '/patients/register'].includes(item.path)
    }
    return item.roles.includes(userRole)
  })

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-lg">
        <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-700">
          <h1 className="text-2xl font-bold text-white">CareLink</h1>
          <p className="text-xs mt-1 text-blue-100">Hospital Management</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-2.5 mb-1 rounded-lg transition-all-smooth ${
                location.pathname === item.path
                  ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="mr-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {item.icon}
              </span>
              <span className="text-sm">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm mb-3">
            <div className="font-medium text-slate-800 truncate">{user?.email}</div>
            <div className="text-xs text-slate-500 capitalize mt-0.5">{userRole}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all-smooth"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {menuItems.find((item) => item.path === location.pathname)?.name || 'Dashboard'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {children}
        </main>

        <footer className="bg-white border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
          <p>(c) {new Date().getFullYear()} CareLink | Built by David Gabion Selorm</p>
        </footer>
      </div>
    </div>
  )
}

export default DashboardLayout
