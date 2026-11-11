import test from 'node:test'
import assert from 'node:assert/strict'
import { listMotionTiming } from '../src/utils/listMotion.js'

test('a long list never waits for offscreen rows to enter', () => {
  const timings = Array.from({ length: 500 }, (_, index) => listMotionTiming(index))
  assert.equal(timings.filter(t => t.enter).length, 6)
  assert.ok(timings.every(t => t.delay <= 0.125))
  assert.ok(timings.slice(6).every(t => !t.enter && t.delay === 0))
})
test('reduced motion and list editing never use staggered entrance', () => {
  for (const index of [0, 5, 100]) {
    assert.deepEqual(listMotionTiming(index, true), { enter: false, delay: 0, duration: 0 })
    assert.equal(listMotionTiming(index, false, true).enter, false)
  }
})
