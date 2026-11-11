import test from 'node:test'
import assert from 'node:assert/strict'
import { createMotionPreferenceStore } from '../src/utils/motionPreference.js'

function fixture() {
  const view = new EventTarget(), query = new EventTarget()
  view.document = new EventTarget()
  query.matches = true
  view.matchMedia = () => query
  return { view, query, store: createMotionPreferenceStore(view) }
}
test('reduced motion reads the device setting on initial load and after a live change', () => {
  const { query, store } = fixture(), values = []
  assert.equal(store.getSnapshot(), true)
  const stop = store.subscribe(() => values.push(store.getSnapshot()))
  query.matches = false; query.dispatchEvent(new Event('change'))
  query.matches = true; query.dispatchEvent(new Event('change'))
  assert.deepEqual(values, [false, true]); stop()
})
test('app return rechecks a setting changed while suspended and removes all listeners on cleanup', () => {
  const { view, query, store } = fixture(), values = []
  const stop = store.subscribe(() => values.push(store.getSnapshot()))
  query.matches = false; view.dispatchEvent(new Event('focus'))
  query.matches = true; view.document.dispatchEvent(new Event('visibilitychange'))
  query.matches = false; view.dispatchEvent(new Event('pageshow'))
  assert.deepEqual(values, [false, true, false]); stop()
  query.dispatchEvent(new Event('change')); view.dispatchEvent(new Event('focus'))
  view.document.dispatchEvent(new Event('visibilitychange')); view.dispatchEvent(new Event('pageshow'))
  assert.equal(values.length, 3)
})
test('non-browser rendering has a stable normal-mode snapshot and safe cleanup', () => {
  const store = createMotionPreferenceStore(undefined)
  assert.equal(store.getSnapshot(), false)
  store.subscribe(() => assert.fail('must not notify without a browser'))()
})

test('one component unmounting does not disconnect other motion subscribers', () => {
  const { query, store } = fixture(); let first = 0, second = 0
  const stopFirst = store.subscribe(() => first++)
  const stopSecond = store.subscribe(() => second++)
  query.dispatchEvent(new Event('change'))
  stopFirst(); query.dispatchEvent(new Event('change'))
  assert.equal(first, 1); assert.equal(second, 2)
  stopSecond(); query.dispatchEvent(new Event('change'))
  assert.equal(second, 2)
})
