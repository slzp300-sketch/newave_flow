import { validAuthIdentity } from './authIdentity.js'

// All dependencies are injected so revocation races can be exercised without real Apple credentials.
export function startAppleSessionMonitor({ native, app, store, logout, clearCache, flush, onSignedOut = () => {} }) {
  let stopped = false, checking = false, recheck = false
  const handles = []
  const currentIdentity = () => {
    const state = store.getState()
    return !state.appleCheckPaused && state.user && state.accessToken && validAuthIdentity(state.authIdentity) ? state.authIdentity : null
  }
  const sameSession = identity => !stopped && currentIdentity()?.sessionId === identity.sessionId
  const check = async () => {
    if (stopped) return
    if (checking) { recheck = true; return }
    const identity = currentIdentity()
    if (!identity) return
    checking = true
    try {
      const result = await native.getCredentialState({ userId: identity.subject })
      if (!sameSession(identity) || !['revoked', 'notFound'].includes(result.state)) return
      let serverRevoked = true
      try { await logout({ expectedAuthSessionId: identity.sessionId }) }
      catch { serverRevoked = false }
      if (!sameSession(identity)) return
      try { clearCache() } catch { /* Session removal must still finish when cache cleanup fails. */ }
      store.getState().clearAuth()
      let storageCleared = true
      try { await flush() } catch { storageCleared = false }
      if (!stopped && !store.getState().accessToken) onSignedOut({ serverRevoked, storageCleared })
    } catch {
      // Network/provider errors are not proof of revocation. Keep the session and check on the next event.
    } finally {
      checking = false
      if (recheck && !stopped) { recheck = false; void check() }
    }
  }
  const register = async (source, event, callback) => {
    try {
      const handle = await source.addListener(event, callback)
      if (stopped) await handle.remove()
      else handles.push(handle)
    } catch { /* A startup check still works if lifecycle notifications are unavailable. */ }
  }
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.authIdentity?.sessionId !== previous.authIdentity?.sessionId || state.appleCheckPaused !== previous.appleCheckPaused) void check()
  })
  void register(native, 'credentialRevoked', () => void check())
  void register(app, 'appStateChange', ({ isActive }) => { if (isActive) void check() })
  void check()
  return () => {
    stopped = true
    unsubscribe()
    handles.forEach(handle => {
      try { void Promise.resolve(handle.remove()).catch(() => {}) } catch { /* The native bridge may already be closed. */ }
    })
  }
}
