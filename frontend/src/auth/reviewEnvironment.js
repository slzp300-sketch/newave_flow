export function loginEnvironment(email) {
  return email?.trim().toLowerCase().endsWith('@review.newaveflow.invalid') ? 'review' : 'production'
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
