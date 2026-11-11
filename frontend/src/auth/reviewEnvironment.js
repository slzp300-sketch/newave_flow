export function loginEnvironment(email) {
  return email?.trim().toLowerCase().endsWith('@review.newaveflow.invalid') ? 'review' : 'production'
}

// The account namespace validates the explicit choice; it must not silently choose a server.
export function selectedLoginEnvironment(email, selected = 'production') {
  if (!['production', 'review'].includes(selected)) throw new Error('로그인할 계정 종류를 선택해 주세요.')
  if (loginEnvironment(email) !== selected) {
    throw new Error(selected === 'production'
      ? '가상 자료 계정입니다. ‘가상 자료 계정 이용’ 메뉴에서 계정을 선택한 뒤 로그인해 주세요.'
      : '일반 계정입니다. ‘일반 로그인으로 돌아가기’를 눌러 주세요. 가상 자료에는 제공된 검수 계정으로 로그인할 수 있습니다.')
  }
  return selected
}

export function validatedReviewApiUrl(value, development = false) {
  const url = new URL(value)
  const railway = url.protocol === 'https:' && url.hostname.endsWith('.up.railway.app') && !url.port
  const local = development && url.protocol === 'http:' && url.hostname === 'localhost' && url.port === '8081'
  if ((!railway && !local) || url.username || url.password || url.search || url.hash || url.pathname !== '/api') {
    throw new Error('심사 서버 주소가 올바르지 않습니다.')
  }
  return url.href.replace(/\/+$/, '')
}
