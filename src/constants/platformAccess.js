// Roles are resolved by the database, never by email or editable metadata.
export const canAccessPlatformOnboarding = (user, userRole) =>
  Boolean(user) && userRole === 'platform_owner'

export const getHomePath = (role) => role === 'platform_owner' ? '/platform' : '/dashboard'
