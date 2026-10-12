import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, MutationObserver, QueryObserver } from '@tanstack/react-query'
import { ttsReadState, ttsAnswerOptions } from '../src/utils/ttsQuery.js'

test('TTS keeps cached content during refresh and errors, but blocks unsafe edits', () => {
  const ready = { data: { answers: [] }, isSuccess: true }
  assert.deepEqual(ttsReadState([{ ...ready, isFetching: true }]), {
    hasData: true, editable: true, refreshing: true, error: false, paused: false,
  })
  for (const state of [{ isError: true }, { fetchStatus: 'paused' }]) {
    const result = ttsReadState([{ ...ready, ...state }])
    assert.equal(result.hasData, true); assert.equal(result.editable, false)
  }
  assert.equal(ttsReadState([{ data: undefined }]).hasData, false)
  assert.equal(ttsReadState([{ ...ready, isPlaceholderData: true }]).hasData, false)
})

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const week = '2026-10-11'
const key = ['tts-week', week]
const answer = (client, id) => client.getQueryData(key).answers.find(a => a.questionId === id)?.answerData

test('rapid checks stay visible, run serially and successful saves do not refetch the week', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(key, { answers: [] })
  let reads = 0
  const observer = new QueryObserver(client, { queryKey: key, queryFn: () => { reads++; return { answers: [] } } })
  const stop = observer.subscribe(() => {})
  const first = deferred(); const second = deferred(); const calls = []
  const options = ttsAnswerOptions(client, payload => { calls.push(payload); return calls.length === 1 ? first.promise : second.promise })
  const m = new MutationObserver(client, options)
  const a = m.mutate({ weekStart: week, questionId: 1, day: '월', checked: true })
  const b = m.mutate({ weekStart: week, questionId: 1, day: '화', checked: true })
  await tick()
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(answer(client, 1)), { 월: true, 화: true })
  first.resolve({ answers: [{ questionId: 1, answerData: '{"월":true}' }], score: 5 })
  await a; await tick()
  assert.deepEqual(JSON.parse(answer(client, 1)), { 월: true, 화: true })
  assert.deepEqual(JSON.parse(calls[1].answerData), { 월: true, 화: true })
  second.resolve({ answers: [{ questionId: 1, answerData: '{"월":true,"화":true}' }], score: 10 })
  await b; await tick()
  assert.equal(client.getQueryData(key).score, 10); assert.equal(reads, 0)
  stop(); client.clear()
})

test('failed first day does not undo another field or leak into the following day save', async () => {
  const client = new QueryClient()
  client.setQueryData(key, { answers: [] })
  const first = deferred(); const calls = []
  const options = ttsAnswerOptions(client, async payload => {
    calls.push(payload)
    if (calls.length === 1) return first.promise
    return { answers: [...client.getQueryData(key).answers.filter(a => a.questionId !== payload.questionId), payload] }
  })
  const m = new MutationObserver(client, options)
  const failed = m.mutate({ weekStart: week, questionId: 1, day: '월', checked: true }).catch(() => {})
  const next = m.mutate({ weekStart: week, questionId: 1, day: '화', checked: true })
  const other = m.mutate({ weekStart: week, questionId: 2, checked: true })
  await tick(); first.reject(new Error('synthetic failure'))
  await Promise.all([failed, next, other])
  assert.deepEqual(JSON.parse(calls[1].answerData), { 화: true })
  assert.equal(answer(client, 2), 'true')
  assert.deepEqual(JSON.parse(answer(client, 1)), { 화: true })
  client.clear()
})

test('last save failure restores confirmed state while background refresh keeps content', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  client.setQueryData(key, { answers: [{ questionId: 1, answerData: 'true' }] })
  const refresh = deferred()
  const observer = new QueryObserver(client, { queryKey: key, queryFn: () => refresh.promise })
  const stop = observer.subscribe(() => {})
  const mutation = new MutationObserver(client, ttsAnswerOptions(client, () => Promise.reject(new Error('failed'))))
  await assert.rejects(mutation.mutate({ weekStart: week, questionId: 1, checked: false }))
  assert.equal(answer(client, 1), 'true')
  assert.equal(ttsReadState([observer.getCurrentResult()]).hasData, true)
  refresh.resolve({ answers: [{ questionId: 1, answerData: 'true' }] })
  await tick(); stop(); client.clear()
})
