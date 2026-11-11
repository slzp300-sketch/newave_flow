import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { officersApi } from '../api/officers'
export default function useOfficerAccess() {
  const user = useAuthStore(s => s.user)
  return useQuery({ queryKey: ['officer-access', user?.id, user?.role], queryFn: officersApi.me, enabled: !!user,
    staleTime: 15000, refetchInterval: 30000, refetchOnWindowFocus: 'always' })
}
