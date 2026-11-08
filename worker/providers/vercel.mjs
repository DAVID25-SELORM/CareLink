import { requestJson } from './http.mjs'

export class VercelAdapter {
  constructor({ token = process.env.VERCEL_TOKEN, teamId = process.env.VERCEL_TEAM_ID, gitRepo = process.env.VERCEL_GIT_REPO, fetchImpl = fetch } = {}) {
    this.token = token; this.teamId = teamId; this.gitRepo = gitRepo; this.fetchImpl = fetchImpl; this.base = 'https://api.vercel.com'
    if (!this.token || !this.teamId) throw new Error('Vercel configuration is incomplete')
  }
  request(path, options = {}) { const join = path.includes('?') ? '&' : '?'; return requestJson(this.base, `${path}${join}teamId=${encodeURIComponent(this.teamId)}`, { ...options, token:this.token, fetchImpl:this.fetchImpl }) }
  async findProject(name) { try { return await this.request(`/v9/projects/${encodeURIComponent(name)}`) } catch (error) { if (error.message.includes('(404)')) return null; throw error } }
  async createProject(name) { return (await this.findProject(name)) || this.request('/v9/projects', { method:'POST', body:{ name, framework:'vite', gitRepository:this.gitRepo ? { type:'github', repo:this.gitRepo } : undefined } }) }
  setEnvironment(project, key, value, target = ['production']) { return this.request(`/v10/projects/${encodeURIComponent(project)}/env`, { method:'POST', body:{ key, value, type:'encrypted', target } }) }
  async deploy(name, ref) {
    const existing = await this.request(`/v6/deployments?projectId=${encodeURIComponent(name)}&limit=20`)
    const deployments = existing?.deployments || []
    const match = deployments.find(item => ['READY', 'QUEUED', 'INITIALIZING', 'BUILDING'].includes(item.readyState || item.state) && (item.meta?.githubCommitSha === ref || item.gitSource?.sha === ref))
    if (match) return match
    return this.request('/v13/deployments', { method:'POST', body:{ name, target:'production', gitSource: this.gitRepo ? { type:'github', repo:this.gitRepo, ref } : undefined } })
  }
  deployment(id) { return this.request(`/v13/deployments/${encodeURIComponent(id)}`) }
}
