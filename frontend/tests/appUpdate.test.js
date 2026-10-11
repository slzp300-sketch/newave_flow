import test from 'node:test'
import assert from 'node:assert/strict'
import { applyAppUpdate } from '../src/utils/appUpdate.js'

test('first-install update waits for activation and reloads only after confirmation', async () => {
  const serviceWorker = new EventTarget()
  let messages = 0, reloads = 0
  const registration = { waiting: { postMessage(message) {
    assert.deepEqual(message, { type: 'SKIP_WAITING' })
    messages++
  } } }
  assert.equal(messages, 0)
  const update = applyAppUpdate(registration, serviceWorker, () => reloads++)
  assert.equal(messages, 1)
  assert.equal(reloads, 0)
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  await update
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  assert.equal(reloads, 1)
})

test('an update already activated by another tab can be opened explicitly', async () => {
  let reloads = 0
  await applyAppUpdate({ waiting: null }, new EventTarget(), () => reloads++)
  assert.equal(reloads, 1)
})

test('failed or unfinished activation keeps the current page and allows retry', async () => {
  const serviceWorker = new EventTarget()
  let reloads = 0
  const reload = () => reloads++
  await assert.rejects(applyAppUpdate(null, serviceWorker, reload))
  await assert.rejects(applyAppUpdate({ installing: {} }, serviceWorker, reload))
  await assert.rejects(applyAppUpdate({ waiting: { postMessage() {} } }, serviceWorker, reload, 5))
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  assert.equal(reloads, 0)
})
