import { describe, it, expect } from 'vitest'
import { checkPaymentReference, normalizeReference } from '../lib/paymentReference'

describe('payment reference', () => {
  it('normalises case and spaces', () => expect(normalizeReference(' ab 123 456 ')).toBe('AB123456'))
  it('requires a network and reference for mobile money', () => {
    expect(checkPaymentReference({ method: 'momo', provider: '', reference: 'AB123456' }).ok).toBe(false)
    expect(checkPaymentReference({ method: 'momo', provider: 'mtn', reference: '' }).ok).toBe(false)
    expect(checkPaymentReference({ method: 'momo', provider: 'mtn', reference: '12' }).ok).toBe(false)
    expect(checkPaymentReference({ method: 'momo', provider: 'mtn', reference: 'mp 2611 18.ab12' })).toEqual({ ok: true, reference: 'MP261118.AB12' })
  })
  it('keeps the reference optional for cash and insurance', () => {
    expect(checkPaymentReference({ method: 'cash', reference: '' })).toEqual({ ok: true, reference: null })
  })
})
