import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import carelinkLogo from '../assets/carelink-logo.svg'

/**
 * Dashboard Layout Component
 * Provides consistent sidebar navigation and header across all pages
 */

const DashboardLayout = ({ children }) => {
  const { user, userRole, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'DB', roles: ['admin', 'doctor', 'pharmacist', 'cashier'] },
    { name: 'Patients', path: '/patients', icon: 'PT', roles: ['admin', 'doctor', 'pharmacist'] },
    { name: 'Prescriptions', path: '/prescriptions', icon: 'Rx', roles: ['admin', 'doctor'] },
    { name: 'Cashier', path: '/cashier', icon: '💰', roles: ['admin', 'cashier'] },
    { name: 'Pharmacy', path: '/pharmacy', icon: 'PH', roles: ['admin', 'pharmacist'] },
    { name: 'Drugs', path: '/drugs', icon: 'DR', roles: ['admin', 'pharmacist'] },
    { name: 'Billing', path: '/billing', icon: 'BL', roles: ['admin'] },
    { name: 'Claims', path: '/claims', icon: 'CL', roles: ['admin'] },
    { name: 'Laboratory', path: '/laboratory', icon: 'LB', roles: ['admin', 'doctor'] },
    { name: 'Appointments', path: '/appointments', icon: 'AP', roles: ['admin', 'doctor'] },
    { name: 'Reports', path: '/reports', icon: 'RP', roles: ['admin'] },
    { name: 'Users', path: '/users', icon: '👥', roles: ['admin'] },
  ]

  const filteredMenuItems = menuItems.filter((item) => {
    if (userRole === 'admin') return true
    if (!userRole || userRole === 'staff') {
      return ['/dashboard', '/patients', '/patients/register'].includes(item.path)
    }
    return item.roles.includes(userRole)
  })

  return (
    <div className="min-h-screen bg-slate-50 lg:flex lg:h-screen">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-lg transition-transform duration-300 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="bg-gradient-to-br from-slate-950 via-blue-900 to-emerald-700 p-5">
          <div className="mb-3 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-full border border-white/25 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/90"
            >
              Close
            </button>
          </div>
          <div className="rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-white/70">
            <img
              src={carelinkLogo}
              alt="CareLink HMS logo"
              className="mx-auto h-16 w-auto"
            />
          </div>
          <p className="mt-3 text-center text-[11px] uppercase tracking-[0.18em] text-blue-100">
            Connecting Care, Simplifying Healthcare
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileNavOpen(false)}
              className={`mb-1 flex items-center rounded-lg px-4 py-2.5 transition-all-smooth ${
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

        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 text-sm">
            <div className="truncate font-medium text-slate-800">{user?.email}</div>
            <div className="mt-0.5 text-xs capitalize text-slate-500">{userRole}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-all-smooth hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col lg:h-screen">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm lg:hidden"
              >
                Menu
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-800 sm:text-xl">
                  {menuItems.find((item) => item.path === location.pathname)?.name || 'Dashboard'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date().toLocaleDateString('en-GB', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6">
          <p>(c) {new Date().getFullYear()} CareLink | Built by David Gabion Selorm</p>
        </footer>
      </div>
    </div>
  )
}

export default DashboardLayout
