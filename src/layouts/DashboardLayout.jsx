import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import carelinkLogo from '../assets/carelink-logo.svg'
import { canAccessPlatformOnboarding } from '../constants/platformAccess'
import NotificationCenter from '../components/NotificationCenter'
import GlobalSearch from '../components/GlobalSearch'
import { initDarkMode, toggleDarkMode, getCurrentTheme } from '../utils/darkMode'

/**
 * Dashboard Layout Component
 * Provides consistent sidebar navigation and header across all pages
 */

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

const DashboardLayout = ({ children }) => {
  const { user, userRole, signOut } = useAuth()
  const { branding, hospitalDisplayName } = useHospitalBranding()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDarkMode, setIsDarkMode] = useState(false)
  const inactivityTimer = useRef(null)
  const showPlatformOnboarding = canAccessPlatformOnboarding(user, userRole)

  // Initialize dark mode on mount
  useEffect(() => {
    initDarkMode()
    setIsDarkMode(getCurrentTheme() === 'dark')
  }, [])

  const handleDarkModeToggle = () => {
    const isDark = toggleDarkMode()
    setIsDarkMode(isDark)
  }

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Session inactivity timeout
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(async () => {
      toast.warning('Session expired due to inactivity. Please sign in again.')
      await signOut()
      navigate('/login')
    }, INACTIVITY_TIMEOUT_MS)
  }, [signOut, navigate])

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetInactivityTimer))
    resetInactivityTimer() // Start timer on mount
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [resetInactivityTimer])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'DB', roles: ['admin', 'doctor', 'pharmacist', 'cashier', 'nurse', 'records_officer'] },
    { name: 'Hospitals', path: '/hospital-onboarding', icon: 'HM', roles: ['admin'], ownerOnly: true },
    { name: 'Hospital Profile', path: '/hospital-profile', icon: 'HP', roles: ['admin'] },
    { name: 'Patients', path: '/patients', icon: 'PT', roles: ['admin', 'doctor', 'pharmacist', 'nurse', 'records_officer'] },
    { name: 'Queue Management', path: '/queue-management', icon: '🎫', roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'cashier', 'records_officer'] },
    { name: 'Triage', path: '/triage', icon: '🚨', roles: ['admin', 'doctor', 'nurse'] },
    { name: 'Prescriptions', path: '/prescriptions', icon: 'Rx', roles: ['admin', 'doctor'] },
    { name: 'Cashier', path: '/cashier', icon: '💰', roles: ['admin', 'cashier'] },
    { name: 'Pharmacy', path: '/pharmacy', icon: 'PH', roles: ['admin', 'pharmacist'] },
    { name: 'Drugs', path: '/drugs', icon: 'DR', roles: ['admin', 'pharmacist'] },
    { name: 'Billing', path: '/billing', icon: 'BL', roles: ['admin'] },
    { name: 'Claims', path: '/claims', icon: 'CL', roles: ['admin'] },
    { name: 'Laboratory', path: '/laboratory', icon: 'LB', roles: ['admin', 'doctor', 'lab_tech'] },
    { name: 'Appointments', path: '/appointments', icon: 'AP', roles: ['admin', 'doctor'] },
    { name: 'Telemedicine', path: '/telemedicine', icon: '📹', roles: ['admin', 'doctor'] },
    { name: 'Bed Management', path: '/bed-management', icon: '🛏️', roles: ['admin', 'nurse'] },
    { name: 'Referrals', path: '/referrals', icon: '🔄', roles: ['admin', 'doctor'] },
    { name: 'Records', path: '/records', icon: 'RC', roles: ['admin', 'records_officer'] },
    { name: 'Inventory', path: '/inventory', icon: '📦', roles: ['admin'] },
    { name: 'Blood Bank', path: '/blood-bank', icon: '🩸', roles: ['admin', 'doctor', 'nurse'] },
    { name: 'Reports', path: '/reports', icon: 'RP', roles: ['admin'] },
    { name: 'Users', path: '/users', icon: '👥', roles: ['admin'] },
  ]

  const filteredMenuItems = menuItems.filter((item) => {
    if (item.ownerOnly && !showPlatformOnboarding) {
      return false
    }

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
          <div className="mt-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">
              {branding.platformName}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {branding.hospitalName || hospitalDisplayName}
            </p>
            <p className="mt-1 text-[11px] text-blue-100">
              {branding.tagline || 'Powered by CareLink'}
            </p>
          </div>
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
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleDarkModeToggle}
              title="Toggle dark mode"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
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
                  {hospitalDisplayName} |{' '}
                  {currentTime.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  • {currentTime.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <GlobalSearch />
              <NotificationCenter />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6">
          <p>(c) {new Date().getFullYear()} {branding.platformName} | {branding.hospitalName || 'Hospital deployment'}</p>
        </footer>
      </div>
    </div>
  )
}

export default DashboardLayout
