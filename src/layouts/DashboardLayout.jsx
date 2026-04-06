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
  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3d7cd3_0%,#2d67b9_36%,#2a5da8_100%)] px-3 py-3 text-slate-900 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      ) : null}

      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1440px] overflow-hidden rounded-[28px] border border-white/10 bg-white/10 shadow-[0_30px_60px_rgba(10,37,89,0.28)] backdrop-blur-[2px] lg:min-h-[calc(100vh-3rem)]">
        <div
          className={`fixed inset-y-0 left-0 z-40 flex w-[250px] max-w-[86vw] flex-col bg-[linear-gradient(180deg,#2f74c7_0%,#2c69bb_52%,#2559a8_100%)] shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:w-[220px] lg:max-w-none lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        >
          <div className="border-b border-white/10 px-5 pb-4 pt-8 lg:px-6">
            <div className="mb-3 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-full border border-white/25 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/90"
            >
              Close
            </button>
          </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ring-1 ring-white/50">
                <img
                  src={carelinkLogo}
                  alt="CareLink HMS logo"
                  className="h-8 w-auto"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/80">
                  {branding.platformName}
                </p>
                <p className="mt-1 text-[1.55rem] font-bold tracking-tight text-white">
                  CareLink
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-blue-100/90">
              {branding.hospitalName || hospitalDisplayName}
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4 lg:px-3">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileNavOpen(false)}
              className={`mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all-smooth ${
                location.pathname === item.path
                  ? 'bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_24px_rgba(18,52,110,0.22)]'
                  : 'text-white/82 hover:bg-white/10 hover:text-white'
              }`}
            >
              <SidebarIcon symbol={item.icon} />
              <span className="truncate text-[15px] font-semibold tracking-tight">{item.name}</span>
            </Link>
          ))}
          </nav>

          <div className="mt-auto border-t border-white/10 px-5 pb-4 pt-5 text-white/88 lg:px-6">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/92 lg:pointer-events-none"
              >
                <span className="text-2xl leading-none">»</span>
              </button>
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="mb-4 text-sm">
              <div className="truncate font-medium">{user?.email}</div>
              <div className="mt-1 text-xs capitalize text-white/70">{userRole}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDarkModeToggle}
                title="Toggle dark mode"
                className="rounded-2xl border border-white/14 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/16"
              >
                {isDarkMode ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={handleLogout}
                className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-[#f4f8ff]">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 lg:max-w-[180px] xl:max-w-none">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 shadow-sm lg:hidden"
              >
                <MenuIcon />
              </button>
              <div className="hidden min-w-0 lg:block">
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-800">
                  {currentPageLabel}
                </h1>
                <p className="mt-0.5 text-xs text-slate-400">
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
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              <div className="min-w-0 flex-1 md:max-w-[360px] lg:max-w-[420px]">
                <GlobalSearch />
              </div>
              <NotificationCenter />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#67b2ff,#2a73cf)] text-sm font-bold text-white">
                    {profileInitial}
                  </span>
                  <span className="hidden sm:block">
                    <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-700">
                      {profileName}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {userRole === 'doctor' ? 'Doctor' : userRole === 'admin' ? 'Administrator' : userRole || 'Staff'}
                    </span>
                  </span>
                  <span className="text-slate-400">
                    <ChevronDownIcon />
                  </span>
                </button>
                {profileMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_45px_rgba(15,23,42,0.14)]">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-slate-700">{profileName}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{user?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDarkModeToggle}
                      className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      <span>Theme</span>
                      <span className="font-semibold text-slate-500">{isDarkMode ? 'Light' : 'Dark'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
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

          <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-6">
            {children}
          </main>

          <footer className="border-t border-slate-200/80 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6 lg:px-8">
            <p>{branding.platformName} • {branding.hospitalName || hospitalDisplayName} • {branding.tagline || 'Connecting care, simplifying healthcare'}</p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
