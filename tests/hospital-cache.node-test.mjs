import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHospitalCache } from '../src/services/hospitalCache.mjs'
const a='10000000-0000-0000-0000-000000000001'
const b='10000000-0000-0000-0000-000000000002'
const u='20000000-0000-0000-0000-000000000001'
const v='20000000-0000-0000-0000-000000000002'
function storage() {
  const databases=new Map()
  return async name=>{
    if(!databases.has(name)) databases.set(name,new Map())
    const rows=databases.get(name)
    return {put:async(_,entry)=>rows.set(JSON.stringify([entry.table,entry.id]),entry),get:async(_,key)=>rows.get(JSON.stringify(key)),clear:async()=>rows.clear(),close() {}}
  }
}
test('same record ID remains isolated by hospital, user and table',async()=>{
  const openDatabase=storage()
  const first=createHospitalCache({hospitalId:a,userId:u,openDatabase})
  await first.put('patients',{id:'same',tenant_id:a})
  assert.equal((await first.get('patients','same')).tenant_id,a)
  assert.equal(await first.get('payments','same'),null)
  for(const [hospitalId,userId] of [[b,u],[a,v]]) {
    const other=createHospitalCache({hospitalId,userId,openDatabase})
    assert.equal(await other.get('patients','same'),null)
  }
})
test('foreign and unscoped rows cannot enter a hospital cache',async()=>{
  const cache=createHospitalCache({hospitalId:a,userId:u,openDatabase:storage()})
  for(const row of [{id:'x',tenant_id:b},{id:'x'}]) await assert.rejects(cache.put('patients',row),/mismatch/)
})
test('clear removes cached rows and disposal denies further reads',async()=>{
  const cache=createHospitalCache({hospitalId:a,userId:u,openDatabase:storage()})
  await cache.put('patients',{id:'x',tenant_id:a})
  await cache.clear()
  assert.equal(await cache.get('patients','x'),null)
  cache.dispose()
  await assert.rejects(cache.get('patients','x'),/closed/)
})
