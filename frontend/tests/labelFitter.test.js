import test from 'node:test'
import assert from 'node:assert/strict'
import { createLabelFitter } from '../src/utils/labelFitter.js'

function fixture() {
  const view = new EventTarget(), root = new EventTarget(), frames = new Map(), resize = [], mutations = []
  let id = 0, writes = 0, reads = 0, dirty = false, layouts = 0
  const measure = () => { reads++; if (dirty) { layouts++; dirty = false } }
  const fonts = new EventTarget(); fonts.ready = new Promise(() => {})
  root.fontSize = '16px'
  view.document = { documentElement: root, fonts }
  view.requestAnimationFrame = fn => { frames.set(++id, fn); return id }
  view.cancelAnimationFrame = id => frames.delete(id)
  view.getComputedStyle = el => { measure(); return { fontSize: el.fontSize || '16px' } }
  const observer = list => class {
    constructor(fn) { this.fn = fn; this.targets = new Set(); list.push(this) }
    observe(el) { this.targets.add(el) }
    unobserve(el) { this.targets.delete(el) }
    disconnect() { this.targets.clear() }
  }
  view.ResizeObserver = observer(resize); view.MutationObserver = observer(mutations)
  const label = (threshold = 14.5, width = 80) => {
    let size = 16
    return {
      textContent: '가상 긴 버튼 제목', isConnected: true, parentElement: { fontSize: '16px' }, width,
      style: { get fontSize() { return `${size}px` }, set fontSize(value) { size = parseFloat(value); writes++; dirty = true } },
      getBoundingClientRect() { measure(); return { width: this.width } },
      get scrollWidth() { measure(); return size > threshold ? this.width + 20 : this.width },
      get clientWidth() { measure(); return this.width },
      get scrollHeight() { measure(); return size * 1.4 * 2 },
    }
  }
  return { view, root, resize, mutations, fonts, label, fitter: createLabelFitter(view),
    frames: () => frames.size, writes: () => writes, reads: () => reads, layouts: () => layouts,
    flush: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()) },
  }
}
test('100 labels share one pair of observers and one frame, with layout rounds independent of label count', () => {
  const f = fixture(), labels = Array.from({ length: 100 }, () => f.label())
  const stops = labels.map(el => f.fitter.observe(el, 2))
  assert.equal(f.resize.length, 1); assert.equal(f.mutations.length, 1); assert.equal(f.frames(), 1)
  f.flush()
  assert.ok(labels.every(el => el.style.fontSize === '14.5px'))
  assert.equal(f.layouts(), 4) // 100 labels × 4 alternating passes previously.
  const writes = f.writes()
  f.resize[0].fn(labels.map(target => ({ target }))); f.flush()
  assert.equal(f.writes(), writes)
  stops.forEach(stop => stop())
  assert.equal(f.resize[0].targets.size, 0); assert.equal(f.mutations[0].targets.size, 0)
})
test('large-font mode and font loading recompute size without shrinking below the accessibility floor', () => {
  const f = fixture(), el = f.label(1), stop = f.fitter.observe(el, 2)
  f.flush(); assert.equal(el.style.fontSize, '14px')
  f.root.fontSize = '19.2px'; el.parentElement.fontSize = '19.2px'
  f.mutations[0].fn(); f.flush(); assert.ok(Math.abs(parseFloat(el.style.fontSize) - 16.8) < .001)
  const writes = f.writes(); f.fonts.dispatchEvent(new Event('loadingdone')); f.flush()
  assert.ok(f.writes() > writes); stop()
})
test('hidden labels wait for a visible size, and unmounted labels cannot write later', () => {
  const f = fixture(), el = f.label(14, 0), stop = f.fitter.observe(el, 2)
  f.flush(); assert.equal(f.writes(), 0)
  el.width = 80; f.resize[0].fn([{ target: el }]); f.flush(); assert.equal(el.style.fontSize, '14px')
  f.view.dispatchEvent(new Event('resize')); stop()
  const writes = f.writes(); f.flush(); assert.equal(f.writes(), writes); assert.equal(f.frames(), 0)
  const second = f.label(), cleanup = f.fitter.observe(second, 2); f.flush()
  assert.equal(second.style.fontSize, '14.5px'); cleanup()
})
