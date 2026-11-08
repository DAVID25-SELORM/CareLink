import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mfa = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  challengeAndVerify: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
}))
vi.mock('../supabaseClient', () => ({ supabase: { auth: { mfa } } }))

import MfaGate from '../components/MfaGate'

beforeEach(() => vi.clearAllMocks())

describe('MfaGate', () => {
  it('passes through when no factor is enrolled and MFA is optional', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
    render(<MfaGate signOut={vi.fn()}><p>Clinical data</p></MfaGate>)
    expect(await screen.findByText('Clinical data')).toBeInTheDocument()
  })

  it('blocks content behind a TOTP challenge when a factor is enrolled', async () => {
    mfa.getAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
      .mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f1' }] }, error: null })
    mfa.challengeAndVerify.mockResolvedValue({ error: null })
    render(<MfaGate signOut={vi.fn()}><p>Clinical data</p></MfaGate>)
    expect(await screen.findByText('Two-factor verification')).toBeInTheDocument()
    expect(screen.queryByText('Clinical data')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    await waitFor(() => expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' }))
    expect(await screen.findByText('Clinical data')).toBeInTheDocument()
  })

  it('keeps content hidden when the code is rejected', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f1' }] }, error: null })
    mfa.challengeAndVerify.mockResolvedValue({ error: { message: 'Invalid TOTP code' } })
    render(<MfaGate signOut={vi.fn()}><p>Clinical data</p></MfaGate>)
    await screen.findByText('Two-factor verification')
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid TOTP code')
    expect(screen.queryByText('Clinical data')).not.toBeInTheDocument()
  })
})
