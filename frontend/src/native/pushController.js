// No provider credentials or device tokens are persisted by the web layer.
export function safeNotificationPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return null
  try {
    const url = new URL(value, 'https://app.invalid')
    const allowed = /^\/(?:calendar|tts|attendance|minutes|evangelism|meeting\/sat|event-attendance(?:\/\d+)?)$/
    if (url.origin !== 'https://app.invalid' || !allowed.test(url.pathname) || url.hash) return null
    for (const [key, val] of url.searchParams) {
      if (!['date', 'week', 'eventId', 'minuteId'].includes(key) || !/^[\d-]+$/.test(val)) return null
    }
    return url.pathname + url.search
  } catch { return null }
}

export function createPushController({ plugin, api, getSession, installationId, platform,
  appVersion = '', navigate = () => {}, refreshNotifications = () => {}, registrationTimeout = 15000 }) {
  let state = { available: false, enabled: false, permission: 'prompt', busy: false, error: '' }
  let generation = 0, listenerGeneration = 0, sessionScope = null, pendingRegistration = null, pendingNotificationId = null
  let handles = [], starting = null, refreshPromise = null, nativeCleanup = Promise.resolve()
  const subscribers = new Set()
  const update = change => { state = { ...state, ...change }; subscribers.forEach(fn => fn()) }
  const current = (session, epoch) => !!session && getSession()?.scope === session.scope && generation === epoch
  const assertCurrent = (session, epoch) => { if (!current(session, epoch)) throw new Error('로그인 상태가 변경되었습니다.') }
  const cancelRegistration = () => {
    pendingRegistration?.reject(new Error('알림 등록이 취소되었습니다.'))
    pendingRegistration = null
  }
  const clearNative = () => {
    nativeCleanup = nativeCleanup.catch(() => {}).then(async () => {
      try { await plugin.unregister() } catch { /* Server deregistration is handled separately. */ }
      try { await plugin.removeAllDeliveredNotifications() } catch { /* The OS may already have cleared them. */ }
    })
    return nativeCleanup
  }
  const openNotification = async id => {
    const session = getSession(), epoch = generation
    if (!session) { pendingNotificationId = id; return }
    // Authenticate ownership again: never navigate using an untrusted push payload's URL.
    try {
      const rows = await api.list(session)
      if (!current(session, epoch)) return
      const row = rows.find(item => String(item.id) === id)
      if (!row) return
      if (!row.read) await api.markRead(session, row.id).catch(() => {})
      if (!current(session, epoch)) return
      refreshNotifications()
      navigate(safeNotificationPath(row.targetPath) || '/notifications')
    } catch { if (current(session, epoch)) update({ error: '알림을 열지 못했습니다. 알림 목록에서 다시 확인해 주세요.' }) }
  }
  const tokenReceived = ({ value }) => {
    if (typeof value !== 'string' || !value) return
    if (pendingRegistration) { pendingRegistration.resolve(value); return }
    const session = getSession(), epoch = generation
    if (!session || !state.available || !state.enabled) return
    void api.registerDevice(session, installationId(), { platform, token: value, appVersion })
      .catch(() => { if (current(session, epoch)) update({ error: '알림 연결을 갱신하지 못했습니다. 다시 시도해 주세요.' }) })
  }
  const ensureListeners = () => {
    if (starting) return starting
    const run = ++listenerGeneration
    const added = []
    starting = (async () => {
      const events = {
        registration: tokenReceived,
        registrationError: () => pendingRegistration?.reject(new Error('휴대폰 알림을 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')),
        pushNotificationReceived: () => { if (getSession()) refreshNotifications() },
        pushNotificationActionPerformed: event => {
          const id = String(event?.notification?.data?.notificationId ?? '')
          if (/^\d+$/.test(id)) void openNotification(id)
        },
      }
      for (const [name, handler] of Object.entries(events)) {
        const handle = await plugin.addListener(name, value => { if (run === listenerGeneration) handler(value) })
        if (run !== listenerGeneration) await handle.remove()
        else { handles.push(handle); added.push(handle) }
      }
    })().catch(async error => {
      if (run === listenerGeneration) starting = null
      handles = handles.filter(handle => !added.includes(handle))
      await Promise.allSettled(added.map(handle => handle.remove()))
      throw error
    })
    return starting
  }
  const register = async (session, epoch) => {
    await nativeCleanup
    await ensureListeners()
    assertCurrent(session, epoch)
    if (platform === 'ANDROID') await plugin.createChannel({ id: 'newave-reminders', name: '뉴웨이브 알림', importance: 3, visibility: 0 })
    assertCurrent(session, epoch)
    const token = await new Promise((resolve, reject) => {
      let settled = false
      const done = callback => value => {
        if (settled) return
        settled = true; clearTimeout(timer)
        if (pendingRegistration === request) pendingRegistration = null
        callback(value)
      }
      const request = { resolve: done(resolve), reject: done(reject) }
      const timer = setTimeout(() => request.reject(new Error('알림 연결 시간이 초과되었습니다. 다시 시도해 주세요.')), registrationTimeout)
      pendingRegistration = request
      Promise.resolve().then(() => plugin.register()).catch(request.reject)
    })
    assertCurrent(session, epoch)
    await api.registerDevice(session, installationId(), { platform, token, appVersion })
    assertCurrent(session, epoch)
  }
  const refresh = () => {
    if (refreshPromise || state.busy) return refreshPromise || Promise.resolve()
    const session = getSession(), epoch = generation
    if (!session) return Promise.resolve()
    const task = (async () => {
      try {
        const prefs = await api.preferences(session)
        assertCurrent(session, epoch)
        const permission = (await plugin.checkPermissions()).receive
        assertCurrent(session, epoch)
        update({ available: prefs.available === true, enabled: prefs.pushEnabled === true, permission, error: '' })
        if (prefs.available && prefs.pushEnabled && permission === 'granted') await register(session, epoch)
        else if (!prefs.available || !prefs.pushEnabled || permission === 'denied') {
          await api.deleteDevice(session, installationId()).catch(() => {})
          if (current(session, epoch)) await clearNative()
        }
        if (current(session, epoch) && pendingNotificationId) {
          const id = pendingNotificationId; pendingNotificationId = null; void openNotification(id)
        }
      } catch {
        if (current(session, epoch)) update({ error: '알림 설정을 확인하지 못했습니다. 다시 시도해 주세요.' })
      }
    })().finally(() => { if (refreshPromise === task) refreshPromise = null })
    refreshPromise = task
    return task
  }
  return {
    getSnapshot: () => state,
    subscribe: fn => { subscribers.add(fn); return () => subscribers.delete(fn) },
    start: async () => { await ensureListeners(); return refresh() },
    refresh,
    sessionChanged: () => {
      const next = getSession()?.scope ?? null
      if (next === sessionScope) return
      const previous = sessionScope
      sessionScope = next; generation++; cancelRegistration(); refreshPromise = null
      update({ available: false, enabled: false, busy: false, error: '' })
      if (previous) void clearNative()
      void refresh()
    },
    enable: async () => {
      const session = getSession()
      if (!session || state.busy) return
      const epoch = ++generation
      cancelRegistration(); update({ busy: true, error: '' })
      try {
        const prefs = await api.preferences(session)
        assertCurrent(session, epoch)
        if (!prefs.available) throw new Error('휴대폰 알림을 준비하고 있습니다.')
        let permission = (await plugin.checkPermissions()).receive
        assertCurrent(session, epoch)
        if (['prompt', 'prompt-with-rationale'].includes(permission)) permission = (await plugin.requestPermissions()).receive
        assertCurrent(session, epoch)
        update({ permission })
        if (permission !== 'granted') throw new Error('휴대폰 설정에서 뉴웨이브 플로우의 알림을 허용해 주세요.')
        await register(session, epoch)
        await api.setPreferences(session, { pushEnabled: true })
        assertCurrent(session, epoch)
        update({ enabled: true, available: true })
      } catch (error) {
        if (current(session, epoch)) {
          await api.deleteDevice(session, installationId()).catch(() => {})
          if (current(session, epoch)) await clearNative()
          if (current(session, epoch)) update({ enabled: false, error: error.message || '알림을 연결하지 못했습니다.' })
        }
      } finally { if (current(session, epoch)) update({ busy: false }) }
    },
    disable: async () => {
      const session = getSession()
      if (!session || state.busy) return
      const epoch = ++generation
      cancelRegistration(); update({ busy: true, error: '' })
      try {
        await api.setPreferences(session, { pushEnabled: false })
        assertCurrent(session, epoch)
        update({ enabled: false })
        await api.deleteDevice(session, installationId())
        assertCurrent(session, epoch)
        update({ enabled: false })
      } catch {
        if (current(session, epoch)) update({ error: '알림 설정을 저장하지 못했습니다. 다시 시도해 주세요.' })
      } finally {
        if (current(session, epoch)) { await clearNative(); if (current(session, epoch)) update({ busy: false }) }
      }
    },
    detach: async () => {
      const session = getSession(), epoch = ++generation
      cancelRegistration()
      try { if (session) await api.deleteDevice(session, installationId()) } catch { /* Logout must work offline too. */ }
      if (!session || current(session, epoch)) {
        await clearNative()
        if (generation === epoch) update({ enabled: false, busy: false })
      }
    },
    stop: () => {
      listenerGeneration++; generation++; cancelRegistration(); starting = null; refreshPromise = null
      update({ busy: false })
      handles.forEach(handle => void Promise.resolve(handle.remove()).catch(() => {})); handles = []
    },
  }
}
