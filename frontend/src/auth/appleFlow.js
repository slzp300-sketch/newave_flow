import { validAppleSubject } from './authIdentity.js'

const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const validOpaque = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value)
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

// A native Apple sheet doesn't leave this app. Keep its single-use proof in memory, never localStorage.
// If the app restarts, start a fresh authorization instead of recovering provider credentials.
export function createAppleFlow({ api, native, platform, cryptoProvider = globalThis.crypto, now = Date.now }) {
  let busy = false
  let pending = null
  return {
    async begin(mode = 'LOGIN', currentPassword) {
      if (platform !== 'ios') throw new Error('Apple 로그인은 iPhone 앱에서 이용할 수 있습니다.')
      if (busy) throw new Error('진행 중인 Apple 인증을 먼저 완료해 주세요.')
      if (!['LOGIN', 'LINK', 'DELETE'].includes(mode)) throw new Error('Apple 인증 요청을 확인하지 못했습니다.')
      busy = true
      pending = null
      try {
        const verifier = encode(cryptoProvider.getRandomValues(new Uint8Array(32)))
        const digest = await cryptoProvider.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
        const { data: start } = await api.start(mode, { challenge: encode(new Uint8Array(digest)), platform: 'ios', ...(mode === 'LINK' ? { currentPassword } : {}) })
        if (typeof start.flowId !== 'string' || !start.flowId || !validOpaque(start.nonce) || !validOpaque(start.state)) {
          throw new Error('Apple 인증 요청을 확인하지 못했습니다.')
        }
        const credential = await native.signIn({ nonce: start.nonce, state: start.state })
        if (credential.state !== start.state || !credential.identityToken || !credential.authorizationCode) {
          throw new Error('Apple 인증 응답을 확인하지 못했습니다. 다시 시도해 주세요.')
        }
        const { data } = await api.complete({
          flowId: start.flowId, state: start.state, verifier,
          identityToken: credential.identityToken, authorizationCode: credential.authorizationCode,
        })
        if (data.status === 'REGISTRATION_REQUIRED' && mode === 'LOGIN' && typeof data.ticket === 'string' && data.ticket) {
          if (!validEmail(data.email)) throw new Error('Apple 이메일을 확인하지 못했습니다. Apple 로그인을 다시 시작해 주세요.')
          const name = [credential.familyName, credential.givenName]
            .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()).join(' ').slice(0, 100)
          pending = { flowId: start.flowId, ticket: data.ticket, verifier, expiresAt: now() + 5 * 60 * 1000,
            profile: { email: data.email, emailPrivate: data.emailPrivate === true, name } }
        } else if (data.status === 'REAUTHENTICATED' && mode === 'DELETE'
          && data.flowId === start.flowId && typeof data.ticket === 'string' && data.ticket) {
          // This proof is returned only to the requesting deletion form and is never persisted.
          return { appleFlowId: start.flowId, appleTicket: data.ticket, appleVerifier: verifier }
        } else if (!((data.status === 'SIGNED_IN' && mode === 'LOGIN' && data.session && validAppleSubject(data.appleSubject)) || (data.status === 'LINKED' && mode === 'LINK'))) {
          throw new Error(data.message || 'Apple 인증을 완료하지 못했습니다.')
        }
        return data
      } finally { busy = false }
    },
    readPending() {
      if (pending?.expiresAt > now()) return true
      pending = null
      return false
    },
    readRegistration() {
      if (pending?.expiresAt > now()) return { ...pending.profile }
      pending = null
      return null
    },
    clearPending() { pending = null },
    async register(form) {
      if (!pending || pending.expiresAt <= now()) {
        pending = null
        throw new Error('Apple 인증 시간이 지났어요. 로그인 화면에서 다시 시작해 주세요.')
      }
      if (busy) throw new Error('가입 신청을 처리하고 있습니다.')
      busy = true
      try {
        // The server keeps the verified Apple email. Never accept a replacement email or password here.
        await api.register({ name: form.name, phone: form.phone || '', flowId: pending.flowId, ticket: pending.ticket, verifier: pending.verifier })
        pending = null
      } finally { busy = false }
    },
  }
}
