import { useEffect, useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import AppUpdateNotice from './AppUpdateNotice'
import { applyAppUpdate } from '../../utils/appUpdate'

export default function AppUpdate() {
  const [registration, setRegistration] = useState(null)
  const [needRefresh, setNeedRefresh] = useState(false)
  const saving = useIsMutating()

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let disposed = false
    let registration
    let worker
    let controller = navigator.serviceWorker.controller
    const inspect = () => {
      if (registration?.waiting) setNeedRefresh(true)
    }
    const trackWorker = () => {
      worker?.removeEventListener('statechange', inspect)
      worker = registration.installing
      worker?.addEventListener('statechange', inspect)
      inspect()
    }
    const changed = () => {
      // An update accepted in another tab must not discard this tab's draft.
      if (controller) setNeedRefresh(true)
      controller = navigator.serviceWorker.controller
    }
    navigator.serviceWorker.addEventListener('controllerchange', changed)
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(value => {
      if (disposed) return
      registration = value
      setRegistration(value)
      value.addEventListener('updatefound', trackWorker)
      trackWorker()
    }).catch(() => {})
    return () => {
      disposed = true
      registration?.removeEventListener('updatefound', trackWorker)
      worker?.removeEventListener('statechange', inspect)
      navigator.serviceWorker.removeEventListener('controllerchange', changed)
    }
  }, [])

  useEffect(() => {
    if (!registration) return
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !registration.installing) {
        void registration.update().catch(() => {})
      }
    }
    check()
    const timer = setInterval(check, 60 * 1000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
    }
  }, [registration])

  return <AppUpdateNotice needRefresh={needRefresh} saving={saving} onUpdate={() => applyAppUpdate(registration, navigator.serviceWorker, () => window.location.reload())} />
}
