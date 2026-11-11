import { PushNotifications } from '@capacitor/push-notifications'
import { isNativeApp, nativePlatform } from './platform'
import { createPushController } from './pushController'
import useAuthStore from '../store/authStore'
import client from '../api/client'
import { notificationApi } from '../api/notifications'
import { queryClient } from '../queryClient'

let controller = null, destination = () => {}, installation = null
// Enable only for a native build whose APNs/FCM configuration has been prepared.
const nativePushReady = import.meta.env.VITE_NATIVE_PUSH_ENABLED === 'true'
const pushPlatform = nativePlatform === 'ios' ? 'IOS' : 'ANDROID'
const preferenceConfig = session => ({ ...session.config, params: { platform: pushPlatform } })
const currentSession = () => {
  const state = useAuthStore.getState()
  if (!state.isHydrated || !state.user || !state.accessToken) return null
  const apiEnvironment = state.apiEnvironment || 'production'
  return { scope: `${apiEnvironment}:${state.user.id}:${state.authIdentity?.sessionId || ''}`, config: {
    _sessionScope: `${apiEnvironment}:${state.user.id}`, apiEnvironment,
    expectedAuthSessionId: state.authIdentity?.sessionId,
  } }
}
const installationId = () => {
  if (installation) return installation
  const existing = localStorage.getItem('newave-push-installation')
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing || '')) return (installation = existing)
  installation = crypto.randomUUID()
  localStorage.setItem('newave-push-installation', installation)
  return installation
}
const refreshNotifications = () => {
  void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  void queryClient.invalidateQueries({ queryKey: ['unread-notifications'] })
}
export function getPushController() {
  if (!isNativeApp || !nativePushReady) return null
  if (!controller) controller = createPushController({
    plugin: PushNotifications, getSession: currentSession, installationId,
    platform: pushPlatform,
    navigate: path => destination(path), refreshNotifications,
    api: {
      preferences: s => notificationApi.getPreferences(preferenceConfig(s)).then(r => ({ ...r.data, available: nativePushReady && r.data.available === true })),
      setPreferences: (s, data) => notificationApi.setPreferences(data, preferenceConfig(s)).then(r => r.data),
      registerDevice: (s, id, data) => notificationApi.registerDevice(id, data, s.config),
      deleteDevice: (s, id) => notificationApi.deleteDevice(id, s.config),
      list: s => client.get('/notifications', s.config).then(r => r.data),
      markRead: (s, id) => client.patch(`/notifications/${id}/read`, undefined, s.config),
    },
  })
  return controller
}
export function startPushNotifications(router) {
  const runtime = getPushController()
  if (!runtime) return () => {}
  destination = path => void router.navigate(path)
  const unsubscribe = useAuthStore.subscribe(() => runtime.sessionChanged())
  runtime.sessionChanged()
  void runtime.start().catch(() => {})
  return () => { unsubscribe(); runtime.stop() }
}
export const refreshPushNotifications = () => getPushController()?.refresh()
export const detachPushNotifications = config => {
  const current = currentSession()
  if (config?.expectedAuthSessionId && config.expectedAuthSessionId !== current?.config.expectedAuthSessionId) return
  return getPushController()?.detach()
}
