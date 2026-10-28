// One delegated listener set for the app. Feedback never delays or replaces a click.
export function installPressFeedback(root) {
  const view = root.ownerDocument.defaultView
  const timers = new Map()
  let active = null
  const clear = target => {
    view.clearTimeout(timers.get(target))
    timers.delete(target)
    target.removeAttribute('data-press-feedback')
  }
  const cancel = () => {
    if (active) clear(active.target)
    active = null
  }
  const targetOf = event => {
    const target = event.target?.closest?.('button, a[href], summary, [role="button"]')
    return target && root.contains(target) && !target.matches(':disabled, [aria-disabled="true"], [data-motion="off"]') ? target : null
  }
  const start = (target, details) => {
    cancel()
    clear(target)
    target.setAttribute('data-press-feedback', 'true')
    active = { target, started: view.performance.now(), ...details }
  }
  const finish = () => {
    if (!active) return
    const { target, started } = active
    active = null
    // Brief taps remain perceptible, while long presses release immediately.
    timers.set(target, view.setTimeout(() => clear(target), Math.max(0, 120 - (view.performance.now() - started))))
  }
  const down = event => {
    if (event.button !== 0 || event.isPrimary === false) return
    const target = targetOf(event)
    if (target) start(target, { pointerId: event.pointerId, x: event.clientX, y: event.clientY })
  }
  const move = event => {
    if (active?.pointerId === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 8) cancel()
  }
  const up = event => { if (active?.pointerId === event.pointerId) finish() }
  const keyDown = event => {
    if (event.repeat || !['Enter', ' '].includes(event.key)) return
    const target = targetOf(event)
    if (target && !(event.key === ' ' && target.matches('a[href]'))) start(target, { key: event.key })
  }
  const keyUp = event => { if (active?.key === event.key) finish() }
  const reset = () => { cancel(); for (const target of timers.keys()) clear(target) }
  const listeners = [
    [root, 'pointerdown', down], [view, 'pointermove', move], [view, 'pointerup', up],
    [view, 'pointercancel', cancel], [root, 'keydown', keyDown], [view, 'keyup', keyUp],
    [view, 'blur', reset], [root, 'scroll', reset],
  ]
  for (const [node, name, fn] of listeners) node.addEventListener(name, fn, { capture: true, passive: true })
  return () => {
    reset()
    for (const [node, name, fn] of listeners) node.removeEventListener(name, fn, { capture: true })
  }
}

