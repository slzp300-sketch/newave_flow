import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient } from '@tanstack/react-query'
import { eventRangeKey, invalidateAfterWrite } from '../src/api/queryPolicy.js'

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
