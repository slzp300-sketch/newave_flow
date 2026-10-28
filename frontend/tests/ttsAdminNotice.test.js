import test from 'node:test'
import assert from 'node:assert/strict'
import { ttsAdminReadState } from '../src/utils/ttsAdminReadState.js'

const ready={isSuccess:true,isError:false,isFetching:false,fetchStatus:'idle',data:[{teacherId:1}]}
test('offline notice takes priority over cached success, in-flight reads and previous errors',()=>{
  for(const query of [ready,{...ready,isFetching:true,fetchStatus:'fetching'},{...ready,isError:true}])
    assert.equal(ttsAdminReadState(query,false),'offline')
  assert.equal(ttsAdminReadState({...ready,fetchStatus:'paused'}),'offline')
})
test('first read and refresh stay loading; only successful settled reads expose latest counts',()=>{
  assert.equal(ttsAdminReadState({isSuccess:false,fetchStatus:'paused'},false),'offline')
  assert.equal(ttsAdminReadState({isSuccess:false,fetchStatus:'fetching',isFetching:true}),'loading')
  assert.equal(ttsAdminReadState({...ready,isFetching:true,fetchStatus:'fetching'}),'loading')
  assert.equal(ttsAdminReadState({...ready,isError:true}),'error')
  assert.equal(ttsAdminReadState(ready),'ready')
  assert.equal(ttsAdminReadState({...ready,data:[]}),'ready')
})
