import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthViewport } from '../src/native/authViewportFlow.js'

test('external authentication releases input focus before preparing the iOS viewport', async () => {
  const calls=[]
  const flow=createAuthViewport({platform:'ios',document:{activeElement:{blur:()=>calls.push('blur')}},native:{prepare:async()=>calls.push('prepare'),restore:async options=>calls.push(options)}})
  assert.equal(await flow.prepare(),true)
  await flow.resume(); await flow.finish(); await flow.finish(false)
  assert.deepEqual(calls,['blur','prepare',{finish:false,force:false},{finish:true,force:true},{finish:true,force:false}])
})
test('viewport bridge failure does not break authentication or subsequent recovery', async () => {
  let fail=true
  const flow=createAuthViewport({platform:'ios',document:{},native:{prepare:async()=>{throw new Error('unavailable')},restore:async()=>{if(fail)throw new Error('unavailable')}}})
  assert.equal(await flow.prepare(),false);assert.equal(await flow.finish(),false)
  fail=false;assert.equal(await flow.finish(),true)
})
test('Android and web do not call the iOS viewport bridge', async () => {
  for(const platform of ['android','web']) {
    let blurred=false
    const flow=createAuthViewport({platform,document:{activeElement:{blur:()=>{blurred=true}}},native:new Proxy({},{get(){assert.fail('iOS bridge must not be called')}})})
    assert.equal(await flow.prepare(),false);assert.equal(blurred,true)
    assert.equal(await flow.resume(),false);assert.equal(await flow.finish(),false)
  }
})
