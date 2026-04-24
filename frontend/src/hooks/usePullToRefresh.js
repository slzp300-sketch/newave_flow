import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export default function usePullToRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let startY = 0
    let pulling = false

    const handleStart = (pageY) => {
      // iOS에서 window.scrollY가 0일 때의 정밀도 보정
      if (window.scrollY <= 0) {
        startY = pageY
        pulling = true
      }
    }

    const handleMove = (e, pageY) => {
      if (!pulling) return
      const diff = pageY - startY
      
      // 최상단에서 아래로 당길 때만 기본 스크롤 동작 방지 (iOS 바운스 방지)
      if (diff > 0 && window.scrollY <= 0) {
        if (e.cancelable) e.preventDefault()
      }
    }

    const handleEnd = async (pageY) => {
      if (!pulling) return
      const diff = pageY - startY

      // 모바일 감도 조절 (80px로 하향 조정)
      if (diff > 80 && window.scrollY <= 0) {
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

    const onTouchStart = (e) => handleStart(e.touches[0].pageY)
    const onTouchMove = (e) => handleMove(e, e.touches[0].pageY)
    const onTouchEnd = (e) => handleEnd(e.changedTouches[0].pageY)

    const onMouseDown = (e) => handleStart(e.pageY)
    const onMouseMove = (e) => handleMove(e, e.pageY)
    const onMouseUp = (e) => handleEnd(e.pageY)

    // iOS에서 preventDefault를 사용하기 위해 passive: false 설정
    window.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [queryClient])

  return isRefreshing
}
