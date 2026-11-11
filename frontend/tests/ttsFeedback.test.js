import test from 'node:test'
import assert from 'node:assert/strict'
import { ttsSaveFeedback, ttsFeedbackIndex, ttsCompletionMessage } from '../src/utils/ttsFeedback.js'

const weekStart = '2026-10-18'
const mutation = (id, status, questionId, day) => ({ id, status, variables: { weekStart, questionId, day } })

test('shared feedback index uses latest field IDs even when history is unordered', () => {
  const index = ttsFeedbackIndex([mutation(5, 'success', 1, '월'), mutation(2, 'error', 1, '월'),
    mutation(3, 'pending', 2), mutation(4, 'error', 1, '화'),
    { ...mutation(6, 'pending', 3), variables: { weekStart: '2026-10-11', questionId: 3 } }], weekStart)
  assert.equal(index.overall.kind, 'pending')
  assert.equal(index.questions.get(1).kind, 'error')
  assert.equal(index.questions.get(2).kind, 'pending')
  assert.equal(index.questions.has(3), false)
})
test('another successful field cannot hide a failed day; retry clears only that day', () => {
  const history = [mutation(1, 'error', 1, '월'), mutation(2, 'success', 1, '화'), mutation(3, 'success', 2)]
  assert.equal(ttsSaveFeedback(history, weekStart).kind, 'error')
  assert.equal(ttsSaveFeedback(history, weekStart, 2).kind, 'success')
  assert.equal(ttsSaveFeedback(history, '2026-10-11').kind, 'idle')
  history.push(mutation(4, 'pending', 1, '월'))
  assert.equal(ttsSaveFeedback(history, weekStart).kind, 'pending')
  history[3].status = 'success'
  assert.equal(ttsSaveFeedback(history, weekStart).kind, 'success')
})
test('completion distinguishes daily vs weekly and waits for acknowledged saves even with zero-point items', () => {
  const args = { items: [{ daily: true, done: 2, total: 6 }, { daily: false, done: 0, total: 1 }], todayLabel: '화', remainingToday: [] }
  assert.match(ttsCompletionMessage(args).text, /일별 체크 완료 · 예배·모임 1개 미체크/)
  assert.equal(ttsCompletionMessage({ ...args, saving: true }), null)
  assert.equal(ttsCompletionMessage({ ...args, failed: true }), null)
  const complete = { ...args, items: args.items.map(i => ({ ...i, done: i.total })) }
  assert.equal(ttsCompletionMessage(complete).text, '이번 주 전체 체크 완료')
  assert.equal(ttsCompletionMessage({ ...complete, items: [] }), null)
})
