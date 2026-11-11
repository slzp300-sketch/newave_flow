import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './platform'
import useAuthStore from '../store/authStore'
import client from '../api/client'
import { queryClient } from '../queryClient'
import { createWidgetController } from './widgetController'

export const widgetNative = registerPlugin('NewaveWidgets')
const session = () => {
  const s = useAuthStore.getState()
  if (!s.isHydrated) return undefined
  if (!s.user || !s.accessToken) return null
  return { scope: `${s.apiEnvironment}:${s.user.id}:${s.user.role}:${s.authIdentity?.sessionId || ''}`,
    config: { apiEnvironment: s.apiEnvironment, _sessionScope: `${s.apiEnvironment}:${s.user.id}`,
      expectedAuthSessionId: s.authIdentity?.sessionId } }
}
export const widgetController = createWidgetController({ getSession: session, native: widgetNative,
  connect: async s => {
    const response = await client.post('/widgets/session', {}, s.config)
    return { ...response.data, baseURL: response.config.baseURL }
  },
  onWidgetCheck: () => {
    for (const key of ['tts-week','tts-stats','tts-week-stats','tts-quarterly-scores','widget-preview']) void queryClient.invalidateQueries({ queryKey: [key] })
  },
})
export function startWidgets() {
  if (!isNativeApp) return () => {}
  let timer
  const auth = useAuthStore.subscribe(() => { void widgetController.sessionChanged() })
  const mutations = queryClient.getMutationCache().subscribe(event => {
    if (event.type !== 'updated' || event.action?.type !== 'success') return
    clearTimeout(timer)
    timer = setTimeout(() => { void widgetController.refresh() }, 600)
  })
  void widgetController.start().then(() => widgetController.refresh())
  return () => { auth(); mutations(); clearTimeout(timer); widgetController.stop() }
}
export const refreshWidgets = () => isNativeApp ? widgetController.refresh() : Promise.resolve()
