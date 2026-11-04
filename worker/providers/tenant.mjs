import { requestJson } from './http.mjs'

export async function inviteAdministrator({ projectUrl, secretKey, email, fetchImpl = fetch }) {
  if (!projectUrl || !secretKey || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid tenant invitation configuration is required')
  return requestJson(projectUrl, '/auth/v1/invite', { token:secretKey, method:'POST', body:{ email }, fetchImpl })
}
export async function verifyTenantHealth({ projectUrl, publishableKey, fetchImpl = fetch }) {
  if (!projectUrl || !publishableKey) throw new Error('Tenant health configuration is incomplete')
  return requestJson(projectUrl, '/rest/v1/', { token:publishableKey, fetchImpl })
}
