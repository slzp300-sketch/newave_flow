const DRAG_SLOP = 10
const REFRESH_DISTANCE = 70
const INTERACTIVE = 'button, a[href], input, textarea, select, label, summary, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [contenteditable="true"], [draggable="true"], dialog, [role="dialog"]'

// A tap belongs to its control. Only an intentional downward drag on the page
// may take over scrolling; interrupted gestures never survive an app handoff.
export function installPullToRefresh({ view, refresh, onDistance, onRefreshing }) {
  const doc = view.document
  let gesture = null, refreshing = false, disposed = false, ignoreMouseUntil = 0
  const now = () => view.performance.now()
  const visible = () => doc.visibilityState !== 'hidden'
  const distance = point => Math.min(Math.max(0, point.clientY - gesture.y - DRAG_SLOP) * 0.5, 150)
  const cancel = () => {
    gesture = null
    onDistance(0)
  }
  const interrupt = () => {
    cancel()
    // Keep the read in flight, but discard its gesture and visual offset.
    // Do not reload the page or discard any form drafts on app return.
    onRefreshing(false)
  }
  const canPull = target => {
    if (target?.closest?.(INTERACTIVE)) return false
    for (let node = target; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight && /auto|scroll|overlay/.test(view.getComputedStyle(node).overflowY)) return false
    }
    return true
  }
  const start = (event, point, type) => {
    if (gesture) cancel()
    if (!point || refreshing || !visible() || view.scrollY > 0 || !canPull(event.target)) return
    gesture = { x: point.clientX, y: point.clientY, type, id: point.identifier, active: false }
  }
  const move = (event, point, type) => {
    if (!gesture || gesture.type !== type) return
    if (!point || !visible() || view.scrollY > 0) { cancel(); return }
    const dx = Math.abs(point.clientX - gesture.x), dy = point.clientY - gesture.y
    if (!gesture.active) {
      if (Math.max(dx, Math.abs(dy)) <= DRAG_SLOP) return
      if (dy <= dx || dy <= DRAG_SLOP) { cancel(); return }
      gesture.active = true
    }
    if (dy <= 0 || !event.cancelable) { cancel(); return }
    event.preventDefault()
    onDistance(distance(point))
  }
  const finish = async (point, type) => {
    if (!gesture || gesture.type !== type) return
    const shouldRefresh = point && gesture.active && visible() && view.scrollY <= 0 && distance(point) > REFRESH_DISTANCE
    gesture = null
    if (!shouldRefresh) { onDistance(0); return }
    refreshing = true
    onRefreshing(true)
    onDistance(REFRESH_DISTANCE)
    try { await refresh() }
    catch { /* Query errors remain available on their respective screens. */ }
    finally {
      refreshing = false
      if (!disposed) { onRefreshing(false); onDistance(0) }
    }
  }
  const touchStart = event => {
    ignoreMouseUntil = now() + 700
    if (event.touches.length !== 1) { cancel(); return }
    start(event, event.touches[0], 'touch')
  }
  const touchMove = event => {
    if (event.touches.length !== 1) { cancel(); return }
    move(event, Array.from(event.touches).find(point => point.identifier === gesture?.id), 'touch')
  }
  const touchEnd = event => {
    ignoreMouseUntil = now() + 700
    void finish(Array.from(event.changedTouches).find(point => point.identifier === gesture?.id), 'touch')
  }
  const mouseStart = event => {
    if (event.button === 0 && now() >= ignoreMouseUntil && !event.sourceCapabilities?.firesTouchEvents) start(event, event, 'mouse')
  }
  const mouseMove = event => {
    if (gesture?.type === 'mouse' && event.buttons !== 1) { cancel(); return }
    move(event, event, 'mouse')
  }
  const mouseEnd = event => { void finish(event, 'mouse') }
  const listeners = [
    [view, 'touchstart', touchStart, true], [view, 'touchmove', touchMove, false],
    [view, 'touchend', touchEnd, true], [view, 'touchcancel', cancel, true],
    [view, 'mousedown', mouseStart, true], [view, 'mousemove', mouseMove, false], [view, 'mouseup', mouseEnd, true],
    [view, 'blur', interrupt, true], [view, 'pagehide', interrupt, true],
    [doc, 'visibilitychange', interrupt, true], [doc, 'pause', interrupt, true], [doc, 'resume', interrupt, true],
  ]
  for (const [target, event, handler, passive] of listeners) target.addEventListener(event, handler, { passive })
  return () => {
    disposed = true
    gesture = null
    for (const [target, event, handler] of listeners) target.removeEventListener(event, handler)
  }
}
