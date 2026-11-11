import { useEffect, useRef, useState } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { CapacitorHttp } from '@capacitor/core'
import { useIsMutating } from '@tanstack/react-query'
import { nativePlatform } from './platform'
import { startStoreUpdateMonitor } from './storeUpdate'
import StoreUpdateNotice from '../components/common/StoreUpdateNotice'

export default function NativeStoreUpdate() {
  const [offer, setOffer] = useState(null)
  const monitor = useRef(null)
  const saving = useIsMutating() > 0
  useEffect(() => {
    if (nativePlatform !== 'ios') return
    let storage
    try { storage = window.localStorage } catch { /* Private storage can be unavailable. */ }
    const current = startStoreUpdateMonitor({ platform: nativePlatform, app: NativeApp, http: CapacitorHttp,
      storage, events: window, userAgent: navigator.userAgent,
      isOnline: () => navigator.onLine !== false, onChange: setOffer })
    monitor.current = current
    return () => { current.stop(); monitor.current = null }
  }, [])
  return <StoreUpdateNotice offer={offer} saving={saving} onLater={() => monitor.current?.dismiss()} />
}
