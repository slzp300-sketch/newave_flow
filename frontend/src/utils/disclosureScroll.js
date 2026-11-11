// Height and scroll share the same duration/curve, so they move as one gesture.
export const DISCLOSURE_SECONDS = 0.28
export const disclosureEase = t => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, t)))) / 2

// Reveal the beginning of long content without taking its opening button offscreen.
export function revealDelta({ panelTop, panelBottom, anchorTop, top, bottom }) {
  if (panelTop >= top && panelBottom <= bottom) return 0
  if (panelTop < top) return panelTop - top
  return Math.max(0, Math.min(panelBottom - bottom, Math.max(top, anchorTop) - top))
}
export function returnPosition(scrollTop, anchorTop, originalAnchorTop) {
  return Math.max(0, scrollTop + anchorTop - originalAnchorTop)
}

export function createDisclosureScroll() {
  let root, view, intent = null, generation = 0, active = null
  const frames = new Set()
  const later = fn => {
    const id = view.requestAnimationFrame(time => { frames.delete(id); fn(time) })
    frames.add(id)
  }
  const current = scroller => scroller === view ? view.scrollY : scroller.scrollTop
  const scrollerFor = panel => {
    for (let node = panel.parentElement; node && node !== root.ownerDocument.body; node = node.parentElement) {
      // A modal may start overflowing only after this panel opens.
      if (/(auto|scroll)/.test(view.getComputedStyle(node).overflowY)) return node
    }
    return view
  }
  const bounds = scroller => {
    if (scroller !== view) {
      const r = scroller.getBoundingClientRect()
      return { top: r.top + 12, bottom: r.bottom - 12 }
    }
    const viewport = view.visualViewport
    let top = (viewport?.offsetTop || 0) + 12
    let bottom = (viewport?.offsetTop || 0) + (viewport?.height || view.innerHeight) - 12
    const header = root.querySelector('.app-header')?.getBoundingClientRect()
    const nav = root.querySelector('nav[aria-label="주요 메뉴"]')?.getBoundingClientRect()
    if (header && header.top <= top && header.bottom > top) top = header.bottom + 12
    if (nav && nav.top < bottom && nav.bottom >= bottom) bottom = nav.top - 12
    return { top, bottom }
  }
  const stop = () => {
    if (active) active.element.style.overflowAnchor = active.previousAnchor
    active = null
  }
  const scroll = (session, position, reduced) => {
    if (!root || !session.trigger.isConnected || !Number.isFinite(position)) return
    stop()
    const from = current(session.scroller), to = Math.max(0, position)
    if (Math.abs(to - from) < 2) return
    const write = top => session.scroller.scrollTo({ top, behavior: 'instant' })
    if (reduced || view.matchMedia('(prefers-reduced-motion: reduce)').matches) { write(to); return }
    const element = session.scroller === view ? root.ownerDocument.documentElement : session.scroller
    const run = { element, previousAnchor: element.style.overflowAnchor, start: view.performance.now() }
    active = run; element.style.overflowAnchor = 'none'
    const step = now => {
      if (active !== run) return
      if (!session.trigger.isConnected) { stop(); return }
      const progress = Math.min(1, (now - run.start) / (DISCLOSURE_SECONDS * 1000))
      write(from + (to - from) * disclosureEase(progress))
      if (progress < 1) later(step)
      else stop()
    }
    later(step)
  }
  const begin = panel => {
    if (!root || !panel || !intent || view.performance.now() - intent.time > 1000 || !panel.parentElement?.contains(intent.target) || panel.contains(intent.target)) return null
    intent.openedPanel ||= panel
    return { trigger: intent.target, originalAnchorTop: intent.top, intent, generation, scroller: scrollerFor(panel), revealed: false, closed: false }
  }
  const reveal = (session, panel, reduced) => {
    if (!root || !session || session.revealed || session.generation !== generation || session.intent !== intent || intent.openedPanel !== panel || !panel?.isConnected) return
    session.revealed = true
    const r = panel.getBoundingClientRect(), anchor = session.trigger.getBoundingClientRect()
    // scrollHeight measures the final content while Framer starts with height: 0.
    const delta = revealDelta({ panelTop: r.top, panelBottom: r.top + Math.max(r.height, panel.scrollHeight), anchorTop: anchor.top, ...bounds(session.scroller) })
    if (Math.abs(delta) > 2) scroll(session, current(session.scroller) + delta, reduced)
  }
  const closing = (session, panel) => {
    if (!session || !intent || session.intent === intent || !(session.trigger === intent.target || panel?.parentElement?.contains(intent.target))) return null
    const r = panel?.getBoundingClientRect()
    const removedBeforeAnchor = r && r.bottom <= session.trigger.getBoundingClientRect().top ? r.height : 0
    return { intent, generation, removedBeforeAnchor }
  }
  const restore = (session, close, reduced) => {
    if (!root || !session || !close || session.closed || close.intent !== intent || close.generation !== generation) return
    session.closed = true
    later(() => {
      // Opening another accordion takes priority over restoring the old one.
      if (!root || close.intent !== intent || close.generation !== generation || close.intent.openedPanel || !session.trigger.isConnected) return
      scroll(session, returnPosition(current(session.scroller), session.trigger.getBoundingClientRect().top - close.removedBeforeAnchor, session.originalAnchorTop), reduced)
    })
  }
  const connect = element => {
    root = element; view = root.ownerDocument.defaultView
    const interrupt = () => { generation++; stop() }
    const capture = event => {
      if (event.type === 'keydown') {
        if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) interrupt()
        if (!['Enter', ' '].includes(event.key) || event.repeat) return
        interrupt()
      }
      const target = event.target?.closest?.('button, [role="button"], input[type="checkbox"], input[type="radio"], .supporting-toggle')
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return
      intent = { target, top: target.getBoundingClientRect().top, time: view.performance.now() }
    }
    // Document capture includes React portals; begin still verifies the actual panel/trigger relationship.
    const listeners = [[root.ownerDocument, 'click', capture], [root.ownerDocument, 'keydown', capture],
      [view, 'pointerdown', interrupt], [view, 'wheel', interrupt], [view, 'touchmove', interrupt], [view, 'blur', interrupt]]
    for (const [node, name, fn] of listeners) node.addEventListener(name, fn, { capture: true, passive: true })
    return () => {
      stop()
      for (const [node, name, fn] of listeners) node.removeEventListener(name, fn, { capture: true })
      for (const id of frames) view.cancelAnimationFrame(id)
      frames.clear(); intent = null; root = null
    }
  }
  return { connect, begin, reveal, closing, restore }
}
