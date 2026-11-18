// Mobile money / card payments are confirmed by the cashier against the provider's confirmation SMS or the
// facility's wallet statement (no provider API is connected). The reference is what makes that checkable later,
// so it is required, normalised, and a reference already used on another payment is refused.

export const REFERENCE_REQUIRED_METHODS = ['momo', 'card']
export const MOMO_PROVIDERS = ['mtn', 'telecel', 'airteltigo']

export const normalizeReference = (value) => String(value || '').trim().replace(/\s+/g, '').toUpperCase()

/** Returns { ok, error, reference } for the cashier form. */
export function checkPaymentReference({ method, provider, reference }) {
  if (method === 'momo' && !MOMO_PROVIDERS.includes(provider)) return { ok: false, error: 'Choose the mobile money network' }
  const ref = normalizeReference(reference)
  if (!REFERENCE_REQUIRED_METHODS.includes(method)) return { ok: true, reference: ref || null }
  if (!ref) return { ok: false, error: `Enter the ${method === 'momo' ? 'mobile money transaction ID' : 'card receipt number'}` }
  if (!/^[A-Z0-9._/-]{6,30}$/.test(ref)) return { ok: false, error: 'The reference must be 6 to 30 letters or digits, copied from the confirmation message' }
  return { ok: true, reference: ref }
}
