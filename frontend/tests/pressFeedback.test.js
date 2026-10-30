import test from 'node:test'
import assert from 'node:assert/strict'
import { installPressFeedback } from '../src/utils/pressFeedback.js'

function fixture() {
  const root = new EventTarget(), view = new EventTarget()
  let time = 0, id = 0
  const tasks = new Map()
  view.performance = { now: () => time }
  view.setTimeout = (fn, delay) => { tasks.set(++id, { fn, due: time + delay }); return id }
  view.clearTimeout = id => tasks.delete(id)
  root.ownerDocument = { defaultView: view }
  root.contains = target => target.inside
  const control = ({ disabled = false, link = false } = {}) => ({
    inside: true, attrs: new Map(),
    closest() { return this },
    matches(selector) { return selector === 'a[href]' ? link : disabled },
    setAttribute(name, value) { this.attrs.set(name, value) },
    removeAttribute(name) { this.attrs.delete(name) },
  })
  const emit = (node, type, target, extra = {}) => {
    const event = new Event(type, { cancelable: true })
    Object.defineProperty(event, 'target', { value: target })
    Object.assign(event, { button: 0, pointerId: 1, clientX: 0, clientY: 0, ...extra })
    node.dispatchEvent(event)
    assert.equal(event.defaultPrevented, false, 'feedback must never consume native input')
  }
  const advance = ms => {
    time += ms
    for (const [id, task] of tasks) if (task.due <= time) { tasks.delete(id); task.fn() }
  }
  const pressed = target => target.attrs.has('data-press-feedback')
  const stop = installPressFeedback(root)
  return { root, view, control, emit, advance, pressed, stop, tasks }
}

test('quick taps are perceptible without delaying clicks; rapid re-tap clears the earlier timer', () => {
  const f = fixture(), b = f.control()
  f.emit(f.root, 'pointerdown', b); f.emit(f.view, 'pointerup', b)
  let clicks = 0
  f.root.addEventListener('click', () => clicks++)
  f.emit(f.root, 'click', b)
  assert.equal(clicks, 1)
  assert.equal(f.pressed(b), true)
  f.advance(80); f.emit(f.root, 'pointerdown', b); f.emit(f.view, 'pointerup', b)
  f.advance(40); assert.equal(f.pressed(b), true)
  f.advance(80); assert.equal(f.pressed(b), false)
  f.stop()
})

test('dragging, scrolling, pointer cancellation and app blur release feedback', () => {
  const f = fixture(), b = f.control()
  for (const type of ['pointermove', 'scroll', 'pointercancel', 'blur']) {
    f.emit(f.root, 'pointerdown', b)
    f.emit(type === 'scroll' ? f.root : f.view, type, b, { clientY: 20 })
    assert.equal(f.pressed(b), false, type)
  }
  f.stop()
})

test('disabled controls and secondary pointers have no feedback; keyboard activation remains native', () => {
  const f = fixture(), b = f.control(), disabled = f.control({ disabled: true }), link = f.control({ link: true })
  f.emit(f.root, 'pointerdown', disabled); assert.equal(f.pressed(disabled), false)
  f.emit(f.root, 'pointerdown', b, { isPrimary: false }); assert.equal(f.pressed(b), false)
  f.emit(f.root, 'keydown', link, { key: ' ' }); assert.equal(f.pressed(link), false)
  f.emit(f.root, 'keydown', b, { key: ' ' }); assert.equal(f.pressed(b), true)
  f.emit(f.view, 'keyup', b, { key: ' ' }); f.advance(120)
  assert.equal(f.pressed(b), false)
  f.stop()
})

test('unmount clears timers and listeners even when multiple controls are settling', () => {
  const f = fixture(), a = f.control(), b = f.control()
  f.emit(f.root, 'pointerdown', a); f.emit(f.view, 'pointerup', a)
  f.emit(f.root, 'pointerdown', b); f.emit(f.view, 'pointerup', b)
  f.stop()
  assert.equal(f.tasks.size, 0)
  assert.equal(f.pressed(a), false); assert.equal(f.pressed(b), false)
  f.emit(f.root, 'pointerdown', b); assert.equal(f.pressed(b), false)
})
