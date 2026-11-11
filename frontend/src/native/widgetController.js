export function widgetDestination(raw) {
  try {
    const url = new URL(raw)
    if (!['newaveflow:', 'newaveflowverification:'].includes(url.protocol) || url.hostname !== 'widget' || url.pathname !== '/open') return null
    const path = url.searchParams.get('path') || '/profile/widgets'
    if (path === '/') return '/'
    if (/^\/(tts|attendance|minutes|meeting\/(prayer|sat)|event-attendance(?:\/\d+)?|profile\/widgets)$/.test(path)) return path
    if (/^\/calendar(?:\?date=\d{4}-\d{2}-\d{2})?$/.test(path)) return path
  } catch { /* Unrecognized links never navigate. */ }
  return null
}

// Serialize configuration/clear, discard late results after account changes,
// and coalesce app writes. Native credentials never go into browser storage.
export function createWidgetController({ getSession, connect, native, onWidgetCheck = () => {}, now = Date.now }) {
  let scope, generation = 0, queue = Promise.resolve(), setupJob, refreshJob, lastCheck, stopped = false
  let state = { connected: false, busy: false, error: '' }
  const listeners = new Set()
  const serial = operation => { queue = queue.catch(() => {}).then(operation); return queue }
  const publish = next => { state = { ...state, ...next }; listeners.forEach(fn => fn()) }
  const receive = result => {
    if (result.lastCheckAt && result.lastCheckAt !== lastCheck) { lastCheck = result.lastCheckAt; onWidgetCheck() }
    publish({ connected: result.connected === true, error: result.error || '', busy: false })
  }
  const sessionChanged = (force = false) => {
    const session = getSession()
    if (session === undefined || stopped) return Promise.resolve()
    const next = session?.scope ?? null
    if (scope === next && !force) return setupJob?.promise ?? queue
    scope = next; const epoch = ++generation; lastCheck = undefined
    publish({ connected: false, busy: !!session, error: '' })
    const job = { epoch }
    job.promise = (async () => {
      if (epoch !== generation || stopped) return
      const current = await serial(async () => {
        if (epoch !== generation || stopped) return {}
        const current = await native.getState()
        if (epoch === generation && !stopped && (!session || current.scope !== session.scope)) await native.clear()
        return current
      })
      if (epoch !== generation || stopped) return
      if (!session || epoch !== generation || stopped) return
      // Keep a usable same-account widget offline and across ordinary app launches.
      if (!force && current.connected && current.scope === session.scope && Date.parse(current.expiresAt) > now() + 86_400_000) {
        receive(current); return
      }
      const config = await connect(session)
      if (epoch !== generation || stopped) return
      await serial(async () => {
        if (epoch !== generation || stopped) return
        const result = await native.configure({ session: JSON.stringify({ ...config, scope: session.scope }) })
        if (epoch === generation && !stopped) receive(result)
      })
    })().catch(() => { if (epoch === generation && !stopped) publish({ busy: false, error: '위젯을 연결하지 못했어요. 다시 시도해주세요.' }) })
    setupJob = job
    return job.promise
  }
  const refresh = () => {
    const epoch = generation
    if (refreshJob?.epoch === epoch) return refreshJob.promise
    const job = { epoch }
    job.promise = (async () => {
      await setupJob?.promise
      if (stopped || !scope || epoch !== generation) return
      const initial = await native.getState()
      if (stopped || epoch !== generation) return
      receive(initial)
      if (!initial.connected) { await sessionChanged(true); return }
      const result = await native.refresh()
      if (!stopped && epoch === generation) {
        receive(result)
        if (!result.connected) await sessionChanged(true)
      }
    })().catch(() => { if (!stopped && epoch === generation) publish({ error: '앱을 열어 최신 기록을 확인해주세요.', busy: false }) })
      .finally(() => { if (refreshJob === job) refreshJob = null })
    refreshJob = job
    return job.promise
  }
  return {
    getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) },
    sessionChanged, refresh,
    reconnect: () => sessionChanged(true),
    start: () => { stopped = false; scope = undefined; return sessionChanged() },
    stop: () => { stopped = true; generation++ },
  }
}
