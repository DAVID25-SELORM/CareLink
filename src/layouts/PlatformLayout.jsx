import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { can } from '../platform/domain'
import { command, query } from '../platform/api'
import { supabase } from '../supabaseClient'
import { Modal, titleCase } from '../platform/ui'
import '../platform/platform.css'

const navigation = [
  ['Workspace', 'Overview', '', 'overview.read', 'grid'],
  ['', 'Hospitals', 'hospitals', 'hospitals.read', 'hospital'],
  ['', 'Onboarding', 'onboarding', 'hospitals.read', 'check'],
  ['Commercial', 'Subscriptions', 'subscriptions', 'billing.read', 'layers'],
  ['', 'Plans & pricing', 'plans', 'billing.read', 'tag'],
  ['', 'Invoices & payments', 'billing', 'billing.read', 'receipt'],
  ['Operations', 'Support tickets', 'support', 'support.read', 'support'],
  ['', 'System monitoring', 'monitoring', 'operations.read', 'pulse'],
  ['', 'Integrations', 'integrations', 'operations.read', 'link'],
  ['', 'Backups & recovery', 'backups', 'operations.read', 'database'],
  ['Administration', 'Platform team', 'team', 'team.read', 'users'],
  ['', 'Notifications', 'notifications', 'notifications.read', 'bell'],
  ['', 'Audit log', 'audit', 'audit.read', 'history'],
  ['', 'Analytics', 'analytics', 'billing.read', 'chart'],
  ['', 'Settings', 'settings', 'settings.read', 'settings'],
]
const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  hospital: 'M4 21V5h16v16 M8 5V2h8v3 M9 21v-5h6v5 M9 9h6 M12 6v6',
  check: 'M8 3H4v18h16V3h-4 M8 2h8v4H8z M8 13l3 3 6-7',
  layers: 'M2 7l10-5 10 5-10 5z M2 12l10 5 10-5 M2 17l10 5 10-5',
  tag: 'M3 3h8l10 10-8 8L3 11z M7 7h.01',
  receipt: 'M5 2h14v20l-3-2-4 2-4-2-3 2z M8 7h8 M8 11h8 M8 15h5',
  support: 'M3 13v-2a9 9 0 0118 0v2 M3 12h4v7H3z M17 12h4v7h-4z M19 19v3h-7',
  pulse: 'M2 12h4l3-8 5 16 3-8h5',
  link: 'M10 14l4-4 M9 15l-2 2a4 4 0 01-5-5l5-5a4 4 0 015 0 M15 9l2-2a4 4 0 015 5l-5 5a4 4 0 01-5 0',
  database: 'M3 5c0-4 18-4 18 0s-18 4-18 0v14c0 4 18 4 18 0V5 M3 12c0 4 18 4 18 0',
  users: 'M8 12a4 4 0 100-8 4 4 0 000 8 M1 22v-3a7 7 0 0114 0v3 M16 4a4 4 0 010 8 M18 15a6 6 0 014 7',
  bell: 'M4 17h16l-2-3V9A6 6 0 006 9v5z M10 21h4',
  history: 'M3 10a9 9 0 119 11 M3 3v7h7 M12 7v6l4 2',
  chart: 'M3 3v18h18 M7 16V9 M12 16V5 M17 16v-5',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  search: 'M10 3a7 7 0 100 14 7 7 0 000-14 M15 15l6 6',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
}
export function Icon({ name }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid} /></svg> }

