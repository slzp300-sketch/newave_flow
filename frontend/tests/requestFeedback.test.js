import test from 'node:test'
import assert from 'node:assert/strict'
import { queryFeedback, requestErrorMessage } from '../src/utils/requestFeedback.js'
import { hasQueryData, queryReadState } from '../src/utils/queryReadState.js'
import { prayerFormFromVote, meetingFormFromVote } from '../src/utils/voteDraft.js'

const success = {isSuccess:true,fetchStatus:'idle',data:[]}
test('only successful empty reads count as ready; 503 and offline are distinct from empty',()=>{
 assert.equal(queryFeedback([success]),null)
 for(const q of [{isError:true,error:{response:{status:503}}},{fetchStatus:'paused',isPending:true}]){
  assert.equal(hasQueryData([q]),false)
  assert.equal(queryFeedback([q]).failed,true)
  assert.notEqual(queryReadState([q]),'ready')
 }
})
test('cached records and cached empty results explicitly show previous data after refresh failure',()=>{
 for(const data of [[],null,{status:'ATTEND'}]){
  const q={...success,data,isError:true}
  assert.equal(queryFeedback([q]).cached,true)
  assert.match(queryFeedback([q]).detail,/이전에/)
  assert.equal(queryReadState([q]),'error')
 }
})
test('revoked access does not expose cached records as available',()=>{
 for(const status of [401,403]){
  const q={...success,isError:true,error:{response:{status}}}
  assert.equal(hasQueryData([q]),false)
  assert.equal(queryFeedback([q]).cached,false)
 }
})
test('save feedback distinguishes validation, connection, permission, conflict and server errors',()=>{
 assert.match(requestErrorMessage({}),/연결 상태/)
 assert.match(requestErrorMessage({response:{status:403}}),/권한/)
 assert.match(requestErrorMessage({response:{status:401}}),/로그인/)
 assert.match(requestErrorMessage({response:{status:404}}),/대상 자료/)
 assert.match(requestErrorMessage({response:{status:409}}),/최신 자료/)
 assert.match(requestErrorMessage({userMessage:'행사 접수가 종료되었습니다.'}),/접수가 종료/)
 assert.match(requestErrorMessage({response:{status:422,data:{message:'학년을 선택해 주세요.'}}}),/학년/)
 const message=requestErrorMessage({response:{status:503,data:{message:'internal database error'}}})
 assert.match(message,/저장하지 못했습니다/)
 assert.doesNotMatch(message,/database/)
})
test('an absent optional vote is different from a stored absent vote, and reasons survive editing',()=>{
 assert.deepEqual(meetingFormFromVote(null),{status:null,reason:''})
 assert.deepEqual(meetingFormFromVote({status:'ABSENT',reason:'가상 사유'}),{status:'ABSENT',reason:'가상 사유'})
 assert.deepEqual(prayerFormFromVote({status:'TUE',reason:'마이크 사유'}),{status:'TUE',micAvailable:false,reason:'',micReason:'마이크 사유'})
 assert.equal(prayerFormFromVote(null).status,null)
})
