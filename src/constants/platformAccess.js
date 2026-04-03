export const PLATFORM_OWNER_EMAILS = [
  'owner.carelink@gmail.com',
  'gabiondavidselorm@gmail.com',
]

export const canAccessPlatformOnboarding = (user, userRole) => {
  const normalizedEmail = user?.email?.toLowerCase()
  return userRole === 'admin' && Boolean(normalizedEmail) && PLATFORM_OWNER_EMAILS.includes(normalizedEmail)
}
