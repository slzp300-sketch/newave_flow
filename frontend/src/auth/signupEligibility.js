export const signupEligibilityMessage = '만 14세 이상 교사·사역 담당자만 가입할 수 있습니다. 학생·보호자 계정은 제공하지 않습니다.'

export function requireSignupEligibility(confirmed) {
  if (confirmed !== true) throw new Error('가입 대상 안내를 읽고 본인에게 해당하는지 먼저 확인해 주세요.')
}

export function signupPayload(form, confirmed) {
  requireSignupEligibility(confirmed)
  return { ...form, eligibilityConfirmed: true }
}
