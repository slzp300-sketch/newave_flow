// Only reads still pending from before suspension can restart. Preserve the
// caller's promise, cancellation and auth scope. Never track writes.
export function createReadRecovery({ now = Date.now, staleAfter = 15_000 } = {}) {
  const pending = new Map()
  let serial = 0
  return {
    begin(config) {
      if (!['get', 'head'].includes((config.method || 'get').toLowerCase())) return
      const caller = config.signal, controller = new AbortController()
      const abort = () => controller.abort(caller?.reason)
      caller?.addEventListener('abort', abort, { once: true })
      if (caller?.aborted) abort()
      const id = ++serial
      pending.set(id, { config, caller, controller, abort, startedAt: now(), interrupted: false })
      config._resumeReadId = id
      config.signal = controller.signal
    },
    finish(config) {
      const read = pending.get(config?._resumeReadId)
      if (!read) return false
      pending.delete(config._resumeReadId)
      delete config._resumeReadId
      read.caller?.removeEventListener('abort', read.abort)
      config.signal = read.caller
      return read.interrupted && !read.caller?.aborted
    },
    resume(suspendedAt) {
      if (suspendedAt == null) return
      for (const read of pending.values()) {
        if (read.startedAt > suspendedAt || now() - read.startedAt < staleAfter
            || read.config._resumeRetry || read.controller.signal.aborted) continue
        read.interrupted = true
        read.controller.abort()
      }
    },
  }
}
