import { registerPlugin } from '@capacitor/core'
import { nativePlatform } from './platform'
import { createAuthViewport } from './authViewportFlow'

const flow = createAuthViewport({ platform: nativePlatform, native: registerPlugin('NewaveAuthViewport'), document })
export const prepareExternalAuthViewport = flow.prepare
export const restorePendingAuthViewport = flow.resume
export const finishExternalAuthViewport = flow.finish
