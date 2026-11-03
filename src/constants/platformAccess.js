import { isPlatformRole, can } from '../platform/domain'

// Roles are resolved by the database, never by email or editable metadata.
export const canAccessPlatformOnboarding = (user, userRole) =>
  Boolean(user) && can(userRole, 'hospitals.write')

export const getHomePath = (role) => isPlatformRole(role) ? '/platform' : '/dashboard'

