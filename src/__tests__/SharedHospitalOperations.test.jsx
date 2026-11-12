import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SharedHospitalOperations from '../components/SharedHospitalOperations'

const mocks = vi.hoisted(() => ({ command: vi.fn(), invoke: vi.fn() }))
vi.mock('../platform/api', () => ({ command: (...args) => mocks.command(...args) }))
vi.mock('../supabaseClient', () => ({ supabase: { functions: { invoke: (...args) => mocks.invoke(...args) } } }))

const tenant = { id: '11111111-1111-1111-1111-111111111111', hospital_name: 'Health Medics', owner_email: 'admin@hospital.org' }
const click = () => fireEvent.click(screen.getByRole('button', { name: /create administrator login/i }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.command.mockImplementation(async name => name === 'platform_readiness' ? { revision: 3 } : 'invitation-id')
})

describe('SharedHospitalOperations administrator invitation', () => {
  it('registers the invitation, then asks the function to email the login', async () => {
    mocks.invoke.mockResolvedValue({ data: { status: 'invited', email: 'admin@hospital.org' }, error: null })
    render(<SharedHospitalOperations tenant={tenant} role="platform_owner" />)
    click()
    expect(await screen.findByText(/invitation email sent to admin@hospital.org/i)).toBeTruthy()
    expect(mocks.command).toHaveBeenCalledWith('platform_invite_shared_administrator', { p_tenant_id: tenant.id, p_revision: 3 })
    expect(mocks.invoke).toHaveBeenCalledWith('invite-hospital-admin', { body: { tenant_id: tenant.id } })
  })

  it('tells the owner when the login email could not be sent', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })
    render(<SharedHospitalOperations tenant={tenant} role="platform_owner" />)
    click()
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/could not be sent/i))
  })

  it('hides the action from non-owners', () => {
    render(<SharedHospitalOperations tenant={tenant} role="platform_admin" />)
    expect(screen.queryByRole('button', { name: /create administrator login/i })).toBeNull()
  })
})
