import { describe, it, expect } from 'vitest'
import { canAccessPlatformOnboarding, getHomePath } from '../constants/platformAccess'

describe('platform ownership', () => {
  it('does not grant platform access to legacy owner emails or tenant admins', () => {
    expect(canAccessPlatformOnboarding({ email: 'owner.carelink@gmail.com' }, 'admin')).toBe(false)
    expect(canAccessPlatformOnboarding({ email: 'gabiondavidselorm@gmail.com', user_metadata: { role: 'platform_owner' } }, 'admin')).toBe(false)
  })
  it('requires an authenticated platform-owner role', () => {
    expect(canAccessPlatformOnboarding(null, 'platform_owner')).toBe(false)
    expect(canAccessPlatformOnboarding({ id: 'owner' }, 'platform_owner')).toBe(true)
    expect(getHomePath('platform_owner')).toBe('/platform')
    expect(getHomePath('admin')).toBe('/dashboard')
  })
})
