import test from 'node:test'
import assert from 'node:assert/strict'
import { createDisclosureScroll, revealDelta, returnPosition, disclosureEase } from '../src/utils/disclosureScroll.js'

function fixture({ nested = false, reduced = false } = {}) {
  const doc = new EventTarget(), view = new EventTarget()
  let now = 0, next = 0
  const frames = new Map(), writes = []
  view.performance = { now: () => now }
  view.requestAnimationFrame = fn => { frames.set(++next, fn); return next }
  view.cancelAnimationFrame = id => frames.delete(id)
  view.innerHeight = 700; view.scrollY = 0
  view.matchMedia = () => ({ matches: reduced })
  view.getComputedStyle = node => ({ overflowY: node.overflow || 'visible' })
  view.scrollTo = ({ top }) => { view.scrollY = top; writes.push(top) }
  doc.defaultView = view
  const node = (parentElement, y = 0, height = 0) => ({
    parentElement, y, height, style: { overflowAnchor: '' }, isConnected: true, ownerDocument: doc, scrollTop: 0,
    contains(other) { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false },
    closest() { return this }, matches() { return false }, querySelector() { return null },
    getBoundingClientRect() {
      let offset = view.scrollY
      for (let n = this.parentElement; n; n = n.parentElement) offset += n.scrollTop
      return { top: this.y - offset, bottom: this.y - offset + this.height, height: this.height }
    },
    scrollTo({ top }) { this.scrollTop = top; writes.push(top) },
  })
  doc.documentElement = node(null); doc.body = node(doc.documentElement)
  const root = node(doc.body)
  const scroller = nested ? node(doc.body, 100, 300) : view
  if (nested) scroller.overflow = 'auto'
  const container = node(nested ? scroller : root)
  const trigger = node(container, nested ? 330 : 560, 44)
  const panel = node(container, trigger.y + 44, 0)
  panel.scrollHeight = 400
  const controller = createDisclosureScroll(), disconnect = controller.connect(root)
  const emit = (type, target = trigger, extra = {}) => {
    const event = new Event(type, { cancelable: true })
    Object.defineProperty(event, 'target', { value: target }); Object.assign(event, extra)
    ;(['click','keydown'].includes(type) ? doc : view).dispatchEvent(event)
    assert.equal(event.defaultPrevented, false)
  }
  const advance = ms => {
    const end = now + ms
    while (now < end) {
      now = Math.min(end, now + 16)
      const batch = [...frames.values()]; frames.clear()
      for (const fn of batch) fn(now)
    }
  }
  const open = () => { emit('pointerdown'); emit('click'); const session = controller.begin(panel); controller.reveal(session,panel,false); return session }
  return { doc, view, root, node, container, trigger, panel, controller, disconnect, advance, emit, open, writes, frames, scroller }
}

test('short visible content stays still; long content reveals its beginning without hiding the button', () => {
  assert.equal(revealDelta({ panelTop:200,panelBottom:400,anchorTop:160,top:60,bottom:650 }),0)
  assert.equal(revealDelta({ panelTop:600,panelBottom:1600,anchorTop:550,top:60,bottom:650 }),490)
  assert.equal(returnPosition(400,100,500),0)
  assert.equal(disclosureEase(0),0); assert.equal(disclosureEase(1),1)
  assert.ok(disclosureEase(.1)<.05); assert.ok(disclosureEase(.9)>.95)
})

test('open and close travel gradually and restore the original trigger position', () => {
  const f=fixture(), original=f.trigger.getBoundingClientRect().top, session=f.open()
  assert.equal(f.view.scrollY,0)
  f.advance(240);const halfway=f.view.scrollY
  f.advance(320);assert.ok(halfway>0 && halfway<f.view.scrollY)
  assert.ok(f.writes.length>12);assert.equal(f.doc.documentElement.style.overflowAnchor,'')
  f.emit('pointerdown');f.emit('click')
  f.controller.restore(session,f.controller.closing(session,f.panel),false)
  f.advance(240);assert.ok(f.view.scrollY>0)
  f.advance(320);assert.equal(f.trigger.getBoundingClientRect().top,original)
  assert.equal(f.view.scrollY,0);f.disconnect()
})

test('portal disclosures scroll their own container even before it overflows', () => {
  const f=fixture({nested:true}), session=f.open()
  f.advance(600);assert.ok(f.scroller.scrollTop>0);assert.equal(f.view.scrollY,0)
  f.emit('click');f.controller.restore(session,f.controller.closing(session,f.panel),false)
  f.advance(600);assert.equal(f.scroller.scrollTop,0);f.disconnect()
})

test('manual scrolling, touching, keyboard navigation and leaving the app cancel pending motion', () => {
  for(const type of ['wheel','touchmove','pointerdown','blur','keydown']) {
    const f=fixture();f.open();f.advance(160)
    f.emit(type,f.trigger,{key:'PageDown'});const position=f.view.scrollY
    f.advance(600);assert.equal(f.view.scrollY,position,type)
    assert.equal(f.doc.documentElement.style.overflowAnchor,'');f.disconnect()
  }
})

test('opening another accordion wins over the old accordion return motion', () => {
  const f=fixture(),old=f.open();f.advance(600)
  const nextTrigger=f.node(f.container,620,44),nextPanel=f.node(f.container,664,0);nextPanel.scrollHeight=350
  f.emit('pointerdown',nextTrigger);f.emit('click',nextTrigger)
  f.controller.restore(old,f.controller.closing(old,f.panel),false)
  const session=f.controller.begin(nextPanel);f.controller.reveal(session,nextPanel,false)
  f.advance(600);assert.ok(f.view.scrollY>0);assert.notEqual(f.view.scrollY,0);f.disconnect()
})

test('initial render, expired click and unrelated controls cannot auto-scroll a panel', () => {
  const f=fixture()
  assert.equal(f.controller.begin(f.panel),null)
  f.emit('click');f.advance(1100);assert.equal(f.controller.begin(f.panel),null)
  f.emit('click',f.node(f.root));assert.equal(f.controller.begin(f.panel),null)
  assert.equal(f.writes.length,0);f.disconnect()
})

test('reduced motion performs only the necessary immediate adjustment, cleanup removes queued work', () => {
  const f=fixture({reduced:true});f.open();assert.ok(f.view.scrollY>0);assert.equal(f.writes.length,1);assert.equal(f.frames.size,0);f.disconnect()
  const g=fixture();g.open();g.advance(80);g.disconnect();const position=g.view.scrollY
  assert.equal(g.frames.size,0);assert.equal(g.doc.documentElement.style.overflowAnchor,'')
  g.advance(600);assert.equal(g.view.scrollY,position);assert.equal(g.controller.begin(g.panel),null)
})


test('closing a form above its edit button compensates for the disappearing form height', () => {
  const f=fixture()
  f.view.scrollY=300;f.trigger.y=800;f.panel.y=400;f.panel.height=300
  f.emit('click');const session=f.controller.begin(f.panel)
  // Opening the form displaced its original edit button below it.
  f.trigger.y+=300;f.view.scrollY=100
  f.emit('click',f.node(f.panel,500,44))
  f.controller.restore(session,f.controller.closing(session,f.panel),true)
  f.advance(16);f.trigger.y-=300
  assert.equal(f.view.scrollY,300);assert.equal(f.trigger.getBoundingClientRect().top,500);f.disconnect()
})
