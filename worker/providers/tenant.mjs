import { requestJson } from './http.mjs'

export async function inviteAdministrator({ projectUrl, secretKey, email, fetchImpl = fetch }) {
  if (!projectUrl || !secretKey || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid tenant invitation configuration is required')
  return requestJson(projectUrl, '/auth/v1/invite', { token:secretKey, method:'POST', body:{ email }, fetchImpl })
}
export async function verifyTenantHealth({ projectUrl, publishableKey, fetchImpl = fetch }) {
  if (!projectUrl || !publishableKey) throw new Error('Tenant health configuration is incomplete')
  return requestJson(projectUrl, '/rest/v1/', { token:publishableKey, fetchImpl })
}
export async function verifyTenantIdentity({ projectUrl, secretKey, fetchImpl = fetch }) {
  if (!projectUrl || !secretKey) throw new Error('Tenant identity configuration is incomplete')
  const rows = await requestJson(projectUrl, '/rest/v1/carelink_instance?select=instance_kind&singleton=eq.true', { token:secretKey, fetchImpl })
  if (!Array.isArray(rows) || rows[0]?.instance_kind !== 'tenant') throw new Error('Tenant instance identity verification failed')
  return rows[0]
}
