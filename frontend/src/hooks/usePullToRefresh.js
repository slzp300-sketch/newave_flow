import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export default function usePullToRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const queryClient = useQueryClient()

  useEffect(() => {
    let startY = 0
    let pulling = false

    const handleStart = (pageY) => {
      if (window.scrollY <= 0) {
        startY = pageY
        pulling = true
      }
    }

    const handleMove = (e, pageY) => {
      if (!pulling) return
      const diff = pageY - startY
      
      if (diff > 0 && window.scrollY <= 0) {
        if (e.cancelable) e.preventDefault()
        // 최대 150px까지만 저항감을 주며 당겨지도록 계산
        const resistance = 0.5
        const distance = Math.min(diff * resistance, 150)
        setPullDistance(distance)
      }
    }

    const handleEnd = async (pageY) => {
      if (!pulling) return
      const diff = pageY - startY
      const resistance = 0.5
      const distance = diff * resistance

      if (distance > 70 && window.scrollY <= 0) {
        setIsRefreshing(true)
        setPullDistance(70) // 로딩 중 위치 고정
        try {
          await queryClient.refetchQueries()
          if (window.navigator.vibrate) {
            window.navigator.vibrate(10)
          }
        } finally {
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
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

  return { isRefreshing, pullDistance }
}
