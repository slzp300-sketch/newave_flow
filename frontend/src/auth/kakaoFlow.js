// Browser handoff tickets are bound to a secret kept on the initiating device.
export function parseKakaoCallback(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const flowId = params.get('flow')
  const ticket = params.get('ticket')
  if (Array.from(params.keys()).length !== 2 || Array.from(params.keys()).some(key => !['flow', 'ticket'].includes(key))
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(flowId || '') || !/^[A-Za-z0-9_-]{43}$/.test(ticket || '')) return null
  return { flowId, ticket }
}

export function nativeKakaoDestination(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'newaveflow:' || url.hostname !== 'auth' || url.pathname !== '/kakao' || url.search || url.username || url.password || url.port) return null
    if (!parseKakaoCallback(url.hash)) return null
    return `/auth/kakao/callback${url.hash}`
  } catch { return null }
}

export function validatePending(pending, callback, now = Date.now()) {
  if (!pending || pending.flowId !== callback?.flowId || !Number.isFinite(pending.expiresAt) || pending.expiresAt <= now
    || !/^[A-Za-z0-9_-]{43}$/.test(pending.verifier || '')) throw new Error('인증 시간이 지났거나 다른 기기에서 시작한 인증입니다. 카카오 로그인을 다시 시도해 주세요.')
  return pending
}
