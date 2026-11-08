import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHospitalCache } from '../src/services/hospitalCache.mjs'
test('held review exposes only own hospital/user metadata, not clinical payload', async () => {
  const hospitalId='10000000-0000-0000-0000-000000000001'
  const userId='20000000-0000-0000-0000-000000000001'
  const base={id:'operation',hospitalId,userId,status:'sending',table:'patients',type:'update',recordId:'row',created_at:'test',payload:{name:'Synthetic private field'}}
  const cache=createHospitalCache({hospitalId,userId,openDatabase:async()=>({getAll:async()=>[
    base,{...base,id:'foreign-hospital',hospitalId:'other'},
    {...base,id:'foreign-user',userId:'other'},{...base,id:'pending',status:'pending'},
  ],close(){}})})
  const entries=await cache.heldMutations()
  assert.deepEqual(entries,[{id:'operation',table:'patients',type:'update',recordId:'row',created_at:'test'}])
  cache.dispose()
  await assert.rejects(cache.heldMutations(),/closed/)
})
