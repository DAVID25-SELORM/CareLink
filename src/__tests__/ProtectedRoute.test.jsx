/**
 * ProtectedRoute tests
 * Verifies auth-gating and role-gating behaviour without a live backend.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'

// Mock useAuth so tests control the auth state
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../hooks/useAuth'

const renderWithRouter = (ui, { initialEntries = ['/'] } = {}) =>
  render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>)

describe('ProtectedRoute', () => {
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
