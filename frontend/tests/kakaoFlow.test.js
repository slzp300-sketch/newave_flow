import test from 'node:test'
import assert from 'node:assert/strict'
import { parseKakaoCallback, nativeKakaoDestination, validatePending } from '../src/auth/kakaoFlow.js'

const id = '12345678-1234-1234-1234-123456789abc'
const ticket = 't'.repeat(43)
const hash = `#flow=${id}&ticket=${ticket}`

test('native handoff accepts only the exact app callback and never treats tokens as routes', () => {
  assert.equal(nativeKakaoDestination(`newaveflow://auth/kakao${hash}`), `/auth/kakao/callback${hash}`)
  for (const url of [`https://auth/kakao${hash}`, `newaveflow://other/kakao${hash}`, `newaveflow://auth/other${hash}`,
    `newaveflow://auth/kakao?redirect=https://example.invalid${hash}`, `newaveflow://auth/kakao${hash}&accessToken=secret`,
    `newaveflow://evil@auth/kakao${hash}`, `newaveflow://auth:123/kakao${hash}`, 'newaveflow://auth/kakao#accessToken=secret', 'invalid']) {
    assert.equal(nativeKakaoDestination(url), null)
  }
})
test('tickets need the initiating device verifier and an unexpired, matching flow', () => {
  const callback = parseKakaoCallback(hash)
  const pending = { flowId: id, verifier: 'v'.repeat(43), expiresAt: 2000 }
  assert.equal(validatePending(pending, callback, 1000), pending)
  for (const invalid of [null, {...pending, flowId: 'other'}, {...pending, expiresAt: 1000}, {...pending, expiresAt: undefined}, {...pending, verifier: ''}]) {
    assert.throws(() => validatePending(invalid, callback, 1000))
  }
  assert.equal(parseKakaoCallback('#flow=invalid&ticket=invalid'), null)
  assert.equal(parseKakaoCallback(`${hash}&ticket=${ticket}`), null)
})
