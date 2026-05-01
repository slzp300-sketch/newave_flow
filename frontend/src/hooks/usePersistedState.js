import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// window는 페이지 로드마다 초기화되므로, 앱 재시작을 확실하게 감지할 수 있다.
// SPA 내 페이지 이동 시에는 window가 유지되므로 상태가 보존된다.
if (!window.__newaveStateInitialized) {
  window.__newaveStateInitialized = true
  Object.keys(sessionStorage)
    .filter(k => k.startsWith('ui_state:'))
    .forEach(k => sessionStorage.removeItem(k))
}

export function usePersistedState(key, defaultValue) {
  const { pathname } = useLocation()
  const storageKey = `ui_state:${pathname}:${key}`

  const [state, setState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      return saved !== null ? JSON.parse(saved) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state))
    } catch {}
  }, [state, storageKey])

  return [state, setState]
}
