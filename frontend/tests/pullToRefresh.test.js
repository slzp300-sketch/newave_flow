import test from 'node:test'
import assert from 'node:assert/strict'
import { installPullToRefresh } from '../src/utils/pullToRefresh.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture({ refresh = async () => {} } = {}) {
  const view = new EventTarget(), doc = new EventTarget()
  const state = { distance: 0, refreshing: false }, updates = []
  let time = 1000, calls = 0
  view.document = doc
  view.scrollY = 0
  view.performance = { now: () => time }
  view.getComputedStyle = node => ({ overflowY: node.overflow || 'visible' })
  doc.visibilityState = 'visible'
  doc.body = { parentElement: null }
  const node = (selector = '', parentElement = doc.body) => ({
    parentElement,
    closest(selectors) {
      if (selector && selectors.split(', ').includes(selector)) return this
      return parentElement?.closest?.(selectors) ?? null
    },
  })
  const page = node()
  const stop = installPullToRefresh({ view, refresh: () => { calls++; return refresh() },
    onDistance: value => { state.distance = value; updates.push(['distance', value]) },
    onRefreshing: value => { state.refreshing = value; updates.push(['refreshing', value]) },
  })
  const emit = (type, extra = {}, target = page, owner = view) => {
    const event = new Event(type, { cancelable: extra.cancelable ?? true })
    Object.defineProperty(event, 'target', { value: target })
    const { cancelable, ...props } = extra
    Object.assign(event, props)
    owner.dispatchEvent(event)
    return event.defaultPrevented
  }
  const point = (y, x = 10, identifier = 1) => ({ clientX: x, clientY: y, identifier })
  const touch = (type, y, target = page, x = 10, extra = {}) => emit(type, {
    touches: type === 'touchend' ? [] : [point(y, x)], changedTouches: [point(y, x)], ...extra,
  }, target)
  const drag = (target = page) => {
    touch('touchstart', 100, target)
    const prevented = touch('touchmove', 270, target)
    touch('touchend', 270, target)
    return prevented
  }
  return { view, doc, node, page, point, stop, emit, touch, drag, state, updates, calls: () => calls, advance: ms => { time += ms } }
}

test('small tap movements remain native and never request a refresh', () => {
  const f = fixture()
  f.touch('touchstart', 100)
  for (const y of [101, 103, 109, 100]) assert.equal(f.touch('touchmove', y), false)
  assert.equal(f.touch('touchend', 100), false)
  let clicks = 0
  f.view.addEventListener('click', () => clicks++)
  assert.equal(f.emit('click'), false)
  assert.equal(clicks, 1)
  assert.equal(f.calls(), 0)
  assert.equal(f.state.distance, 0)
  f.stop()
})

test('controls and their nested icons keep taps, drags and native activation', () => {
  const f = fixture()
  for (const selector of ['button', 'a[href]', 'label', 'summary', 'input', 'select', 'textarea', '[role="button"]', '[role="tab"]', '[role="checkbox"]', '[role="switch"]', '[contenteditable="true"]', '[draggable="true"]', 'dialog', '[role="dialog"]']) {
    assert.equal(f.drag(f.node('', f.node(selector))), false, selector)
  }
  assert.equal(f.calls(), 0)
  f.stop()
})

test('intentional page pull refreshes once, resets after success and accepts a new pull', async () => {
  let resolve
  const f = fixture({ refresh: () => new Promise(done => { resolve = done }) })
  assert.equal(f.drag(), true)
  assert.equal(f.calls(), 1)
  assert.deepEqual(f.state, { distance: 70, refreshing: true })
  assert.equal(f.drag(), false)
  assert.equal(f.calls(), 1)
  resolve(); await tick()
  assert.deepEqual(f.state, { distance: 0, refreshing: false })
  assert.equal(f.drag(), true)
  assert.equal(f.calls(), 2)
  resolve(); await tick()
  f.stop()
})

test('failed refresh releases the gesture without blocking the next action', async () => {
  const f = fixture({ refresh: async () => { throw Error('offline') } })
  f.drag(); await tick()
  assert.deepEqual(f.state, { distance: 0, refreshing: false })
  assert.equal(f.emit('click', {}, f.node('button')), false)
  assert.equal(f.drag(), true)
  await tick()
  assert.equal(f.calls(), 2)
  f.stop()
})

