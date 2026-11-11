export function tokenNeedsRefresh(token, now = Date.now(), bufferMs = 5 * 60 * 1000) {
  if (!token) return false
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload))
    return !Number.isFinite(exp) || now >= exp * 1000 - bufferMs
  } catch { return true }
}
