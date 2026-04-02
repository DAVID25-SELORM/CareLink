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
    { name: 'Dashboard', path: '/dashboard', icon: '📊', roles: ['admin', 'doctor', 'pharmacist'] },
    { name: 'Patients', path: '/patients', icon: '👥', roles: ['admin', 'doctor', 'pharmacist'] },
    { name: 'Pharmacy', path: '/pharmacy', icon: '💊', roles: ['admin', 'pharmacist'] },
    { name: 'Drugs', path: '/drugs', icon: '💉', roles: ['admin', 'pharmacist'] },
    { name: 'Billing', path: '/billing', icon: '💰', roles: ['admin'] },
    { name: 'Claims', path: '/claims', icon: '🧾', roles: ['admin'] },
    { name: 'Laboratory', path: '/laboratory', icon: '🧪', roles: ['admin', 'doctor'] },
    { name: 'Appointments', path: '/appointments', icon: '📅', roles: ['admin', 'doctor'] },
    { name: 'Reports', path: '/reports', icon: '📈', roles: ['admin'] },
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(userRole) || userRole === 'admin'
  )

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-primary text-white flex flex-col">
        <div className="p-6 bg-primary-dark">
          <h1 className="text-2xl font-bold">CareLink HMS</h1>
          <p className="text-xs mt-1 opacity-80">Hospital Management System</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-6 py-3 hover:bg-blue-600 transition ${
                location.pathname === item.path ? 'bg-blue-600 border-l-4 border-white' : ''
              }`}
            >
              <span className="mr-3 text-xl">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-600">
          <div className="text-sm mb-2">
            <div className="font-semibold">{user?.email}</div>
            <div className="text-xs opacity-75 capitalize">Role: {userRole}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-dark">
            {menuItems.find(item => item.path === location.pathname)?.name || 'CareLink HMS'}
          </h2>
          <div className="text-sm text-gray-600">
            {new Date().toLocaleDateString('en-GB', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 p-4 text-center text-sm text-gray-600">
          <p>CareLink HMS &copy; {new Date().getFullYear()} - Developed by David Gabion Selorm</p>
        </footer>
      </div>
    </div>
  )
}

export default DashboardLayout
