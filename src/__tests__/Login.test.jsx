/**
 * Login page tests
 * Verifies the login form renders correctly and validation is present.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../pages/Login'

// ---- Mock dependencies that reach outside the component ----

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn().mockResolvedValue({ data: null, error: null }),
    user: null,
    loading: false,
  }),
}))

vi.mock('../hooks/useHospitalBranding', () => ({
  useHospitalBranding: () => ({
    branding: { platformName: 'CareLink HMS', hospitalName: 'Test Hospital', tagline: 'Test tagline' },
    hospitalDisplayName: 'Test Hospital',
  }),
}))

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

// react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

// SVG asset import
vi.mock('../assets/carelink-logo.svg', () => ({ default: 'carelink-logo.svg' }))

const renderLogin = () =>
  render(<MemoryRouter><Login /></MemoryRouter>)

describe('Login page', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('renders the email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  })

  it('renders the sign-in submit button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows the forgot password link', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /forgot your password/i })).toBeInTheDocument()
  })

  it('the submit button is a type=submit', () => {
    renderLogin()
    const btn = screen.getByRole('button', { name: /sign in/i })
    expect(btn).toHaveAttribute('type', 'submit')
  })

  it('allows typing into email and password fields', () => {
    renderLogin()
    const emailField = screen.getByLabelText(/email address/i)
    const passwordField = screen.getByLabelText(/^password$/i)
    fireEvent.change(emailField, { target: { value: 'nurse@hospital.gh' } })
    fireEvent.change(passwordField, { target: { value: 'secret123' } })
    expect(emailField.value).toBe('nurse@hospital.gh')
    expect(passwordField.value).toBe('secret123')
  })
})
