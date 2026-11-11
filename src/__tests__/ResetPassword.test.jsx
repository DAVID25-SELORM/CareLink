import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResetPassword from '../pages/ResetPassword'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../supabaseClient', () => ({ supabase: { auth } }))
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const renderPage = () => render(<MemoryRouter initialEntries={['/reset-password']}>
  <Routes>
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/login" element={<p>login page</p>} />
  </Routes>
</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  auth.updateUser.mockResolvedValue({ error: null })
  auth.signOut.mockResolvedValue({ error: null })
})

describe('ResetPassword', () => {
  it('shows the form for a recovery session and updates then signs out', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    renderPage()
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword1' }))
    expect(auth.signOut).toHaveBeenCalled()
    expect(await screen.findByText('login page')).toBeTruthy()
  })

  it('rejects mismatched passwords without calling Supabase', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    renderPage()
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different123' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('shows an invalid-link message when no recovery session appears', async () => {
    vi.useFakeTimers()
    auth.getSession.mockResolvedValue({ data: { session: null } })
    renderPage()
    await vi.advanceTimersByTimeAsync(4500)
    vi.useRealTimers()
    expect(await screen.findByText(/invalid or expired/i)).toBeTruthy()
  })
})
