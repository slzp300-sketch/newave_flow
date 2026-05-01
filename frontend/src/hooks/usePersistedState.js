import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * useState와 동일하게 사용하되, 뒤로가기 시 상태를 복원한다.
 * sessionStorage에 pathname + key로 저장되며, 탭/브라우저 종료 시 초기화된다.
 */
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
