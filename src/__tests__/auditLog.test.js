/**
 * Audit log service tests
 * Tests that logAuditEvent calls Supabase with the correct payload
 * and silently swallows errors (audit must never block business operations).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logAuditEvent } from '../services/auditLog'

// Mock the supabase client
const mockInsert = vi.fn()
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: () => ({ insert: mockInsert }),
  },
}))

const testUser = { id: 'user-123', email: 'admin@hospital.gh' }

describe('logAuditEvent', () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockInsert.mockResolvedValue({ error: null })
  })

  it('calls supabase.from("audit_log").insert with the correct fields', async () => {
    await logAuditEvent({
      user: testUser,
      action: 'CREATE',
      tableName: 'patients',
      recordId: 'rec-456',
      newValues: { name: 'Ama Mensah' },
    })

    expect(mockInsert).toHaveBeenCalledOnce()
    const [payload] = mockInsert.mock.calls[0]
    expect(payload[0]).toMatchObject({
      user_id: 'user-123',
      user_email: 'admin@hospital.gh',
      action: 'CREATE',
      table_name: 'patients',
      record_id: 'rec-456',
    })
  })

  it('serialises new_values and old_values as plain JSON', async () => {
    await logAuditEvent({
      user: testUser,
      action: 'UPDATE',
      tableName: 'prescriptions',
      recordId: 'rec-789',
      oldValues: { status: 'pending' },
      newValues: { status: 'dispensed' },
    })

    const [payload] = mockInsert.mock.calls[0]
    expect(payload[0].old_values).toEqual({ status: 'pending' })
    expect(payload[0].new_values).toEqual({ status: 'dispensed' })
  })

  it('does NOT throw when Supabase returns an error (audit must not block main flow)', async () => {
    mockInsert.mockResolvedValue({ error: new Error('RLS policy violation') })
    await expect(
      logAuditEvent({ user: testUser, action: 'DELETE', tableName: 'patients' })
    ).resolves.not.toThrow()
  })

  it('handles a null user gracefully', async () => {
    await logAuditEvent({ user: null, action: 'READ', tableName: 'drugs' })
    const [payload] = mockInsert.mock.calls[0]
    expect(payload[0].user_id).toBeNull()
    expect(payload[0].user_email).toBeNull()
  })
})
