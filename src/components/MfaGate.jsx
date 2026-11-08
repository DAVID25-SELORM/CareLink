import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Set VITE_REQUIRE_STAFF_MFA=true to force every signed-in user to enrol an authenticator app.
// Users who already enrolled a TOTP factor are always asked for a code (step-up to aal2).
export const MFA_REQUIRED = import.meta.env.VITE_REQUIRE_STAFF_MFA === 'true'

const box = 'min-h-screen bg-slate-50 flex items-center justify-center p-6'
const card = 'w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 p-8'
const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 tracking-widest text-center text-lg'
const button = 'w-full rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50'

export function MfaEnroll({ onDone }) {
  const [factor, setFactor] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const start = useCallback(async () => {
    setError('')
    // Remove abandoned, unverified enrolments so the friendly name stays unique.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const f of existing?.all || []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' })
    if (enrollError) return setError(enrollError.message)
    setFactor(data)
  }, [])

  useEffect(() => { start() }, [start])

  const verify = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
    setBusy(false)
    if (verifyError) return setError(verifyError.message)
    onDone?.()
  }

  return <div className="space-y-3">
    <p className="text-sm text-slate-600">Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy), then enter the 6-digit code.</p>
    {factor && <img alt="Authenticator QR code" className="mx-auto h-44 w-44" src={factor.totp.qr_code} />}
    {factor && <p className="break-all text-center text-xs text-slate-500">Manual key: {factor.totp.secret}</p>}
    <form onSubmit={verify} className="space-y-3">
      <input className={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} aria-label="6-digit code" />
      <button className={button} disabled={busy || !factor || code.length !== 6}>Verify and enable</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>
}

export function MfaSettings() {
  const [factors, setFactors] = useState(null)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) return setError(listError.message)
    setFactors(data?.totp || [])
  }, [])
  useEffect(() => { load() }, [load])
  const remove = async (id) => {
    if (!window.confirm('Remove this authenticator? Your account will be protected by password only.')) return
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: id })
    if (removeError) setError(removeError.message); else load()
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-700 mb-2">Two-factor authentication</h2>
    {factors === null ? <p className="text-sm text-slate-500">Loading…</p>
      : factors.length > 0 ? <div className="space-y-2">
        <p className="text-sm text-green-700">Enabled: an authenticator app is required at sign-in.</p>
        {factors.map(f => <button key={f.id} type="button" onClick={() => remove(f.id)} className="text-sm text-red-600 underline">Remove authenticator</button>)}
      </div>
      : enrolling ? <MfaEnroll onDone={() => { setEnrolling(false); load() }} />
      : <div className="space-y-2">
        <p className="text-sm text-slate-600">Protect this account with a one-time code from an authenticator app.</p>
        <button type="button" onClick={() => setEnrolling(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Enable two-factor authentication</button>
      </div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </section>
}

function MfaChallenge({ onDone, signOut }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const verify = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp?.[0]
    if (listError || !factor) { setBusy(false); return setError(listError?.message || 'No authenticator is enrolled') }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
    setBusy(false)
    if (verifyError) return setError(verifyError.message)
    onDone()
  }

  return <div className={box}><form onSubmit={verify} className={`${card} space-y-4`}>
    <h1 className="text-xl font-semibold text-slate-800">Two-factor verification</h1>
    <p className="text-sm text-slate-600">Enter the 6-digit code from your authenticator app.</p>
    <input className={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} aria-label="6-digit code" />
    <button className={button} disabled={busy || code.length !== 6}>Verify</button>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <button type="button" onClick={signOut} className="w-full text-sm text-slate-500 underline">Sign out</button>
  </form></div>
}

/**
 * Wrap protected content. Resolves the session's assurance level and, when required, blocks the
 * content behind a TOTP challenge or enrolment. NOTE: this is a client-side gate; for server-side
 * enforcement add `(auth.jwt() ->> 'aal') = 'aal2'` conditions to RLS policies.
 */
export default function MfaGate({ children, signOut }) {
  const [state, setState] = useState('checking') // checking | ok | challenge | enroll
  const [error, setError] = useState('')

  const check = useCallback(async () => {
    try {
      const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalError) throw aalError
      if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') return setState('challenge')
      if (MFA_REQUIRED && data.nextLevel !== 'aal2') return setState('enroll')
      setState('ok')
    } catch (checkError) {
      // Fail closed when MFA is mandatory; otherwise MFA stays optional and must not lock users out.
      if (MFA_REQUIRED) { setError(checkError.message); setState('error') } else setState('ok')
    }
  }, [])

  useEffect(() => { check() }, [check])

  if (state === 'checking') return <div className={box}><div className="spinner" /></div>
  if (state === 'challenge') return <MfaChallenge onDone={check} signOut={signOut} />
  if (state === 'enroll') return <div className={box}><div className={`${card} space-y-4`}>
    <h1 className="text-xl font-semibold text-slate-800">Set up two-factor authentication</h1>
    <MfaEnroll onDone={check} />
    <button type="button" onClick={signOut} className="w-full text-sm text-slate-500 underline">Sign out</button>
  </div></div>
  if (state === 'error') return <div className={box}><div className={card}><p role="alert">Unable to verify two-factor status: {error}</p>
    <button onClick={signOut} className={`${button} mt-4`}>Sign out</button></div></div>
  return children
}
