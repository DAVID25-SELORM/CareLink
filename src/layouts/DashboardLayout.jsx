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
  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/18 text-lg font-extrabold text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.22)]">
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
          <div className="border-b border-white/10 px-6 pb-5 pt-9 lg:px-7">
            <div className="mb-4 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-full border-2 border-white/30 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white/95 hover:bg-white/10"
            >
              Close
            </button>
          </div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 p-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.2)] ring-2 ring-white/60">
                <img
                  src={carelinkLogo}
                  alt="CareLink HMS logo"
                  className="h-9 w-auto"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-100/90">
                  {branding.platformName}
                </p>
                <p className="mt-1.5 text-[1.7rem] font-extrabold tracking-tight text-white">
                  CareLink
                </p>
              </div>
            </div>
            <p className="mt-5 text-base font-semibold text-blue-100">
              {branding.hospitalName || hospitalDisplayName}
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 py-5 lg:px-4">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileNavOpen(false)}
              className={`mb-2 flex items-center gap-4 rounded-2xl px-4 py-3.5 text-base font-bold transition-all-smooth ${
                location.pathname === item.path
                  ? 'bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_24px_rgba(18,52,110,0.22)]'
                  : 'text-white/82 hover:bg-white/10 hover:text-white'
              }`}
            >
              <SidebarIcon symbol={item.icon} />
              <span className="truncate text-base font-bold tracking-tight">{item.name}</span>
            </Link>
          ))}
          </nav>

          <div className="mt-auto border-t-2 border-white/15 px-6 pb-5 pt-6 text-white lg:px-7">
            <div className="mb-5 flex items-center justify-between border-b-2 border-white/15 pb-5">
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                className="inline-flex items-center gap-2.5 text-base font-bold text-white lg:pointer-events-none"
              >
                <span className="text-3xl leading-none">»</span>
              </button>
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="mb-5 text-base">
              <div className="truncate font-bold">{user?.email}</div>
              <div className="mt-2 text-sm font-semibold capitalize text-white/80">{userRole}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDarkModeToggle}
                title="Toggle dark mode"
                className="rounded-2xl border-2 border-white/18 bg-white/12 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-white/20 active:scale-95"
              >
                {isDarkMode ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={handleLogout}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-blue-700 transition hover:bg-blue-50 active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-[#f4f8ff]">
          <header className="sticky top-0 z-20 border-b-2 border-slate-300 bg-white px-5 py-4 shadow-[0_2px_0_rgba(15,23,42,0.06)] sm:px-7 lg:px-9">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4 lg:max-w-[180px] xl:max-w-none">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-300 text-slate-800 shadow-md lg:hidden hover:bg-slate-50 active:scale-95"
              >
                <MenuIcon />
              </button>
              <div className="hidden min-w-0 lg:block">
                <h1 className="truncate text-xl font-black tracking-tight text-slate-900">
                  {currentPageLabel}
                </h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">
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
                  className="flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-3 py-2 text-left shadow-md transition hover:border-slate-400 hover:bg-slate-50 active:scale-98"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#67b2ff,#2a73cf)] text-base font-extrabold text-white shadow-md">
                    {profileInitial}
                  </span>
                  <span className="hidden sm:block">
                    <span className="block max-w-[140px] truncate text-base font-extrabold text-slate-900">
                      {profileName}
                    </span>
                    <span className="block text-sm font-semibold text-slate-500">
                      {userRole === 'doctor' ? 'Doctor' : userRole === 'admin' ? 'Administrator' : userRole || 'Staff'}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    <ChevronDownIcon />
                  </span>
                </button>
                {profileMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-64 rounded-2xl border-2 border-slate-300 bg-white p-3 shadow-[0_25px_55px_rgba(15,23,42,0.18)]">
                    <div className="rounded-xl bg-slate-100 px-4 py-3">
                      <p className="truncate text-base font-extrabold text-slate-900">{profileName}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-600">{user?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDarkModeToggle}
                      className="mt-3 flex w-full items-center justify-between rounded-xl px-4 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-100 active:scale-98"
                    >
                      <span>Theme</span>
                      <span className="font-extrabold text-slate-600">{isDarkMode ? 'Light' : 'Dark'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-2 flex w-full items-center justify-between rounded-xl px-4 py-3 text-base font-bold text-red-600 transition hover:bg-red-50 active:scale-98"
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

          <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 sm:py-7 lg:px-9 lg:py-8">
            {children}
          </main>

          <footer className="border-t-2 border-slate-300 bg-white px-5 py-4 text-sm font-semibold text-slate-600 sm:px-7 lg:px-9">
            <p>{branding.platformName} • {branding.hospitalName || hospitalDisplayName} • {branding.tagline || 'Connecting care, simplifying healthcare'}</p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
