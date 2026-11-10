import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { installPullToRefresh } from '../utils/pullToRefresh'

export default function usePullToRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const queryClient = useQueryClient()

  useEffect(() => {
    let frame = 0, latest = 0
    const stop = installPullToRefresh({
      view: window,
      refresh: () => queryClient.refetchQueries({ type: 'active' }),
      onDistance: value => {
        latest = value
        // Touch events can outpace painting; update React at most once a frame.
        if (!value) { cancelAnimationFrame(frame); frame = 0; setPullDistance(0) }
        else if (!frame) frame = requestAnimationFrame(() => { frame = 0; setPullDistance(latest) })
      },
      onRefreshing: setIsRefreshing,
    })
    return () => { stop(); cancelAnimationFrame(frame) }
  }, [queryClient])

  return { isRefreshing, pullDistance }
}