test('leaving the app without touchend cancels the gesture; returning does not reload or refetch', async () => {
  for (const type of ['blur', 'pagehide', 'visibilitychange', 'pause', 'resume']) {
    const f = fixture()
    f.touch('touchstart', 100); f.touch('touchmove', 200)
    assert.ok(f.state.distance > 0)
    if (type === 'visibilitychange') f.doc.visibilityState = 'hidden'
    f.emit(type, {}, f.page, ['blur', 'pagehide'].includes(type) ? f.view : f.doc)
    f.doc.visibilityState = 'visible'
    assert.equal(f.touch('touchmove', 300), false, type)
    f.touch('touchend', 300)
    assert.equal(f.calls(), 0, type)
    assert.equal(f.state.distance, 0)
    assert.equal(f.drag(f.node('button')), false)
    assert.equal(f.drag(), true)
    await tick(); f.stop()
  }
})

test('background transition clears only refresh feedback and does not duplicate an in-flight read', async () => {
  let resolve
  const f = fixture({ refresh: () => new Promise(done => { resolve = done }) })
  f.drag()
  f.emit('pause', {}, f.page, f.doc)
  f.emit('resume', {}, f.page, f.doc)
  assert.deepEqual(f.state, { distance: 0, refreshing: false })
  assert.equal(f.drag(f.node('button')), false)
  assert.equal(f.drag(), false)
  assert.equal(f.calls(), 1)
  resolve(); await tick()
  assert.equal(f.drag(), true)
  resolve(); await tick(); f.stop()
})

test('horizontal swipes, upward scrolling and nested scroll containers retain their native gestures', () => {
  const f = fixture()
  for (const [y, x] of [[110, 40], [80, 10]]) {
    f.touch('touchstart', 100)
    assert.equal(f.touch('touchmove', y, f.page, x), false)
    assert.equal(f.touch('touchmove', 300), false)
    f.touch('touchend', 300)
  }
  const nested = Object.assign(f.node(), { scrollHeight: 500, clientHeight: 150, overflow: 'auto' })
  assert.equal(f.drag(f.node('', nested)), false)
  f.view.scrollY = 30
  assert.equal(f.drag(), false)
  assert.equal(f.calls(), 0)
  f.stop()
})

test('touch cancellation, a second finger and browser-owned scrolling never submit a refresh', () => {
  const f = fixture()
  for (const action of [
    () => f.emit('touchcancel'),
    () => f.touch('touchmove', 180, f.page, 10, { touches: [f.point(180), f.point(180, 50, 2)] }),
    () => f.touch('touchmove', 180, f.page, 10, { touches: [] }),
    () => f.touch('touchmove', 180, f.page, 10, { cancelable: false }),
  ]) {
    f.touch('touchstart', 100); action()
    assert.equal(f.touch('touchmove', 300), false)
    f.touch('touchend', 300)
  }
  // No move event means no intentional drag, even if the final coordinate differs.
  f.touch('touchstart', 100); f.touch('touchend', 300)
  assert.equal(f.calls(), 0)
  f.stop()
})

test('touch compatibility mouse events cannot start a second gesture; genuine mouse dragging still works', async () => {
  const f = fixture()
  f.touch('touchstart', 100); f.touch('touchend', 100)
  const mouse = (type, y) => f.emit(type, { button: 0, buttons: type === 'mouseup' ? 0 : 1, clientX: 10, clientY: y })
  mouse('mousedown', 100)
  assert.equal(mouse('mousemove', 270), false)
  mouse('mouseup', 270)
  assert.equal(f.calls(), 0)
  f.advance(701)
  mouse('mousedown', 100)
  assert.equal(mouse('mousemove', 270), true)
  mouse('mouseup', 270)
  await tick()
  assert.equal(f.calls(), 1)
  mouse('mousedown', 100)
  f.emit('mousemove', { clientX: 10, clientY: 270, buttons: 0 })
  mouse('mouseup', 270)
  assert.equal(f.calls(), 1)
  f.stop()
})

test('unmount removes listeners and ignores completion of a pending read', async () => {
  let resolve
  const f = fixture({ refresh: () => new Promise(done => { resolve = done }) })
  f.drag(); f.stop()
  const count = f.updates.length
  f.emit('pause', {}, f.page, f.doc)
  assert.equal(f.drag(), false)
  resolve(); await tick()
  assert.equal(f.updates.length, count)
  assert.equal(f.calls(), 1)
})
