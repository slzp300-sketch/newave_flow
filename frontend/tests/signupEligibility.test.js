import test from 'node:test'
import assert from 'node:assert/strict'
import { requireSignupEligibility, signupPayload } from '../src/auth/signupEligibility.js'

test('Signup payload requires the explicit confirmation state rather than an injected form value or truthy value', () => {
  const form = { name: '가상 담당자', eligibilityConfirmed: true }
  for (const confirmation of [undefined, null, false, 'true', 'false', 1, {}, []]) {
    assert.throws(() => signupPayload(form, confirmation), /가입 대상/)
  }
  assert.deepEqual(signupPayload(form, true), { name: '가상 담당자', eligibilityConfirmed: true })
})

test('Email and social signup keep their supplied fields and use the same confirmation without adding birth dates or identity documents', () => {
  const form = { name: '가상 담당자', email: 'synthetic@example.invalid', password: 'synthetic-only', phone: '', eligibilityConfirmed: false }
  assert.deepEqual(signupPayload(form, true), { ...form, eligibilityConfirmed: true })
  assert.equal(form.eligibilityConfirmed, false)
  assert.doesNotThrow(() => requireSignupEligibility(true))
})
