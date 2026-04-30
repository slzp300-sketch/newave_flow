import { useRef, useCallback, useState } from 'react'
import { addMonths, subMonths } from 'date-fns'

/**
 * useSwipeMonth
 * Attaches touch/mouse swipe handlers to a calendar container.
 *
 * Returns:
 *   swipeHandlers - spread onto the drag target element
 *   direction     - 'left' | 'right' | null  (last triggered direction, used for AnimatePresence)
 *
 * @param {Date}     current    - current displayed month
 * @param {Function} setCurrent - setter for current month
 * @param {number}   threshold  - px required to trigger a month change (default 55)
 */
export default function useSwipeMonth(current, setCurrent, threshold = 55) {
  const startX = useRef(null)
  const startY = useRef(null)
  const isDragging = useRef(false)
  const [direction, setDirection] = useState(null)

  const onStart = useCallback((clientX, clientY) => {
    startX.current = clientX
    startY.current = clientY
    isDragging.current = true
  }, [])

  const onEnd = useCallback((clientX, clientY) => {
    if (!isDragging.current || startX.current === null) return
    isDragging.current = false

    const dx = clientX - startX.current
    const dy = Math.abs(clientY - startY.current)

    // Ignore if vertical scroll is dominant
    if (dy > Math.abs(dx)) {
      startX.current = null
      startY.current = null
      return
    }

    if (dx < -threshold) {
      setDirection('left')
      setCurrent(prev => addMonths(prev, 1))
    } else if (dx > threshold) {
      setDirection('right')
      setCurrent(prev => subMonths(prev, 1))
    }

    startX.current = null
    startY.current = null
  }, [threshold, setCurrent])

  const swipeHandlers = {
    onTouchStart: (e) => onStart(e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd:   (e) => onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
    onMouseDown:  (e) => { e.preventDefault(); onStart(e.clientX, e.clientY) },
    onMouseUp:    (e) => onEnd(e.clientX, e.clientY),
    onMouseLeave: (e) => { if (isDragging.current) onEnd(e.clientX, e.clientY) },
  }

  return { swipeHandlers, direction }
}

