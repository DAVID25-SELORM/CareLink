import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHospitalSync } from '../src/services/hospitalSync.mjs'
function setup(entries, respond = async () => ({data:[{id:'row'}]})) {
  const calls=[]
  const query={}
  for(const method of ['insert','update','delete','eq']) query[method]=(...args)=>{calls.push([method,...args]);return query}
  query.select=respond
  const cache={pendingMutations:async()=>entries,markMutationSending:async id=>calls.push(['sending',id]),completeMutation:async id=>calls.push(['complete',id]),dispose(){}}
  const runner=createHospitalSync({hospitalId:'a',userId:'u',cache,database:{from:table=>{calls.push(['from',table]);return query}}})
  return {runner,calls}
}
const entry={id:'operation',recordId:'row',hospitalId:'a',userId:'u',table:'patients',type:'update',payload:{name:'Synthetic'}}
test('updates are constrained by hospital and record, then acknowledged',async()=>{
  const {runner,calls}=setup([entry])
  await runner.run()
  assert.deepEqual(calls[0],['sending','operation'])
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='tenant_id'&&c[2]==='a'))
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]==='row'))
  assert.deepEqual(calls.at(-1),['complete','operation'])
})
test('foreign queue entries, tables and record substitutions never reach database',async()=>{
  for(const change of [{hospitalId:'b'},{userId:'other'},{table:'platform_owners'},{payload:{tenant_id:'b'}},{payload:{id:'other'}}]) {
    const {runner,calls}=setup([{...entry,...change}])
    await assert.rejects(runner.run())
    assert.equal(calls.length,0)
  }
})
test('zero-row and failed writes are not acknowledged',async()=>{
  for(const result of [{data:[]},{error:{message:'denied'}}]) {
    const {runner,calls}=setup([entry],async()=>result)
    await assert.rejects(runner.run(),/not confirmed/)
    assert.equal(calls.some(c=>c[0]==='complete'),false)
  }
})
test('switch during write does not acknowledge or execute next queued entry',async()=>{
  let release
  const {runner,calls}=setup([entry,{...entry,id:'next'}],()=>new Promise(resolve=>{release=resolve}))
  const pending=runner.run()
  await new Promise(resolve=>setImmediate(resolve))
  runner.dispose()
  release({data:[{id:'row'}]})
  await assert.rejects(pending,/stopped/)
  assert.equal(calls.filter(c=>c[0]==='from').length,1)
  assert.equal(calls.some(c=>c[0]==='complete'),false)
})
