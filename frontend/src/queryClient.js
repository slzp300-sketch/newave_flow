import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      // 401은 client.js 인터셉터가 토큰 갱신 후 재요청하므로 여기서는 재시도 안 함
      // 그 외(서버 콜드스타트 직후 5xx, 네트워크 오류 등)는 최대 3회 재시도
      retry: (failureCount, error) => {
        if (error?.response?.status === 401) return false
        return failureCount < 3
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
})
