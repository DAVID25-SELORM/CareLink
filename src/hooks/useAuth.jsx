import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import { logAuditEvent } from '../services/auditLog'

/**
 * Authentication Hook
 * Manages user authentication state and operations
 *
 * Supported Roles:
 * - Admin: Full system access
 * - Doctor: Patient & prescription management
 * - Pharmacist: Pharmacy & dispensing
 */

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user)
        await fetchUserRole(session.user)
      } else {
        setUser(null)
        setUserRole(null)
      }
      setLoading(false)
    })

    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const checkUser = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        setUser(session.user)
        await fetchUserRole(session.user)
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserRole = async (authUser) => {
    if (!authUser) {
      setUserRole(null)
      return
    }

    try {
      let roleRecord = null

      if (authUser.id) {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle()

        if (error) throw error
        roleRecord = data
      }

      // The setup docs create users by email, so support that path too.
      if (!roleRecord && authUser.email) {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('email', authUser.email)
          .maybeSingle()

        if (error) throw error
        roleRecord = data
      }

      setUserRole(roleRecord?.role || 'staff')
    } catch (error) {
      console.error('Error fetching user role:', error)
      setUserRole('staff')
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      await fetchUserRole(data.user)
      await logAuditEvent({
        user: data.user,
        action: 'sign_in',
        tableName: 'auth',
        recordId: data.user.id,
        newValues: { email: data.user.email },
      })
      toast.success('Login successful!')
      return { data, error: null }
    } catch (error) {
      toast.error(error.message || 'Login failed')
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const currentUser = user
      await logAuditEvent({
        user: currentUser,
        action: 'sign_out',
        tableName: 'auth',
        recordId: currentUser?.id || null,
        oldValues: { email: currentUser?.email || null },
      })

      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setUser(null)
      setUserRole(null)
      toast.success('Logged out successfully')
    } catch (error) {
      toast.error('Error logging out')
      console.error('Error signing out:', error)
    }
  }

  const value = {
    user,
    userRole,
    loading,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
