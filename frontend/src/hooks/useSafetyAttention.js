import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { safetyApi } from '../api/safety'

export default function useSafetyAttention() {
  const { user, apiEnvironment } = useAuthStore()
  const canManage = ['ADMIN', 'PASTOR', 'EXECUTIVE'].includes(user?.role)
  const query = useQuery({
    queryKey: ['safety-summary', apiEnvironment, user?.id],
    queryFn: safetyApi.summary, enabled: canManage,
    refetchInterval: 60000, refetchOnWindowFocus: 'always',
  })
  return { ...query, canManage }
}
