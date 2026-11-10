// Native and WebView events can arrive together or in either order. Keep one
// foreground transition, without remounting screens or replaying writes.
export function installAppLifecycle({ app, view, focus, onResume, now = Date.now }) {
  const doc = view.document, handles = []
  let disposed = false, active = doc.visibilityState !== 'hidden', revision = 0
  let suspendedAt = active ? null : now()
  focus(active)
  const transition = next => {
    if (disposed) return
    revision++
    if (next && doc.visibilityState === 'hidden') return
    if (next === active) return
    active = next
    if (!next) suspendedAt = now()
    else {
      const since = suspendedAt
      suspendedAt = null
      // Start recovery before Query's stale-data refresh; never block input.
      try { Promise.resolve(onResume(since)).catch(() => {}) } catch { /* Keep input usable. */ }
    }
    focus(next)
  }
  const visible = () => transition(doc.visibilityState !== 'hidden')
  doc.addEventListener('visibilitychange', visible)
  view.addEventListener('pageshow', visible)
  const register = async (event, handler) => {
    try {
      const handle = await app.addListener(event, handler)
      if (disposed) await handle.remove()
      else handles.push(handle)
    } catch { /* WebView visibility remains a fallback. */ }
  }
  void register('appStateChange', ({ isActive }) => transition(isActive))
  void register('pause', () => transition(false))
  void register('resume', () => transition(true))
  const initialRevision = revision
  void Promise.resolve().then(() => app.getState()).then(({ isActive }) => {
    if (!disposed && revision === initialRevision) transition(isActive)
  }).catch(() => {})
  return () => {
    disposed = true
    doc.removeEventListener('visibilitychange', visible)
    view.removeEventListener('pageshow', visible)
    handles.forEach(handle => { void Promise.resolve().then(() => handle.remove()).catch(() => {}) })
    focus(undefined)
  }
}
