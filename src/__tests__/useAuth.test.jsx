import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'

const mocks = vi.hoisted(() => ({ authChanged: null }))
vi.mock('../supabaseClient', () => ({ supabase: {
  rpc: vi.fn(),
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((callback) => {
      mocks.authChanged = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  },
} }))
vi.mock('../services/sentry', () => ({ setSentryUser: vi.fn() }))
vi.mock('../services/auditLog', () => ({ logAuditEvent: vi.fn() }))
vi.mock('../services/syncEngine', () => ({ startAutoSync: vi.fn(), stopAutoSync: vi.fn() }))
vi.mock('../services/queryTimeout', () => ({ withTimeout: (promise) => promise }))

function AccessProbe() {
  const { userRole, loading, accessError } = useAuth()
  return <p>{loading ? 'Verifying' : accessError || userRole || 'No role'}</p>
}
const renderAuth = () => render(<AuthProvider><AccessProbe /></AuthProvider>)
const session = { user: { id: 'tenant-user', email: 'owner.carelink@gmail.com', user_metadata: { role: 'platform_owner' } } }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  supabase.auth.getSession.mockResolvedValue({ data: { session } })
})

describe('verified workspace authorization', () => {
  it('uses the database role rather than email, metadata or local storage', async () => {
    localStorage.setItem('carelink-role:tenant-user', 'platform_owner')
    supabase.rpc.mockResolvedValue({ data: { role: 'doctor', scope: 'tenant' }, error: null })
    renderAuth()
    expect(await screen.findByText('doctor')).toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith('get_carelink_access')
  })

  it('does not grant any fallback role on database failure', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Database unavailable' } })
    renderAuth()
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument()
    expect(screen.queryByText('platform_owner')).not.toBeInTheDocument()
  })

  it('accepts an explicitly assigned owner without a public users row', async () => {
    supabase.rpc.mockResolvedValue({ data: { role: 'platform_owner', scope: 'platform' }, error: null })
    renderAuth()
    expect(await screen.findByText('platform_owner')).toBeInTheDocument()
  })

  it('ignores an old role request after sign out', async () => {
    let finishRequest
    supabase.rpc.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve }))
    renderAuth()
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalled())
    act(() => mocks.authChanged('SIGNED_OUT', null))
    expect(await screen.findByText('No role')).toBeInTheDocument()
    await act(async () => finishRequest({ data: { role: 'platform_owner' }, error: null }))
    expect(screen.getByText('No role')).toBeInTheDocument()
  })
})
