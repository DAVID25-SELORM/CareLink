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

const SidebarIcon = ({ symbol }) => (
  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-base font-semibold text-slate-700">
    {symbol}
  </span>
)

const ChevronDownIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const MenuIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const DashboardLayout = ({ children }) => {
  const { user, userRole, signOut } = useAuth()
  const { branding, hospitalDisplayName } = useHospitalBranding()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
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
    setProfileMenuOpen(false)
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
    { name: 'Dashboard', path: '/dashboard', icon: '⌂', roles: ['admin', 'doctor', 'pharmacist', 'cashier', 'nurse', 'records_officer'] },
    { name: 'Hospitals', path: '/hospital-onboarding', icon: '◫', roles: ['admin'], ownerOnly: true },
    { name: 'Hospital Profile', path: '/hospital-profile', icon: '✚', roles: ['admin'] },
    { name: 'Patients', path: '/patients', icon: '◉', roles: ['admin', 'doctor', 'pharmacist', 'nurse', 'records_officer'] },
    { name: 'Queue Management', path: '/queue-management', icon: '⌁', roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'cashier', 'records_officer'] },
    { name: 'Triage', path: '/triage', icon: '⚑', roles: ['admin', 'doctor', 'nurse'] },
    { name: 'Prescriptions', path: '/prescriptions', icon: 'Rx', roles: ['admin', 'doctor'] },
    { name: 'Cashier', path: '/cashier', icon: '◌', roles: ['admin', 'cashier'] },
    { name: 'Pharmacy', path: '/pharmacy', icon: '✜', roles: ['admin', 'pharmacist'] },
    { name: 'Drugs', path: '/drugs', icon: '◈', roles: ['admin', 'pharmacist'] },
    { name: 'Billing', path: '/billing', icon: '▣', roles: ['admin'] },
    { name: 'Claims', path: '/claims', icon: '◨', roles: ['admin'] },
    { name: 'Laboratory', path: '/laboratory', icon: '◧', roles: ['admin', 'doctor', 'lab_tech'] },
    { name: 'Appointments', path: '/appointments', icon: '◫', roles: ['admin', 'doctor'] },
    { name: 'Telemedicine', path: '/telemedicine', icon: '◍', roles: ['admin', 'doctor'] },
    { name: 'Bed Management', path: '/bed-management', icon: '▤', roles: ['admin', 'nurse'] },
    { name: 'Referrals', path: '/referrals', icon: '⇄', roles: ['admin', 'doctor'] },
    { name: 'Records', path: '/records', icon: '▥', roles: ['admin', 'records_officer'] },
    { name: 'Inventory', path: '/inventory', icon: '▦', roles: ['admin'] },
    { name: 'Blood Bank', path: '/blood-bank', icon: '◍', roles: ['admin', 'doctor', 'nurse'] },
    { name: 'Services & Fees', path: '/services-catalog', icon: '¤', roles: ['admin', 'cashier', 'doctor', 'nurse', 'pharmacist', 'records_officer'] },
    { name: 'Reports', path: '/reports', icon: '▮', roles: ['admin'] },
    { name: 'Users', path: '/users', icon: '◎', roles: ['admin'] },
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

  const currentPageLabel = menuItems.find((item) => item.path === location.pathname)?.name || 'Dashboard'
  const profileName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Dr. Smith'
  const profileInitial = profileName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[#fafafa] px-0 py-0 text-slate-900">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      ) : null}

      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] overflow-hidden bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
        <div
          className={`fixed inset-y-0 left-0 z-40 flex w-[260px] max-w-[86vw] flex-col bg-white shadow-[2px_0_8px_rgba(0,0,0,0.04)] transition-transform duration-300 lg:static lg:z-auto lg:w-[260px] lg:max-w-none lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        >
          <div className="border-b border-slate-200 px-6 pb-6 pt-8 lg:px-7">
            <div className="mb-4 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 p-2 shadow-sm">
                <img
                  src={carelinkLogo}
                  alt="CareLink HMS logo"
                  className="h-8 w-auto"
                />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
                  CareLink
                </p>
                <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
                  HMS
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">
              {branding.hospitalName || hospitalDisplayName}
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6 lg:px-4">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileNavOpen(false)}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all ${
                location.pathname === item.path
                  ? 'bg-slate-100 text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <SidebarIcon symbol={item.icon} />
              <span className="truncate">{item.name}</span>
            </Link>
          ))}
          </nav>

          <div className="mt-auto border-t border-slate-200 px-6 pb-6 pt-5 lg:px-7">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 lg:pointer-events-none"
              >
                <span className="text-xl leading-none">»</span>
              </button>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="mb-4 text-sm">
              <div className="truncate font-medium text-slate-900">{user?.email}</div>
              <div className="mt-1 text-xs font-medium capitalize text-slate-500">{userRole}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDarkModeToggle}
                title="Toggle dark mode"
                className="rounded-lg bg-slate-100 px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              >
                {isDarkMode ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-slate-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-[#fafafa]">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8 lg:px-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4 lg:max-w-[180px] xl:max-w-none">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 lg:hidden hover:bg-slate-200"
              >
                <MenuIcon />
              </button>
              <div className="hidden min-w-0 lg:block">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                  {currentPageLabel}
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {currentTime.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {' '}• {currentTime.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
              <div className="min-w-0 flex-1 md:max-w-[360px] lg:max-w-[420px]">
                <GlobalSearch />
              </div>
              <NotificationCenter />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white">
                    {profileInitial}
                  </span>
                  <span className="hidden sm:block">
                    <span className="block max-w-[140px] truncate text-sm font-medium text-slate-900">
                      {profileName}
                    </span>
                    <span className="block text-xs font-medium text-slate-500">
                      {userRole === 'doctor' ? 'Doctor' : userRole === 'admin' ? 'Administrator' : userRole || 'Staff'}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    <ChevronDownIcon />
                  </span>
                </button>
                {profileMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                    <div className="rounded-md bg-slate-50 px-3 py-2.5">
                      <p className="truncate text-sm font-medium text-slate-900">{profileName}</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-600">{user?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDarkModeToggle}
                      className="mt-2 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      <span>Theme</span>
                      <span className="text-xs font-medium text-slate-500">{isDarkMode ? 'Light' : 'Dark'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <span>Sign Out</span>
                      <span>↗</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

          <main className="flex-1 overflow-y-auto px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            {children}
          </main>

          <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs font-medium text-slate-500 sm:px-8 lg:px-10">
            <p>{branding.platformName} • {branding.hospitalName || hospitalDisplayName} • {branding.tagline || 'Connecting care, simplifying healthcare'}</p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
