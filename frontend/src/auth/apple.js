import { registerPlugin } from '@capacitor/core'
import { nativePlatform } from '../native/platform'
import { appleApi } from '../api/apple'
import { createAppleFlow } from './appleFlow'

export const appleNative = registerPlugin('NewaveAppleSignIn')
const flow = createAppleFlow({ api: appleApi, native: appleNative, platform: nativePlatform })
export const beginApple = (mode, password) => flow.begin(mode, password)
export const readApplePending = () => flow.readPending()
export const clearApplePending = () => flow.clearPending()
export const registerWithApple = form => flow.register(form)
export const isAppleCancellation = error => error?.code === 'APPLE_CANCELLED'

export async function appleAvailability() {
  if (nativePlatform !== 'ios') return false
  const [{ data }, native] = await Promise.all([appleApi.config(), appleNative.getAvailability()])
  return data.enabled === true && native.available === true
}
