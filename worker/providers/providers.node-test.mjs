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

test('project reconciliation rejects foreign, unknown and duplicate ownership', async () => {
  for (const projects of [
    [{ name:'hospital', organization_slug:'other' }],
    [{ name:'hospital' }],
    [{ name:'hospital', organization_slug:'approved' }, { name:'hospital', organization_slug:'approved' }],
  ]) {
    const calls=[]
    const adapter=new SupabaseManagementAdapter({token:'test',organization:'approved',fetchImpl:async (url, options) => {
      calls.push(options.method)
      return {ok:true,status:200,text:async()=>JSON.stringify(projects)}
    }})
    await assert.rejects(adapter.createProject({name:'hospital',region:'test'}))
    assert.deepEqual(calls,['GET'])
  }
})

test('project reconciliation reuses an owned resource without creating another', async () => {
  const adapter=new SupabaseManagementAdapter({token:'test',organization:'approved',fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify([{id:'existing',name:'hospital',organization_slug:'approved'}])})})
  assert.equal((await adapter.createProject({name:'hospital',region:'test'})).id,'existing')
})

for (const state of ['READY','QUEUED','INITIALIZING','BUILDING']) {
  test(`deployment retry reuses matching ${state} deployment`, async () => {
    const calls=[]
    const adapter=new VercelAdapter({token:'test',teamId:'team',gitRepo:'owner/repo',fetchImpl:async (url,options)=>{
      calls.push(options.method)
      return {ok:true,status:200,text:async()=>JSON.stringify({deployments:[{id:'existing',readyState:state,gitSource:{sha:'a'.repeat(40)}}]})}
    }})
    assert.equal((await adapter.deploy('hospital','a'.repeat(40))).id,'existing')
    assert.deepEqual(calls,['GET'])
  })
}
test('deployment retry does not reuse a different commit', async () => {
  const calls=[]
  const adapter=new VercelAdapter({token:'test',teamId:'team',gitRepo:'owner/repo',fetchImpl:async (url,options)=>{
    calls.push(options.method)
    return {ok:true,status:200,text:async()=>JSON.stringify(options.method==='GET'?{deployments:[{id:'other',readyState:'READY',gitSource:{sha:'b'.repeat(40)}}]}:{id:'new'})}
  }})
  assert.equal((await adapter.deploy('hospital','a'.repeat(40))).id,'new')
  assert.deepEqual(calls,['GET','POST'])
})
