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

function queueHarness() {
  const client = new QueryClient()
  client.setQueryData(key, { answers: [] })
  const calls = [], requests = []
  let server = { answers: [] }
  const options = ttsAnswerOptions(client, payload => {
    const d = deferred(); calls.push(payload); requests.push(d)
    return d.promise.then(() => {
      server = { answers: [...server.answers.filter(a => a.questionId !== payload.questionId), payload] }
      return structuredClone(server)
    })
  })
  const m = new MutationObserver(client, options)
  return { client, calls, requests, tap: (questionId, checked, day) => m.mutate({ weekStart: week, questionId, checked, day }) }
}

test('eight rapid toggles need only two writes and retain the final unchecked selection', async () => {
  const h = queueHarness()
  const pending = [h.tap(1, true)]; await tick()
  for (let i = 1; i < 8; i++) pending.push(h.tap(1, i % 2 === 0))
  await tick(); assert.equal(answer(h.client, 1), 'false')
  h.requests[0].resolve(); await tick()
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].answerData, 'false')
  h.requests[1].resolve(); await Promise.all(pending)
  assert.equal(h.calls.length, 2); assert.equal(answer(h.client, 1), 'false')
  h.client.clear()
})

test('batched days preserve later edits and never replay a stale week over another question', async () => {
  const h = queueHarness()
  const pending = [h.tap(1, true, '월')]; await tick()
  pending.push(h.tap(1, true, '화'), h.tap(2, true), h.tap(1, false, '월'))
  await tick(); h.requests[0].resolve(); await tick()
  assert.deepEqual(JSON.parse(h.calls[1].answerData), { 월: false, 화: true })
  // A tap after dispatch belongs to the next batch, not the in-flight one.
  pending.push(h.tap(1, false, '화')); await tick()
  h.requests[1].resolve(); await tick()
  assert.equal(h.calls[2].questionId, 2)
  h.requests[2].resolve(); await tick()
  assert.deepEqual(JSON.parse(h.calls[3].answerData), { 월: false, 화: false })
  h.requests[3].resolve(); await Promise.all(pending)
  assert.equal(answer(h.client, 2), 'true')
  assert.deepEqual(JSON.parse(answer(h.client, 1)), { 월: false, 화: false })
  h.client.clear()
})

test('failed batch rolls back all its days, preserves another question, and can be retried', async () => {
  const h = queueHarness()
  const first = h.tap(1, true, '월'); await tick()
  const failedA = h.tap(1, true, '화').catch(e => e.message)
  const other = h.tap(2, true)
  const failedB = h.tap(1, false, '월').catch(e => e.message)
  await tick(); h.requests[0].resolve(); await first; await tick()
  h.requests[1].reject(new Error('batch failure')); await tick()
  h.requests[2].resolve()
  assert.deepEqual(await Promise.all([failedA, failedB]), ['batch failure', 'batch failure'])
  await other
  assert.deepEqual(JSON.parse(answer(h.client, 1)), { 월: true })
  assert.equal(answer(h.client, 2), 'true')
  const retry = h.tap(1, true, '화'); await tick()
  assert.deepEqual(JSON.parse(h.calls[3].answerData), { 월: true, 화: true })
  h.requests[3].resolve(); await retry; h.client.clear()
})

test('different weeks and clients cannot share a question batch', async () => {
  const clients = [new QueryClient(), new QueryClient()]
  for (const client of clients) {
    const calls = []
    const nextWeek = '2026-10-18'
    client.setQueryData(key, { answers: [] })
    client.setQueryData(['tts-week', nextWeek], { answers: [] })
    const m = new MutationObserver(client, ttsAnswerOptions(client, async p => {
      calls.push(p); return { answers: [p] }
    }))
    await Promise.all([m.mutate({ weekStart: week, questionId: 1, checked: true }),
      m.mutate({ weekStart: nextWeek, questionId: 1, checked: false })])
    assert.equal(calls.length, 2)
    assert.equal(answer(client, 1), 'true')
    assert.equal(client.getQueryData(['tts-week', nextWeek]).answers[0].answerData, 'false')
    client.clear()
  }
})

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
  await tick() // First request has left before the next tap.
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
  await tick()
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
