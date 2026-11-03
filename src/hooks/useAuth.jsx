import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import { setSentryUser } from '../services/sentry'
import { withTimeout } from '../services/queryTimeout'
import { startAutoSync, stopAutoSync } from '../services/syncEngine'
import { logAuditEvent } from '../services/auditLog'

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

  useEffect(() => {
    if (userRole && userRole !== 'platform_owner') startAutoSync()
    return () => stopAutoSync()
  }, [userRole])

  useEffect(() => {
    let active = true
    let eventReceived = false
    const resolveSession = async (session, event) => {
      const request = ++generation.current
      setUser(session?.user || null)
      setUserRole(null)
      setAccessError('')
      setLoading(Boolean(session))
      setSentryUser(session?.user || null)
      if (!session) return
      try {
        const { data, error } = await withTimeout(supabase.rpc('get_carelink_access'), 'Verify workspace access')
        if (error) throw error
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
      ++generation.current
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) toast.error(result.error.message || 'Login failed')
    return result
  }

  const signOut = async () => {
    if (userRole && userRole !== 'platform_owner') {
      await logAuditEvent({ user, action: 'sign_out', tableName: 'auth', recordId: user?.id })
    }
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Unable to sign out. Please try again.')
      return
    }
    ++generation.current
    setUser(null)
    setUserRole(null)
    setAccessError('')
    toast.success('Logged out successfully')
  }

  return <AuthContext.Provider value={{ user, userRole, loading, accessError, signIn, signOut }}>{children}</AuthContext.Provider>
}
