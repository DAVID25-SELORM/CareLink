import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHospitalSession } from '../src/services/hospitalSession.mjs'

test('switch revokes old database and clears cache before verification', async () => {
  const events = []
  const session = createHospitalSession({
    clearCache: () => events.push('clear'),
    createDatabase: (tenant_id, user_id) => ({
      rpc: async () => { events.push(`verify:${tenant_id}`); return { data: { tenant_id, user_id, role: 'nurse' } } },
      dispose: () => events.push(`dispose:${tenant_id}`),
    }),
  })
  await session.select('a', 'user')
  await session.select('b', 'user')
  assert.deepEqual(events, ['clear','verify:a','dispose:a','clear','verify:b'])
  assert.equal(session.current().hospitalId, 'b')
  session.reset()
  assert.equal(session.current(), null)
})
test('slow previous selection cannot replace a later selection', async () => {
  let release
  const session = createHospitalSession({ clearCache() {}, createDatabase: (tenant_id, user_id) => ({
    dispose() {}, rpc: () => tenant_id === 'a' ? new Promise(resolve => { release = resolve }) : Promise.resolve({data:{tenant_id,user_id,role:'doctor'}}),
  }) })
  const old = session.select('a', 'user')
  await new Promise(resolve => setImmediate(resolve))
  await session.select('b', 'user')
  release({ data: { tenant_id: 'a', user_id: 'user', role: 'admin' } })
  await assert.rejects(old, /selection changed/)
  assert.equal(session.current().hospitalId, 'b')
})
test('server identity mismatch or platform role never becomes clinical access', async () => {
  for (const data of [null, {tenant_id:'a',user_id:'other',role:'admin'}, {tenant_id:'a',user_id:'user',role:'platform_owner'}]) {
    let disposed = false
    const session = createHospitalSession({clearCache() {}, createDatabase: () => ({rpc:async()=>({data}),dispose:()=>{disposed=true}})})
    await assert.rejects(session.select('a','user'), /access denied/)
    assert.equal(session.current(), null)
    assert.equal(disposed, true)
  }
})
test('logout during verification prevents access from being restored', async () => {
  let release
  const session=createHospitalSession({clearCache() {},createDatabase:()=>({dispose() {},rpc:()=>new Promise(resolve=>{release=resolve})})})
  const pending=session.select('a','user')
  await new Promise(resolve => setImmediate(resolve))
  session.reset()
  release({data:{tenant_id:'a',user_id:'user',role:'admin'}})
  await assert.rejects(pending,/selection changed/)
  assert.equal(session.current(),null)
})

test('asynchronous cache cleanup finishes before creating a new database', async () => {
  let release
  let created = false
  const session = createHospitalSession({
    clearCache: () => new Promise(resolve => { release = resolve }),
    createDatabase: (tenant_id,user_id) => { created=true; return {dispose() {},rpc:async()=>({data:{tenant_id,user_id,role:'doctor'}})} },
  })
  const pending=session.select('a','user')
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(created,false)
  assert.equal(session.current(),null)
  release()
  await pending
  assert.equal(created,true)
})

test('failed cache cleanup blocks new hospital access', async () => {
  let created=false
  const session=createHospitalSession({clearCache:async()=>{throw new Error('Cache unavailable')},createDatabase:()=>{created=true}})
  await assert.rejects(session.select('a','user'),/Cache unavailable/)
  assert.equal(created,false)
  assert.equal(session.current(),null)
})

test('overlapping resets cannot finish an old cleanup after a new scope opens', async () => {
  const releases = []
  const events = []
  const session = createHospitalSession({
    clearCache: () => new Promise(resolve => { events.push('clear'); releases.push(resolve) }),
    createDatabase: (tenant_id, user_id) => {
      events.push('open'); return { dispose() {}, rpc: async () => ({ data: { tenant_id, user_id, role: 'doctor' } }) }
    },
  })
  session.reset()
  const pending = session.select('b', 'user')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events, ['clear'])
  releases[0]()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events, ['clear', 'clear'])
  releases[1]()
  await pending
  assert.deepEqual(events, ['clear', 'clear', 'open'])
})
