import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import carelinkLogo from '../assets/carelink-logo.svg'

export default function PlatformLayout({ children }) {
  const { user, signOut } = useAuth()
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link to="/platform" className="flex items-center gap-4">
          <img src={carelinkLogo} alt="CareLink" className="h-12" />
          <span className="font-semibold">Platform administration</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Platform owner</span>
          <span className="hidden sm:inline">{user?.email}</span>
          <button onClick={signOut} className="rounded-lg border px-4 py-2">Sign out</button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-screen-2xl p-4 sm:p-6">{children}</main>
    <footer className="p-6 text-center text-sm text-slate-500">CareLink platform management · Each hospital manages its own staff and patient records</footer>
  </div>
}
