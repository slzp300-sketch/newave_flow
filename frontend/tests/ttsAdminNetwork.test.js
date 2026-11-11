import test from 'node:test'
import assert from 'node:assert/strict'
import {QueryClient,QueryObserver,onlineManager} from '@tanstack/react-query'
import {quarterRefreshData} from './fixtures/ttsQuarterRefresh.js'
import {assessQuarter,adminQuarterScore,filterQuarterStatus} from '../src/utils/ttsQuarterAssessment.js'
import {ttsAdminRefreshOptions} from '../src/utils/ttsAdminRefresh.js'
import {createTtsAdminViewState} from '../src/store/ttsAdminViewState.js'
import {quarterPeople} from '../src/utils/ttsPeriod.js'
import {quarterScore} from '../src/utils/ttsQuarterAssessment.js'
import {createTtsRankingViewState} from '../src/store/ttsRankingViewState.js'
import {queryReadState} from '../src/utils/queryReadState.js'
const tick=()=>new Promise(resolve=>setTimeout(resolve,10))

for(const screen of ['administrator','teacher']) for(const scenario of ['disconnect-during-request','server-error-retry','server-error-reconnect']) test(`statistics ${screen}: ${scenario} preserves selection and recovers latest totals`,async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:1,retryDelay:0,staleTime:300000}}})
  const view=(screen==='teacher'?createTtsRankingViewState:createTtsAdminViewState)('virtual-user')
  const rowsOf=data=>screen==='teacher'?quarterPeople(data.people,2027,2):data
  const scoreOf=screen==='teacher'?quarterScore:adminQuarterScore
  view.getState().setField('search','갱신교사');view.getState().setField('statusFilter','below')
  let updated=false,mode='ok',rejectPending,attempts=0
  const query={queryKey:screen==='teacher'?['tts-stats',2027]:['tts-quarterly-scores',2027,2],...ttsAdminRefreshOptions,queryFn:async()=>{
    attempts++
    if(mode==='hold')await new Promise((_,reject)=>{rejectPending=reject})
    if(mode==='fail')throw new Error('virtual failure')
    return screen==='teacher'?quarterRefreshData(updated).stats:quarterRefreshData(updated).admin(2)
  }}
  client.mount();const observer=new QueryObserver(client,query),stop=observer.subscribe(()=>{})
  const selection=()=>{assert.equal(view.getState().search,'갱신교사');assert.equal(view.getState().statusFilter,'below')}
  try {
    await tick();assert.equal(assessQuarter(rowsOf(observer.getCurrentResult().data),scoreOf).average,20)
    updated=true
    if(scenario==='disconnect-during-request') {
      mode='hold';const pending=observer.refetch();await tick()
      assert.equal(observer.getCurrentResult().fetchStatus,'fetching');selection()
      mode='fail';onlineManager.setOnline(false);rejectPending(new Error('virtual connection lost'));await tick()
      assert.equal(observer.getCurrentResult().fetchStatus,'paused');selection()
      assert.equal(queryReadState([observer.getCurrentResult()]),'loading')
      assert.equal(assessQuarter(rowsOf(observer.getCurrentResult().data),scoreOf).average,20,'old cache not overwritten with empty data')
      const pausedAttempts=attempts;await tick();assert.equal(attempts,pausedAttempts)
      mode='ok';onlineManager.setOnline(true);await pending;await tick()
    } else {
      mode='fail';await observer.refetch();await tick()
      assert.equal(queryReadState([observer.getCurrentResult()]),'error');selection()
      if(scenario==='server-error-reconnect'){onlineManager.setOnline(false);mode='ok';onlineManager.setOnline(true);await tick()}
      else {mode='ok';await observer.refetch()}
    }
    selection();assert.equal(queryReadState([observer.getCurrentResult()]),'ready')
    const rows=rowsOf(observer.getCurrentResult().data),a=assessQuarter(rows,scoreOf)
    assert.deepEqual([a.average,a.passed,a.below,a.unrecorded],[40,2,2,0])
    assert.equal(filterQuarterStatus(rows.filter(r=>(r.teacherName??r.name).includes(view.getState().search)),a,view.getState().statusFilter,scoreOf).length,2)
  } finally {stop();client.unmount();onlineManager.setOnline(true);client.clear()}
})


test('teacher ranking selections survive remount, stay separate from admin, reset on account switch',()=>{
  const teacher=createTtsRankingViewState('teacher-a'),admin=createTtsAdminViewState('teacher-a')
  const selected={year:2027,quarter:2,search:'갱신교사',statusFilter:'below'}
  const stop=teacher.subscribe(()=>{})
  for(const [key,value] of Object.entries(selected))teacher.getState().setField(key,value)
  stop();const stopAgain=teacher.subscribe(()=>{})
  teacher.getState().selectAccount('teacher-a')
  for(const [key,value] of Object.entries(selected))assert.equal(teacher.getState()[key],value)
  assert.equal(admin.getState().search,'');assert.equal(admin.getState().statusFilter,'all')
  teacher.getState().selectAccount('teacher-b')
  assert.equal(teacher.getState().search,'');assert.equal(teacher.getState().statusFilter,'all')
  stopAgain()
})
