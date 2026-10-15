import { Browser } from '@capacitor/browser'
import { isNativeApp, nativePlatform, secureAuthStorage } from '../native/platform'
import { authApi } from '../api/auth'
import { parseKakaoCallback, validatePending } from './kakaoFlow'

const KEY = 'newave-kakao-pending'
const inFlight = new Map()
const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function writePending(value) {
  if (isNativeApp) { await secureAuthStorage.setItem(KEY, JSON.stringify(value)); await secureAuthStorage.flush() }
  else sessionStorage.setItem(KEY, JSON.stringify(value))
}
export async function clearKakaoPending() {
  if (isNativeApp) { await secureAuthStorage.removeItem(KEY); await secureAuthStorage.flush() }
  else sessionStorage.removeItem(KEY)
}
export async function readKakaoPending() {
  const raw = isNativeApp ? await secureAuthStorage.getItem(KEY) : sessionStorage.getItem(KEY)
  try { const value = JSON.parse(raw); if (value?.expiresAt > Date.now()) return value } catch { /* Invalid/expired handoff. */ }
  await clearKakaoPending()
  return null
}

export async function beginKakao(mode = 'LOGIN', currentPassword) {
  const verifier = encode(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const { data } = await authApi.startKakao(mode, { challenge: encode(new Uint8Array(digest)), platform: nativePlatform, currentPassword })
  const authorization = new URL(data.authorizationUrl)
  if (authorization.origin !== 'https://kauth.kakao.com' || authorization.pathname !== '/oauth/authorize') throw new Error('카카오 로그인 주소를 확인하지 못했습니다.')
  await writePending({ flowId: data.flowId, verifier, mode, expiresAt: Date.now() + 10 * 60 * 1000 })
  if (isNativeApp) await Browser.open({ url: authorization.href })
  else window.location.assign(authorization.href)
}

export function completeKakao(hash) {
  if (inFlight.has(hash)) return inFlight.get(hash)
  const promise = (async () => {
    const callback = parseKakaoCallback(hash)
    if (!callback) throw new Error('카카오 인증을 완료하지 못했습니다. 로그인 화면에서 다시 시도해 주세요.')
    const pending = validatePending(await readKakaoPending(), callback)
    const { data } = await authApi.completeKakao({ ...callback, verifier: pending.verifier })
    if (data.status === 'REGISTRATION_REQUIRED') await writePending({ ...pending, registrationTicket: data.ticket })
    else await clearKakaoPending()
    if (isNativeApp) { try { await Browser.close() } catch { /* Android browser closes on handoff. */ } }
    return data
  })().finally(() => inFlight.delete(hash))
  inFlight.set(hash, promise)
  return promise
}

export async function registerWithKakao(form) {
  const pending = await readKakaoPending()
  if (!pending?.registrationTicket) throw new Error('카카오 인증 시간이 지났어요. 다시 시작해 주세요.')
  await authApi.registerKakao({ ...form, flowId: pending.flowId, ticket: pending.registrationTicket, verifier: pending.verifier })
  await clearKakaoPending()
}
