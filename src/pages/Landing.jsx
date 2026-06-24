import { Link } from 'react-router-dom'
import carelinkLogo from '../assets/carelink-logo.svg'

const MODULES = [
  { icon: '◉', name: 'Patient Management', desc: 'Register, search & manage patient records' },
  { icon: '⌁', name: 'Queue & Triage', desc: 'Real-time queue management and emergency triage' },
  { icon: 'Rx', name: 'Prescriptions', desc: 'e-Prescriptions with drug interaction alerts' },
  { icon: '✜', name: 'Pharmacy', desc: 'Dispensing, stock management & expiry tracking' },
  { icon: '◧', name: 'Laboratory', desc: 'Sample tracking, results & auto-flagging' },
  { icon: '▣', name: 'Billing & Claims', desc: 'NHIA claims, invoicing & cashier workflows' },
  { icon: '◍', name: 'Telemedicine', desc: 'Integrated video consultations' },
  { icon: '▤', name: 'Bed Management', desc: 'Ward occupancy & bed allocation' },
  { icon: '⇄', name: 'Referrals', desc: 'Inter-facility referral tracking' },
  { icon: '▮', name: 'Reports & DHIMS2', desc: 'Analytics, dashboards & GHS reporting' },
  { icon: '◈', name: 'Drug Management', desc: 'Formulary, stock levels & reorder points' },
  { icon: '◍', name: 'Blood Bank', desc: 'Donation, cross-match & inventory' },
]

const FEATURES = [
  'Offline-first PWA — works without internet',
  'AI-assisted diagnosis suggestions',
  'Multi-tenant for hospital groups',
  'Role-based access for 8+ staff roles',
  'NHIA tariff & ICD-10 code libraries',
  'Real-time notifications & dark mode',
]

const ROADMAP = [
  { quarter: 'Q1 2026', items: ['HL7 FHIR interoperability', 'Mobile companion app'] },
  { quarter: 'Q2 2026', items: ['AI radiology assist', 'SMS patient reminders'] },
  { quarter: 'Q3 2026', items: ['National Health Data Exchange', 'Telehealth expansion'] },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={carelinkLogo} alt="CareLink" className="h-8 w-auto" />
            <span className="text-lg font-bold tracking-tight">CareLink HMS</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#modules" className="text-sm text-slate-600 hover:text-blue-600 transition">Modules</a>
            <a href="#features" className="text-sm text-slate-600 hover:text-blue-600 transition">Features</a>
            <a href="#roadmap" className="text-sm text-slate-600 hover:text-blue-600 transition">Roadmap</a>
          </nav>
          <Link
            to="/login"
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 transition"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          Connecting Care,{' '}
          <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            Simplifying Healthcare
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500">
          A modern, offline-first Hospital Management System built for Ghanaian health facilities.
          From patient registration to NHIA claims — everything in one place.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 transition"
          >
            Get Started
          </Link>
          <a
            href="#modules"
            className="rounded-lg border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            Explore Modules
          </a>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-10 sm:grid-cols-4">
          {[
            ['12+', 'Clinical Modules'],
            ['8+', 'Staff Roles'],
            ['75+', 'ICD-10 Codes'],
            ['35+', 'NHIA Tariffs'],
          ].map(([stat, label]) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-blue-600">{stat}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules Grid */}
      <section id="modules" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">All-in-One HMS Modules</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-500">
          Every module your facility needs, integrated and ready out of the box.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div
              key={m.name}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-xl text-blue-600">
                {m.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold">{m.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold">Why CareLink?</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-3 rounded-lg bg-white p-4 shadow-sm">
                <span className="mt-0.5 text-green-500">✓</span>
                <span className="text-sm text-slate-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Roadmap</h2>
        <div className="mt-10 space-y-8">
          {ROADMAP.map((r) => (
            <div key={r.quarter} className="flex gap-6">
              <div className="w-24 shrink-0 text-right">
                <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {r.quarter}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-slate-600">
                {r.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} CareLink HMS — Built for Ghana&apos;s Healthcare Future</p>
        <p className="mt-1">By David Gabion Selorm &middot; gabiondavidselorm@gmail.com</p>
      </footer>
    </div>
  )
}
