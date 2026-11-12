import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { supabase, sharedHospitalMode, createHospitalDatabase, setHospitalDatabase } from '../supabaseClient'
import { createHospitalSession } from '../services/hospitalSession.mjs'
import HospitalQueueReview from '../components/HospitalQueueReview'
import HospitalInvitations from '../components/HospitalInvitations'
import { clearHospitalBrandingCache } from './useHospitalBranding'
import { setSentryUser } from '../services/sentry'
import { withTimeout } from '../services/queryTimeout'
import { startAutoSync, stopAutoSync, setHospitalSync } from '../services/syncEngine'
import { openHospitalCache, purgeCachedClinicalData } from '../services/offlineDB'
import { createHospitalSync } from '../services/hospitalSync.mjs'
import { logAuditEvent } from '../services/auditLog'
import { isPlatformRole } from '../platform/domain'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')
  const generation = useRef(0)
  const [hospitals, setHospitals] = useState([])
  const [hospital, setHospital] = useState(null)
  const [selectingHospital, setSelectingHospital] = useState(false)
  const [activeCache, setActiveCache] = useState(null)
  const [hospitalSession] = useState(() => createHospitalSession({
    createDatabase: createHospitalDatabase,
    clearCache: () => { stopAutoSync(); setHospitalSync(null); setActiveCache(null); setHospitalDatabase(null); clearHospitalBrandingCache() },
  }))

  const changeHospital = () => {
    hospitalSession.reset()
    setHospital(null)
    setUserRole(null)
    setAccessError('')
  }
  const selectHospital = async (id) => {
    setSelectingHospital(true)
    setAccessError('')
    try {
      const selected = await hospitalSession.select(id, user.id)
      setHospitalDatabase(selected.database)
      // Shared mode resolves the role only after a hospital is chosen, so the sign-in is audited here.
      void logAuditEvent({ user, action: 'sign_in', tableName: 'auth', recordId: user.id, newValues: { hospital_id: id } })
      const cache = openHospitalCache(id, user.id)
      setActiveCache(cache)
      setHospitalSync(createHospitalSync({ database: selected.database, cache, hospitalId: id, userId: user.id }))
      setHospital(selected)
      setUserRole(selected.role)
    } catch (error) { setAccessError(error.message) }
    finally { setSelectingHospital(false) }
  }

  useEffect(() => {
    if (!sharedHospitalMode && userRole && !isPlatformRole(userRole)) startAutoSync()
    return () => stopAutoSync()
  }, [userRole])

  useEffect(() => {
    let active = true
    let eventReceived = false
    const resolveSession = async (session, event) => {
      const request = ++generation.current
      setUser(session?.user || null)
      if (sharedHospitalMode) {
        hospitalSession.reset()
        setHospital(null)
        setHospitals([])
      }
      setUserRole(null)
      setAccessError('')
      setLoading(Boolean(session))
      setSentryUser(session?.user || null)
      if (!session) return
      try {
        const { data, error } = await withTimeout(supabase.rpc('get_carelink_access'), 'Verify workspace access')
        if (error) throw error
        if (sharedHospitalMode && !isPlatformRole(data?.role)) {
          const choices = await withTimeout(supabase.rpc('hospital_choices'), 'Load hospitals')
          if (choices.error) throw choices.error
          if (active && request === generation.current) setHospitals(choices.data || [])
          return
        }
        if (!data?.role) throw new Error('Your account has not been assigned access to this workspace. Contact your administrator.')
        if (active && request === generation.current) {
          setUserRole(data.role)
          if (event === 'SIGNED_IN' && data.scope === 'tenant') {
            void logAuditEvent({ user: session.user, action: 'sign_in', tableName: 'auth', recordId: session.user.id })
          }
        }
      } catch (error) {
        if (active && request === generation.current) {
          setAccessError(error.message || 'Unable to verify workspace access. Please try signing in again.')
        }
      } finally {
        if (active && request === generation.current) setLoading(false)
      }
    }
    // Defer queries until outside Supabase's auth callback/lock.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      eventReceived = true
      ++generation.current
      if (sharedHospitalMode) {
        hospitalSession.reset()
        setHospital(null)
      }
      setUserRole(null)
      setLoading(true)
      setTimeout(() => { if (active) resolveSession(session, event) }, 0)
    })
    withTimeout(supabase.auth.getSession(), 'Load session').then(({ data, error }) => {
      if (!active || eventReceived) return
      if (error) throw error
      return resolveSession(data.session)
    }).catch((error) => {
      if (active && !eventReceived) {
        setAccessError(error.message)
        setLoading(false)
      }
    })
    return () => {
      active = false
      // Invalidate outstanding session requests, not a DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current
      listener.subscription.unsubscribe()
    }
  }, [hospitalSession])

  const signIn = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) toast.error(result.error.message || 'Login failed')
    return result
  }

  const signOut = async () => {
    if (userRole && !isPlatformRole(userRole) && (!sharedHospitalMode || hospital)) {
      await logAuditEvent({ user, action: 'sign_out', tableName: 'auth', recordId: user?.id })
    }
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Unable to sign out. Please try again.')
      return
    }
    ++generation.current
    hospitalSession.reset()
    try { await purgeCachedClinicalData() } catch (purgeError) { console.warn('Offline cache purge failed:', purgeError?.message || purgeError) }
    setHospital(null)
    setHospitals([])
    setUser(null)
    setUserRole(null)
    setAccessError('')
    toast.success('Logged out successfully')
  }

  const chooseHospital = sharedHospitalMode && user && !loading && !hospital && !isPlatformRole(userRole)
  return <AuthContext.Provider value={{ user, userRole, loading, accessError, signIn, signOut, hospital, changeHospital, hospitalCache: activeCache }}>
    {chooseHospital ? <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="bg-white rounded-xl shadow p-8 max-w-lg w-full">
        <h1 className="text-2xl font-semibold">Choose your hospital</h1>
        <HospitalInvitations />
        {accessError && <p role="alert" className="my-4 text-red-700">{accessError}</p>}
        {!hospitals.length && <p className="my-4">No active hospital membership is available. Contact your administrator.</p>}
        {hospitals.map(item => <button key={item.tenant_id} disabled={selectingHospital} onClick={() => selectHospital(item.tenant_id)} className="block w-full text-left border rounded p-3 my-3 disabled:opacity-50">{item.hospital_name}</button>)}
        <button onClick={signOut} className="mt-4 underline">Sign out</button>
      </section>
    </main> : <div key={hospital?.revision || 'workspace'}>
      {hospital && <div className="bg-blue-50 p-2 text-sm"><span>{hospitals.find(item => item.tenant_id === hospital.hospitalId)?.hospital_name}</span> <button onClick={changeHospital} className="ml-4 underline">Switch hospital</button></div>}
      {hospital && activeCache && <HospitalQueueReview cache={activeCache} />}
      {children}
    </div>}
  </AuthContext.Provider>
}
