// Called only after the user confirms that their work is saved.
export function applyAppUpdate(registration, serviceWorker, reload, timeoutMs = 15000) {
  if (!registration) return Promise.reject(new Error('업데이트 준비 중입니다.'))
  const waiting = registration.waiting
  if (!waiting) {
    if (registration.installing) return Promise.reject(new Error('새 버전을 준비 중입니다.'))
    // Another tab may already have activated this update.
    reload()
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      serviceWorker.removeEventListener('controllerchange', changed)
    }
    const changed = () => {
      cleanup()
      reload()
      resolve()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('업데이트가 지연되고 있습니다. 다시 시도해 주세요.'))
    }, timeoutMs)
    serviceWorker.addEventListener('controllerchange', changed)
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' })
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}
