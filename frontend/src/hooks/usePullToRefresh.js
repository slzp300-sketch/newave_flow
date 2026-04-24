import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export default function usePullToRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let startY = 0
    let pulling = false

    const handleStart = (pageY) => {
      if (window.scrollY === 0) {
        startY = pageY
        pulling = true
      }
    }

    const handleMove = (pageY) => {
      if (!pulling) return
      // 아래로 당기는 중일 때 추가적인 시각적 처리가 필요하면 여기에 작성
    }

    const handleEnd = async (pageY) => {
      if (!pulling) return
      const diff = pageY - startY

      // 100px 이상 당겼을 때 새로고침 트리거
      if (diff > 100 && window.scrollY === 0) {
        setIsRefreshing(true)
        try {
          await queryClient.refetchQueries()
          if (window.navigator.vibrate) {
            window.navigator.vibrate(10)
          }
        } finally {
          setIsRefreshing(false)
        }
      }
      pulling = false
    }

    // 터치 이벤트 핸들러
    const onTouchStart = (e) => handleStart(e.touches[0].pageY)
    const onTouchEnd = (e) => handleEnd(e.changedTouches[0].pageY)

    // 마우스 이벤트 핸들러 (PC 시뮬레이션용)
    const onMouseDown = (e) => handleStart(e.pageY)
    const onMouseMove = (e) => handleMove(e.pageY)
    const onMouseUp = (e) => handleEnd(e.pageY)

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [queryClient])

  return isRefreshing
}
