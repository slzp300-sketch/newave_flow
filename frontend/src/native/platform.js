import { Capacitor, registerPlugin } from '@capacitor/core'
import { createSecureStorage } from './secureStorage'

export const isNativeApp = Capacitor.isNativePlatform()
export const secureAuthStorage = isNativeApp
  ? createSecureStorage(registerPlugin('NewaveSecureStorage'), () => {
    window.dispatchEvent(new Event('newave:storage-error'))
  })
  : null

export async function flushAuthStorage() {
  await secureAuthStorage?.flush()
}
