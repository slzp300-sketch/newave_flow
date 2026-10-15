export const validAppleSubject = subject => typeof subject === 'string' && subject.length > 0
  && subject.length <= 255 && !/[\u0000-\u0020\u007f]/.test(subject)

export function validAuthIdentity(value) {
  return value?.provider === 'apple' && validAppleSubject(value.subject)
    && typeof value.sessionId === 'string' && /^[a-f0-9-]{36}$/.test(value.sessionId)
}

// Only call this with the subject returned by our server after validating Apple's signed tokens.
export function appleSessionIdentity(subject) {
  const identity = { provider: 'apple', subject, sessionId: crypto.randomUUID() }
  if (!validAuthIdentity(identity)) throw new Error('Apple 로그인 계정을 확인하지 못했습니다. 다시 시도해 주세요.')
  return identity
}
