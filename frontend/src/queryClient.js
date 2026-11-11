import { QueryClient } from '@tanstack/react-query'
import { retryQuery } from './api/queryRetry'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: retryQuery },
  },
})
