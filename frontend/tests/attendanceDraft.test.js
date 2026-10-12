import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { hasQueryData, queryReadState } from '../src/utils/queryReadState.js'
import { scopedDraft, studentEventForm, teacherEventForm, confirmAttendance } from '../src/utils/attendanceDraft.js'

test('inactive event views preserve missing records without presenting draft defaults as attendance', () => {
  const students = [{ studentId: 1, status: null }, { studentId: 2, status: 'ABSENT', absenceReason: 'saved reason' }]
  const saved = studentEventForm(students, undefined, null)
  assert.deepEqual(saved.statusMap, { 1: null, 2: 'ABSENT' })
  assert.equal(saved.reasonMap[2], 'saved reason')
  assert.equal(saved.editing, false)
  assert.equal(studentEventForm(students).statusMap[1], 'PRESENT')
})

test('cached empty/null attendance stays visible during refresh, error and offline; writes stay blocked', () => {
  for (const data of [null, [], { status: 'SUBMITTED' }]) {
    for (const state of [{ isFetching: true }, { isError: true }, { fetchStatus: 'paused' }]) {
      const reads = [{ isSuccess: true, data, ...state }]
      assert.equal(hasQueryData(reads), true)
      assert.notEqual(queryReadState(reads), 'ready')
    }
  }
  assert.equal(hasQueryData([{ data: undefined }]), false)
  assert.equal(hasQueryData([{ data: [], isPlaceholderData: true }]), false)
  assert.equal(hasQueryData([{ data: [] }, { data: undefined }]), false)
})

test('event/student drafts survive changed server records and cannot cross event/user keys', () => {
  const saved = studentEventForm([{ studentId: 1, status: 'PRESENT' }])
  const values = { ...saved, statusMap: { 1: 'ABSENT' }, reasonMap: { 1: '작성 중 사유' }, editing: true }
  const draft = { key: 'event1:user1', values }
  assert.equal(scopedDraft(draft, 'event1:user1', saved), values)
  for (const key of ['event2:user1', 'event1:user2']) assert.equal(scopedDraft(draft, key, saved), saved)
  const refreshed = studentEventForm([{ studentId: 1, status: 'PARTIAL', absenceReason: '이전 사유' }], values)
  assert.equal(refreshed.statusMap[1], 'ABSENT')
  assert.equal(refreshed.reasonMap[1], '작성 중 사유')
  assert.equal(refreshed.editing, true)
})

test('changed roster keeps surviving drafts, initializes new students and excludes removed IDs', () => {
  const old = studentEventForm([{ studentId: 1 }, { studentId: 2 }])
  old.statusMap[2] = 'PARTIAL'; old.partialFromDateMap[2] = '2026-10-18'; old.partialNoteMap[2] = '오후 참석'
  const next = studentEventForm([{ studentId: 2 }, { studentId: 3, status: 'ABSENT', absenceReason: '여행' }], old)
  assert.deepEqual(next.statusMap, { 2: 'PARTIAL', 3: 'ABSENT' })
  assert.equal(next.partialFromDateMap[2], '2026-10-18')
  assert.equal(next.partialNoteMap[2], '오후 참석')
  assert.equal(next.reasonMap[3], '여행')
  assert.deepEqual(studentEventForm([], old).statusMap, {})
})

test('nullable teacher record starts unsubmitted; existing draft is independent of a server refresh', () => {
  const empty = teacherEventForm(null)
  assert.equal(empty.pending, null)
  const values = { ...empty, pending: 'ABSENT', absenceReason: '작성 중', editing: true }
  const changed = teacherEventForm({ status: 'PRESENT' })
  assert.equal(scopedDraft({ key: 'one', values }, 'one', changed).absenceReason, '작성 중')
  assert.equal(scopedDraft({ key: 'one', values }, 'two', empty).pending, null)
})

test('acknowledged save remains visible even when background verification fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const key = ['event-attendance', 1, 2]
  client.setQueryData(key, [{ studentId: 1, studentName: '가상 학생', status: 'PRESENT' }])
  const observer = new QueryObserver(client, { queryKey: key, staleTime: Infinity, queryFn: async () => { throw new Error('offline') } })
  const stop = observer.subscribe(() => {})
  await confirmAttendance(client, key, [{ studentId: 1, status: 'ABSENT', absenceReason: '여행' }])
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(observer.getCurrentResult().isError, true)
  assert.equal(hasQueryData([observer.getCurrentResult()]), true)
  assert.deepEqual(client.getQueryData(key), [{ studentId: 1, studentName: '가상 학생', status: 'ABSENT', absenceReason: '여행' }])
  stop(); client.clear()
})

test('acknowledged save cancels an earlier read so stale data cannot overwrite it', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const key = ['event-teacher-attendance', 1, 2]
  client.setQueryData(key, null)
  let finishOldRead
  const oldRead = client.fetchQuery({ queryKey: key, queryFn: () => new Promise(resolve => { finishOldRead = resolve }) }).catch(() => {})
  await confirmAttendance(client, key, { status: 'PARTIAL', partialFromDate: '2026-10-18', partialNote: '오후' })
  finishOldRead(null)
  await oldRead
  assert.equal(client.getQueryData(key).status, 'PARTIAL')
  assert.equal(client.getQueryData(key).partialNote, '오후')
  client.clear()
})
