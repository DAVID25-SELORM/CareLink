import { randomBytes } from 'node:crypto'
import { requestJson } from './http.mjs'

export class SupabaseManagementAdapter {
  constructor({ token = process.env.SUPABASE_MANAGEMENT_TOKEN, organization = process.env.SUPABASE_ORGANIZATION, fetchImpl = fetch } = {}) {
    this.token = token; this.organization = organization; this.fetchImpl = fetchImpl; this.base = 'https://api.supabase.com'
    if (!this.token || !this.organization) throw new Error('Supabase management configuration is incomplete')
  }
  request(path, options = {}) { return requestJson(this.base, path, { ...options, token: this.token, fetchImpl: this.fetchImpl }) }
  async findProject(name) { const data = await this.request('/v1/projects'); return (Array.isArray(data) ? data : data?.projects || []).find(p => p.name === name || p.slug === name) || null }
  async createProject({ name, region }) {
    const existing = await this.findProject(name); if (existing) return existing
    return this.request('/v1/projects', { method:'POST', body:{ organization_slug:this.organization, name, db_pass:randomBytes(32).toString('base64url'), region } })
  }
  health(ref) { return this.request(`/v1/projects/${encodeURIComponent(ref)}/health`) }
  migrate(ref, name, query) { return this.request(`/v1/projects/${encodeURIComponent(ref)}/database/migrations`, { method:'POST', body:{ name, query } }) }
  apiKeys(ref) { return this.request(`/v1/projects/${encodeURIComponent(ref)}/api-keys?reveal=true`) }
}
