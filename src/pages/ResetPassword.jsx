import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'

const LINK_WAIT_MS = 4000

// Landing page for the emailed password-recovery link. Supabase turns the link into a
// temporary session (PASSWORD_RECOVERY); this page lets the user choose a new password,
// then signs them out so they log in normally (and pass any MFA step).
export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // checking | ready | invalid
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) setStatus('ready')
    })
    supabase.auth.getSession().then(({ data }) => {
      if (active && data?.session) setStatus('ready')
    }).catch(() => {})
    const timer = setTimeout(() => { if (active) setStatus(current => current === 'checking' ? 'invalid' : current) }, LINK_WAIT_MS)
    return () => { active = false; clearTimeout(timer); listener.subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    if (password !== confirm) return toast.error('Passwords do not match')
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await supabase.auth.signOut()
      toast.success('Password updated. Please sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(error.message || 'Could not update password')
    } finally {
      setSaving(false)
    }
  }

  const shell = 'min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-blue-100 p-4'
  const card = 'bg-white p-6 sm:p-10 rounded-2xl shadow-soft w-full max-w-md border border-slate-100'
  const field = 'w-full border border-slate-300 rounded-lg px-3 py-2'

  if (status === 'checking') return <div className={shell}><div className="spinner" role="status" aria-label="Checking reset link" /></div>

  if (status === 'invalid') return <div className={shell}><div className={`${card} space-y-4 text-center`}>
    <h1 className="text-xl font-semibold text-slate-800">Reset link invalid or expired</h1>
    <p className="text-sm text-slate-600">Request a new password reset link from the sign-in page.</p>
    <Link to="/login" className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white">Back to sign in</Link>
  </div></div>

  return <div className={shell}><form onSubmit={handleSubmit} className={`${card} space-y-4`}>
    <h1 className="text-xl font-semibold text-slate-800">Choose a new password</h1>
    <div>
      <label htmlFor="new-password" className="block text-sm font-medium text-slate-600 mb-1">New password</label>
      <input id="new-password" type="password" autoComplete="new-password" className={field} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
    </div>
    <div>
      <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-600 mb-1">Confirm password</label>
      <input id="confirm-password" type="password" autoComplete="new-password" className={field} value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
    </div>
    <button disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Update password'}</button>
  </form></div>
}
