// SMS provider adapter shared by the SMS functions. Keys come from Edge Function secrets only.
//   SMS_API_KEY, SMS_SENDER_ID (11 characters or fewer), SMS_PROVIDER (default "arkesel")
// Arkesel v2 request shape: check it against the provider's current API docs before going live.
export function makeSendSms() {
  const provider = (Deno.env.get('SMS_PROVIDER') || 'arkesel').toLowerCase()
  const apiKey = Deno.env.get('SMS_API_KEY') || ''
  const senderId = Deno.env.get('SMS_SENDER_ID') || ''
  return async function sendSms(phone: string, message: string): Promise<boolean> {
    if (provider !== 'arkesel' || !apiKey || !senderId) return false
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: senderId, message, recipients: [phone] }),
    })
    const result = await response.json().catch(() => ({}))
    return response.ok && result?.status === 'success'
  }
}
