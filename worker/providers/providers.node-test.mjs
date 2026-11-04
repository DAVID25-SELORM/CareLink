import test from 'node:test'
import assert from 'node:assert/strict'
import { SupabaseManagementAdapter } from './supabase.mjs'
import { VercelAdapter } from './vercel.mjs'

function mockFetch() {
  const calls = []
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return { ok:true, status:200, text: async () => JSON.stringify(url.includes('/projects') && options.method === 'GET' ? { projects: [] } : { id:'project-1', name:'carelink-test', readyState:'READY', status:'ACTIVE_HEALTHY' }) } }
  return { calls, fetchImpl }
}
test('provider adapters use bearer auth and deterministic project names', async () => {
  const supabaseMock = mockFetch(); const supabase = new SupabaseManagementAdapter({ token:'management-token', organization:'org', fetchImpl:supabaseMock.fetchImpl })
  const project = await supabase.createProject({ name:'carelink-test', region:'eu-west-1' })
  assert.equal(project.id, 'project-1'); assert.match(supabaseMock.calls[0].options.headers.Authorization, /^Bearer /)
  const vercelMock = mockFetch(); const vercel = new VercelAdapter({ token:'vercel-token', teamId:'team', fetchImpl:vercelMock.fetchImpl })
  await vercel.createProject('carelink-test'); assert.match(vercelMock.calls[0].url, /teamId=team/)
})
