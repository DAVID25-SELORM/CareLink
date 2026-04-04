import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { withTimeout } from '../services/queryTimeout'

export const DEFAULT_HOSPITAL_BRANDING = {
  platformName: 'CareLink HMS',
  hospitalName: '',
  branchName: '',
  dashboardLabel: '',
  tagline: 'Powered by CareLink',
  contactEmail: '',
  contactPhone: '',
  primaryColor: '',
  secondaryColor: '',
}

let brandingCache = null
const BRANDING_UPDATE_EVENT = 'carelink-branding-updated'

export const mapHospitalBranding = (profile) => {
  if (!profile) {
    return DEFAULT_HOSPITAL_BRANDING
  }

  return {
    platformName: profile.platform_name || DEFAULT_HOSPITAL_BRANDING.platformName,
    hospitalName: profile.hospital_name || '',
    branchName: profile.branch_name || '',
    dashboardLabel: profile.dashboard_label || profile.hospital_name || '',
    tagline: profile.tagline || DEFAULT_HOSPITAL_BRANDING.tagline,
    contactEmail: profile.contact_email || '',
    contactPhone: profile.contact_phone || '',
    primaryColor: profile.primary_color || '',
    secondaryColor: profile.secondary_color || '',
  }
}

export const updateHospitalBrandingCache = (profile) => {
  const nextBranding = mapHospitalBranding(profile)
  brandingCache = nextBranding

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(BRANDING_UPDATE_EVENT, {
        detail: nextBranding,
      }),
    )
  }

  return nextBranding
}

export const clearHospitalBrandingCache = () => {
  brandingCache = null
}

export const useHospitalBranding = () => {
  const [branding, setBranding] = useState(brandingCache || DEFAULT_HOSPITAL_BRANDING)
  const [loading, setLoading] = useState(!brandingCache)

  useEffect(() => {
    let active = true

    const handleBrandingUpdate = (event) => {
      if (active) {
        setBranding(event.detail || DEFAULT_HOSPITAL_BRANDING)
        setLoading(false)
      }
    }

    const loadBranding = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.from('hospital_profile').select('*').eq('singleton_key', true).maybeSingle(),
          'Hospital branding profile',
        )

        if (error) throw error

        const nextBranding = updateHospitalBrandingCache(data)

        if (active) {
          setBranding(nextBranding)
        }
      } catch (error) {
        if (active) {
          setBranding(DEFAULT_HOSPITAL_BRANDING)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(BRANDING_UPDATE_EVENT, handleBrandingUpdate)
    }

    if (brandingCache) {
      setLoading(false)
      return () => {
        active = false
        if (typeof window !== 'undefined') {
          window.removeEventListener(BRANDING_UPDATE_EVENT, handleBrandingUpdate)
        }
      }
    }

    loadBranding()

    return () => {
      active = false
      if (typeof window !== 'undefined') {
        window.removeEventListener(BRANDING_UPDATE_EVENT, handleBrandingUpdate)
      }
    }
  }, [])

  return {
    branding,
    loading,
    hospitalDisplayName: branding.dashboardLabel || branding.hospitalName || 'Hospital Dashboard',
  }
}
