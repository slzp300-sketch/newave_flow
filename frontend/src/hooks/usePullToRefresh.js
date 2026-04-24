import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export default function usePullToRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let startY = 0
    let pulling = false

    const handleTouchStart = (e) => {
      // 스크롤이 최상단일 때만 Pull-to-Refresh 트리거 가능
      if (window.scrollY === 0) {
        startY = e.touches[0].pageY
        pulling = true
      } else {
        pulling = false
      }
    }

    const handleTouchMove = (e) => {
      if (!pulling) return
      
      const currentY = e.touches[0].pageY
      const diff = currentY - startY

      // 아래로 70px 이상 당겼을 때 새로고침 준비 (시각적 피드백은 브라우저 기본 UI에 의존하거나 CSS로 추가 가능)
      if (diff > 70 && !isRefreshing) {
        // 실제 새로고침 동작은 touch-action: pan-down 이 설정된 모바일 브라우저에서 기본적으로 동작함
        // 하지만 특정 환경에서 수동으로 트리거하고 싶을 경우 아래 로직 사용
      }
    }

    const handleTouchEnd = async (e) => {
      if (!pulling) return
      
      const endY = e.changedTouches[0].pageY
      const diff = endY - startY

      if (diff > 80 && window.scrollY === 0) {
        setIsRefreshing(true)
        try {
          // React Query의 모든 활성 쿼리를 새로고침
          await queryClient.refetchQueries()
          // 필요한 경우 햅틱 피드백이나 진동 추가 가능
          if (window.navigator.vibrate) {
            window.navigator.vibrate(10)
          }
        } finally {
          setIsRefreshing(false)
        }
      }
      pulling = false
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [queryClient, isRefreshing])

  return isRefreshing
}
