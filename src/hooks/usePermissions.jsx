import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './useAuth'

const PermissionsContext = createContext(null)

// Permission definitions keyed by role
const ROLE_PERMISSIONS = {
  admin: ['*'],
  doctor: [
    'encounter.create', 'encounter.read', 'encounter.update',
    'diagnosis.create', 'diagnosis.read', 'diagnosis.update', 'diagnosis.delete',
    'vitals.read', 'vitals.create',
    'clinical_notes.create', 'clinical_notes.read', 'clinical_notes.update',
    'orders.create', 'orders.read', 'orders.update',
    'prescription.create', 'prescription.read',
    'lab.create', 'lab.read',
    'patient.read', 'patient.update',
    'problem_list.create', 'problem_list.read', 'problem_list.update',
    'allergy.create', 'allergy.read',
    'ward_round.create', 'ward_round.read',
    'referral.create', 'referral.read',
    'appointment.create', 'appointment.read', 'appointment.update',
  ],
  nurse: [
    'encounter.read',
    'vitals.create', 'vitals.read', 'vitals.update',
    'diagnosis.read',
    'clinical_notes.read',
    'orders.read',
    'patient.read', 'patient.update',
    'mar.create', 'mar.read', 'mar.update',
    'fluid_balance.create', 'fluid_balance.read',
    'nursing_assessment.create', 'nursing_assessment.read',
    'care_plan.create', 'care_plan.read', 'care_plan.update',
    'handover.create', 'handover.read',
    'transfer.create', 'transfer.read', 'transfer.update',
    'allergy.read',
    'problem_list.read',
    'ward_round.read',
    'bed.read', 'bed.update',
    'triage.create', 'triage.read',
  ],
  pharmacist: [
    'prescription.read', 'prescription.update',
    'patient.read',
    'drug.create', 'drug.read', 'drug.update',
    'encounter.read',
    'allergy.read',
  ],
  cashier: [
    'billing.create', 'billing.read', 'billing.update',
    'payment.create', 'payment.read',
    'patient.read',
    'encounter.read',
  ],
  lab_tech: [
    'lab.read', 'lab.update',
    'patient.read',
    'encounter.read',
    'orders.read',
  ],
  records_officer: [
    'patient.create', 'patient.read', 'patient.update',
    'encounter.read',
    'appointment.create', 'appointment.read', 'appointment.update',
  ],
  staff: [
    'patient.read',
    'encounter.read',
  ],
}

export const PermissionsProvider = ({ children }) => {
  const { userRole } = useAuth()
  const [permissions, setPermissions] = useState([])

  useEffect(() => {
    if (userRole) {
      setPermissions(ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.staff)
    }
  }, [userRole])

  const hasPermission = useCallback((permission) => {
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  }, [permissions])

  const hasAnyPermission = useCallback((perms) => {
    if (permissions.includes('*')) return true
    return perms.some(p => permissions.includes(p))
  }, [permissions])

  return (
    <PermissionsContext.Provider value={{ permissions, hasPermission, hasAnyPermission }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export const usePermissions = () => {
  const context = useContext(PermissionsContext)
  if (!context) {
    // Fallback when used outside provider — derive from useAuth directly
    const { userRole } = useAuth()
    const perms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.staff
    return {
      permissions: perms,
      hasPermission: (p) => perms.includes('*') || perms.includes(p),
      hasAnyPermission: (ps) => perms.includes('*') || ps.some(p => perms.includes(p)),
    }
  }
  return context
}

export default usePermissions
