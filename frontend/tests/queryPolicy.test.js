import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient } from '@tanstack/react-query'
import { eventRangeKey, invalidateAfterWrite } from '../src/api/queryPolicy.js'

test('new-family assignments refresh class submission summaries and personal completion', async () => {
  const qc=new QueryClient()
  const keys=['officer-attendance','admin-weekly-attendance','weekly-report','report-summary','weekly-status','grade-care']
  for(const key of keys)qc.setQueryData([key,'2026-11-08'],{})
  await invalidateAfterWrite(qc,'/new-family/1/assignment')
  for(const key of keys)assert.equal(qc.getQueryState([key,'2026-11-08']).isInvalidated,true,key)
  qc.clear()
})

test('prayer votes and team changes refresh intercession views and access', async () => {
  for (const url of ['/prayer-votes','/intercession/team','/officers/organization/2026/INTERCESSION']) {
    const qc=new QueryClient()
    for (const key of ['intercession','intercession-list','intercession-detail','tts-week']) qc.setQueryData([key],{})
    await invalidateAfterWrite(qc,url)
    for (const key of ['intercession','intercession-list','intercession-detail']) assert.equal(qc.getQueryState([key]).isInvalidated,true)
    if (url==='/intercession/team') assert.equal(qc.getQueryState(['tts-week']).isInvalidated,false)
    qc.clear()
  }
})

test('Home and Calendar ranges fetch independently regardless of visit order', async () => {
  for (const reverse of [false,true]) {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 300000 } } })
    const queries = [
      { queryKey: eventRangeKey('2026-10-01','2026-10-31'), queryFn: async () => ['October'] },
      { queryKey: eventRangeKey('2026-09-27','2026-10-31'), queryFn: async () => ['September','October'] },
    ]
    for (const query of reverse ? [...queries].reverse() : queries) await qc.fetchQuery(query)
    assert.deepEqual(qc.getQueryData(queries[0].queryKey),['October'])
    assert.deepEqual(qc.getQueryData(queries[1].queryKey),['September','October'])
    qc.clear()
  }
})
test('class reassignment invalidates both admin and teacher rosters without touching unsaved TTS data', async () => {
  const qc=new QueryClient()
  for(const key of ['my-classes','my-class-students','admin-roster-full','roster','tts-week']) qc.setQueryData([key],{example:true})
  await invalidateAfterWrite(qc,'/admin/students/1/class')
  for(const key of ['my-classes','my-class-students','admin-roster-full','roster']) assert.equal(qc.getQueryState([key]).isInvalidated,true)
  assert.equal(qc.getQueryState(['tts-week']).isInvalidated,false)
  qc.clear()
})
test('evangelism edits update personal and administrator views', async () => {
  const qc=new QueryClient()
  for(const key of ['evangelism-status','evangelism-schedules-all-teacher','evangelism-schedules-all']) qc.setQueryData([key],[])
  await invalidateAfterWrite(qc,'/evangelism/groups/move/1')
  for(const query of qc.getQueryCache().getAll()) assert.equal(query.state.isInvalidated,true)
  qc.clear()
})

test('returning to a recently viewed widget preview reads newly saved checks', async () => {
  for (const url of ['/tts/answer-fields', '/prayer-votes', '/meetings/attendance', '/reports/submit', '/weekly-reports/teachers/1']) {
    const qc=new QueryClient({defaultOptions:{queries:{staleTime:30_000}}})
    let saved=false, reads=0
    const preview={queryKey:['widget-preview'],queryFn:async()=>{reads++;return {checked:saved}}}
    assert.deepEqual(await qc.fetchQuery(preview),{checked:false})
    saved=true
    await invalidateAfterWrite(qc,url)
    assert.deepEqual(await qc.fetchQuery(preview),{checked:true},url)
    assert.equal(reads,2,url)
    qc.clear()
  }
})

test('widget summary changes expire the preview without discarding other in-progress data', async () => {
  for (const url of ['/events/1','/minutes/1/read','/attendance/batch','/admin/tts/questions/1','/new-family/people/1/assignment','/admin/classes/1','/users/me/profile']) {
    const qc=new QueryClient()
    qc.setQueryData(['widget-preview'],{done:2})
    qc.setQueryData(['tts-week','2026-11-08'],{draft:'kept'})
    await invalidateAfterWrite(qc,url)
    assert.equal(qc.getQueryState(['widget-preview']).isInvalidated,true,url)
    assert.deepEqual(qc.getQueryData(['tts-week','2026-11-08']),{draft:'kept'})
    qc.clear()
  }
  const qc=new QueryClient();qc.setQueryData(['widget-preview'],{done:2})
  await invalidateAfterWrite(qc,'/intercession/requests')
  assert.equal(qc.getQueryState(['widget-preview']).isInvalidated,false)
  qc.clear()
})
