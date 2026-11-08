import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, sharedHospitalMode } from '../supabaseClient'
import { useAuth } from './useAuth'
import { isPlatformRole } from '../platform/domain'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user, userRole, hospital } = useAuth()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadOrganization = useCallback(async () => {
    if (sharedHospitalMode) return
    if (!user || !userRole || isPlatformRole(userRole)) {
      setOrg(null)
      setLoading(false)
      return
    }
    try {
      // Get user's org from the users table (org_id / hospital_id)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('hospital_id')
        .eq('id', user.id)
        .single()

      if (userError || !userData?.hospital_id) {
        setOrg(null)
        setLoading(false)
        return
      }

      // Fetch the organization/hospital details
      const { data: hospital, error: hospError } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', userData.hospital_id)
        .single()

      if (!hospError && hospital) {
        setOrg({
          id: hospital.id,
          name: hospital.name,
          code: hospital.facility_code,
          type: hospital.facility_type,
          region: hospital.region,
          district: hospital.district,
          nhia_facility_id: hospital.nhia_facility_id,
          logo_url: hospital.logo_url,
          settings: hospital.settings || {},
        })
      }
    } catch (err) {
      console.error('Failed to load organization:', err)
    } finally {
      setLoading(false)
    }
  }, [user, userRole])

  useEffect(() => {
    if (sharedHospitalMode) return
    const timer = setTimeout(() => { void loadOrganization() }, 0)
    return () => clearTimeout(timer)
  }, [loadOrganization])

  return (
    <OrgContext.Provider value={{
      org: sharedHospitalMode ? (hospital ? { id: hospital.hospitalId, name: hospital.name, settings: {} } : null) : org,
      loading: sharedHospitalMode ? false : loading, reload: loadOrganization,
    }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (!context) {
    // Graceful fallback outside provider
    return { org: null, loading: false, reload: () => {} }
  }
  return context
}
