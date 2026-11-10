import { useEffect, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { restorePendingAuthViewport, finishExternalAuthViewport } from './authViewport'
import { App as NativeApp } from '@capacitor/app'
import { focusManager } from '@tanstack/react-query'
import { isNativeApp, nativePlatform, flushAuthStorage } from './platform'
import { nativeBackDestination } from './backNavigation'
import { queryClient } from '../queryClient'
import { nativeKakaoDestination } from '../auth/kakaoFlow'
import { appleNative } from '../auth/apple'
import { startAppleSessionMonitor } from '../auth/appleSessionMonitor'
import { authApi } from '../api/auth'
import useAuthStore from '../store/authStore'
import { startPushNotifications, refreshPushNotifications } from './pushNotifications'
import { installAppLifecycle } from './appLifecycle'
import { readRecovery, refreshSession } from '../api/client'
import { tokenNeedsRefresh } from '../auth/tokenExpiry'
import { startWidgets, refreshWidgets } from './widgets'
import { widgetDestination } from './widgetController'

export default function NativeRuntime({ router }) {
  const [storageError, setStorageError] = useState(false)
  const [appleNotice, setAppleNotice] = useState('')
  useEffect(() => startPushNotifications(router), [router])
  useEffect(() => startWidgets(), [])
  useEffect(() => {
    if (nativePlatform !== 'ios') return
    return startAppleSessionMonitor({ native: appleNative, app: NativeApp, store: useAuthStore,
      logout: authApi.logout, clearCache: () => queryClient.clear(), flush: flushAuthStorage,
      onSignedOut: ({ serverRevoked, storageCleared }) => {
        setAppleNotice(serverRevoked ? 'Apple 계정 연결이 해제되어 로그아웃했습니다. 다시 로그인해 주세요.' : 'Apple 계정 연결이 해제되어 이 기기에서 로그아웃했습니다. 서버에 연결하지 못해 다른 기기의 로그인 종료는 확인하지 못했습니다.')
        if (!storageCleared) setStorageError(true)
        void router.navigate('/login', { replace: true })
      },
    })
  }, [router])
  useEffect(() => {
    if (!isNativeApp) return
    let disposed = false
    const handles = []
    const register = async (event, handler) => {
      try {
        const handle = await NativeApp.addListener(event, handler)
        if (disposed) await handle.remove()
        else handles.push(handle)
      } catch {
        // Keep web navigation usable if the native lifecycle plugin is unavailable.
      }
    }
    const stopLifecycle = installAppLifecycle({ app: NativeApp, view: window,
      focus: active => focusManager.setFocused(active),
      onResume: since => {
        readRecovery.resume(since)
        if (tokenNeedsRefresh(useAuthStore.getState().accessToken)) void refreshSession().catch(() => {})
        void restorePendingAuthViewport().catch(() => {})
        void Promise.resolve(refreshPushNotifications()).catch(() => {})
        void refreshWidgets()
      },
    })
    if (nativePlatform === 'ios') void Browser.addListener('browserFinished', () => { void finishExternalAuthViewport(false) }).then(handle => { if (disposed) void handle.remove(); else handles.push(handle) }).catch(() => {})
    let pendingWidgetPath
    const openKakao = ({ url }) => {
      const path = nativeKakaoDestination(url)
      if (path) { void router.navigate(path); return }
      const widgetPath = widgetDestination(url)
      if (!widgetPath) return
      if (useAuthStore.getState().user) void router.navigate(widgetPath)
      else { pendingWidgetPath = widgetPath; void router.navigate('/login') }
    }
    const stopWidgetLink = useAuthStore.subscribe(state => {
      if (state.user && pendingWidgetPath) { const path = pendingWidgetPath; pendingWidgetPath = null; void router.navigate(path) }
    })
    void register('appUrlOpen', openKakao)
    void NativeApp.getLaunchUrl().then(value => { if (!disposed && value?.url) openKakao(value) }).catch(() => {})
    if (nativePlatform === 'android') void register('backButton', () => {
      if (queryClient.isMutating()) return
      const dialog = Array.from(document.querySelectorAll('dialog[open]')).at(-1)
      if (dialog) {
        if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close()
        return
      }
      const next = nativeBackDestination(router.state.location.pathname, window.history.state?.idx ?? 0, false)
      if (next.action === 'history') void router.navigate(-1)
      if (next.action === 'navigate') void router.navigate(next.path, { replace: true })
      if (next.action === 'minimize') void NativeApp.minimizeApp()
    })
    const failed = () => setStorageError(true)
    window.addEventListener('newave:storage-error', failed)
    return () => {
      disposed = true
      handles.forEach(handle => void handle.remove())
      stopLifecycle()
      stopWidgetLink()
      window.removeEventListener('newave:storage-error', failed)
    }
  }, [router])
  if (!storageError && !appleNotice) return null
  return <div role="alert" className="safe-notice-top fixed inset-x-3 z-[100] rounded-xl bg-amber-50 border border-amber-300 p-4 text-sm text-amber-950 shadow-lg">
    {storageError ? '로그인 정보를 휴대폰에 저장하지 못했습니다. 앱을 다시 시작하면 로그인이 필요할 수 있습니다.' : appleNotice}
    {appleNotice && !storageError && <button className="ml-3 min-h-11 px-2 font-semibold underline" onClick={() => setAppleNotice('')}>확인</button>}
  </div>
}