function Search({ onClose }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    if (text.trim().length < 2) { setResults([]); setBusy(false); return }
    setBusy(true)
    const timer = setTimeout(async () => {
      try { const data = await command('platform_search', { p_query: text.trim() }); if (active) { setResults(data); setError('') } }
      catch (err) { if (active) setError(err.message) }
      finally { if (active) setBusy(false) }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [text])
  return <Modal title="Search platform" onClose={onClose}><label className="pc-muted">Find hospitals, tickets and invoices<input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Enter at least two characters" /></label>
    <div className="pc-search-results" aria-live="polite">{busy ? <p className="pc-panel-body">Searching…</p> : error ? <p role="alert" className="pc-error">{error}</p> : results.map(r => <Link key={`${r.kind}-${r.id}`} to={r.path} onClick={onClose}><small className="pc-muted">{titleCase(r.kind)}</small><p>{r.label}</p></Link>)}{!busy && text.length >= 2 && !results.length && !error && <p className="pc-panel-body">No matching records.</p>}</div>
  </Modal>
}

export default function PlatformLayout({ children }) {
  const { user, userRole, signOut } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [search, setSearch] = useState(false)
  const [profile, setProfile] = useState(false)
  const [unread, setUnread] = useState(null)
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('carelink-platform-theme') || 'light' } catch { return 'light' } })
  const profileRef = useRef(null)
  useEffect(() => { setMobile(false); setProfile(false) }, [location.pathname])
  useEffect(() => {
    const key = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearch(true) } if (e.key === 'Escape') { setProfile(false); setMobile(false) } }
    const click = e => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfile(false) }
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', click)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', click) }
  }, [])
  useEffect(() => {
    let active = true
    const refresh = () => query(supabase.from('platform_notifications').select('id').eq('recipient_id', user.id).is('read_at', null)).then(data => { if (active) setUnread(data.length) }).catch(() => { if (active) setUnread(null) })
    refresh(); const timer = setInterval(refresh, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [user.id, location.pathname])
  const section = navigation.find(n => n[2] && location.pathname.startsWith(`/platform/${n[2]}`))?.[1] || 'Overview'
  const toggleTheme = () => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); try { localStorage.setItem('carelink-platform-theme', next) } catch { /* storage optional */ } }
  return <div className={`pc ${collapsed ? 'pc-collapsed' : ''} ${mobile ? 'pc-mobile-open' : ''}`} data-theme={theme}>
    <a className="pc-skip" href="#platform-main">Skip to content</a>
    {mobile && <button className="pc-backdrop" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <aside className="pc-sidebar" aria-label="Platform sidebar">
      <Link to="/platform" className="pc-brand"><span className="pc-brand-mark">+</span><span className="pc-brand-text">CareLink<span style={{ display:'block',fontSize:9,fontWeight:500,letterSpacing:2 }}>PLATFORM CONSOLE</span></span></Link>
      <nav aria-label="Platform navigation">{navigation.filter(n => can(userRole, n[3])).map(([group,label,path,,icon]) => <div key={label}>{group && <p className="pc-nav-group">{group.toUpperCase()}</p>}<NavLink title={label} className="pc-nav-link" to={`/platform${path ? `/${path}` : ''}`} end={!path}><Icon name={icon} /><span className="pc-nav-text">{label}</span></NavLink></div>)}</nav>
      <div className="pc-sidebar-foot"><strong>Independent hospitals.</strong><p>Connected administration.</p></div>
    </aside>
    <div className="pc-content"><header className="pc-topbar"><div className="pc-topbar-left">
      <button className="pc-icon-button pc-desktop-toggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><Icon name="menu" /></button>
      <button className="pc-icon-button pc-mobile-toggle" aria-label="Toggle navigation" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><Icon name="menu" /></button>
      <nav aria-label="Breadcrumb" className="pc-breadcrumb"><Link to="/platform">Platform</Link><span> / </span><span aria-current="page">{section}</span></nav>
    </div><div className="pc-topbar-right">
      <button className="pc-search" onClick={() => setSearch(true)}><Icon name="search" /><span>Search platform</span><small>Ctrl K</small></button>
      <button className="pc-icon-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={toggleTheme}>{theme === 'light' ? '◐' : '☀'}</button>
      <Link className="pc-btn pc-icon-button" to="/platform/notifications" aria-label={`Notifications${unread === null ? '' : `, ${unread} unread`}`}><Icon name="bell" />{unread > 0 && <small>{unread}</small>}</Link>
      <div ref={profileRef}><button aria-expanded={profile} aria-label="Account menu" onClick={() => setProfile(!profile)}><span className="pc-avatar">{user?.email?.slice(0,2).toUpperCase()}</span><span className="pc-profile-label">{titleCase(userRole)}</span><span aria-hidden="true">⌄</span></button>{profile && <div className="pc-popover"><p><strong>{titleCase(userRole)}</strong></p><p className="pc-muted">{user?.email}</p><button onClick={signOut}>Sign out</button></div>}</div>
    </div></header>
    <main id="platform-main" className="pc-main" tabIndex={-1}>{children}</main></div>
    {search && <Search onClose={() => setSearch(false)} />}
  </div>
}
