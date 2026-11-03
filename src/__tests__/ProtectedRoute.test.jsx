/**
 * ProtectedRoute tests
 * Verifies auth-gating and role-gating behaviour without a live backend.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'

// Mock useAuth so tests control the auth state
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../hooks/useAuth'

const renderWithRouter = (ui, { initialEntries = ['/'] } = {}) =>
  render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>)

describe('ProtectedRoute', () => {
  it('redirects platform owners away from unrestricted clinical routes', () => {
    useAuth.mockReturnValue({ user: { id: 'owner' }, userRole: 'platform_owner', loading: false })
    renderWithRouter(<Routes>
      <Route path="/" element={<ProtectedRoute><p>Clinical data</p></ProtectedRoute>} />
      <Route path="/platform" element={<p>Platform home</p>} />
    </Routes>)
    expect(screen.getByText('Platform home')).toBeInTheDocument()
    expect(screen.queryByText('Clinical data')).not.toBeInTheDocument()
  })

  it('redirects tenant admins away from platform routes', () => {
    useAuth.mockReturnValue({ user: { id: 'admin' }, userRole: 'admin', loading: false })
    renderWithRouter(<Routes>
      <Route path="/" element={<ProtectedRoute platformOnly><p>Tenant directory</p></ProtectedRoute>} />
      <Route path="/dashboard" element={<p>Hospital home</p>} />
    </Routes>)
    expect(screen.getByText('Hospital home')).toBeInTheDocument()
    expect(screen.queryByText('Tenant directory')).not.toBeInTheDocument()
  })

  it('renders the platform workspace without requiring a hospital admin role', () => {
    useAuth.mockReturnValue({ user: { id: 'owner' }, userRole: 'platform_owner', loading: false })
    renderWithRouter(<ProtectedRoute platformOnly><p>Tenant directory</p></ProtectedRoute>)
    expect(screen.getByText('Tenant directory')).toBeInTheDocument()
  })

  it('fails closed when database role verification fails', () => {
    useAuth.mockReturnValue({ user: { id: '1', user_metadata: { role: 'admin' } }, userRole: null, loading: false, accessError: 'Verification failed' })
    renderWithRouter(<ProtectedRoute><p>Clinical data</p></ProtectedRoute>)
    expect(screen.getByText('Verification failed')).toBeInTheDocument()
    expect(screen.queryByText('Clinical data')).not.toBeInTheDocument()
  })
  it('shows a loading state while auth is being resolved', () => {
    useAuth.mockReturnValue({ user: null, userRole: null, loading: true })
    renderWithRouter(<ProtectedRoute><p>Protected content</p></ProtectedRoute>)
    expect(screen.getByText(/loading carelink/i)).toBeInTheDocument()
  })

  it('redirects to /login when no user is authenticated', () => {
    useAuth.mockReturnValue({ user: null, userRole: null, loading: false })
    renderWithRouter(<ProtectedRoute><p>Protected content</p></ProtectedRoute>)
    // Navigate renders nothing visible; protected content must NOT be shown
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when the user is authenticated and no roles are required', () => {
    useAuth.mockReturnValue({ user: { id: '1' }, userRole: 'nurse', loading: false })
    renderWithRouter(<ProtectedRoute><p>Protected content</p></ProtectedRoute>)
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('renders children when the user role is in the allowed list', () => {
    useAuth.mockReturnValue({ user: { id: '1' }, userRole: 'admin', loading: false })
    renderWithRouter(
      <ProtectedRoute allowedRoles={['admin', 'doctor']}>
        <p>Admin content</p>
      </ProtectedRoute>
    )
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })

  it('shows an access-restricted message when the user role is not allowed', () => {
    useAuth.mockReturnValue({ user: { id: '1' }, userRole: 'cashier', loading: false })
    renderWithRouter(
      <ProtectedRoute allowedRoles={['admin', 'doctor']}>
        <p>Doctor only content</p>
      </ProtectedRoute>
    )
    expect(screen.getByText(/access restricted/i)).toBeInTheDocument()
    expect(screen.queryByText('Doctor only content')).not.toBeInTheDocument()
  })
})
