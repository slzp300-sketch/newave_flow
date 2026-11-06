import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { installPullToRefresh } from '../utils/pullToRefresh'

export default function usePullToRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const queryClient = useQueryClient()

  useEffect(() => installPullToRefresh({
    view: window,
    refresh: () => queryClient.refetchQueries({ type: 'active' }),
    onDistance: setPullDistance,
    onRefreshing: setIsRefreshing,
  }), [queryClient])

  return { isRefreshing, pullDistance }
}
