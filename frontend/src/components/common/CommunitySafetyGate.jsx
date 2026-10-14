import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { safetyApi } from '../../api/safety'
import useAuthStore from '../../store/authStore'
import CommunityPolicyPage, { agreementKey } from '../../pages/CommunityPolicyPage'

export default function CommunitySafetyGate({ children }) {
  const { user, apiEnvironment } = useAuthStore()
  const { pathname } = useLocation()
  const agreement = useQuery({ queryKey: agreementKey(user, apiEnvironment), queryFn: safetyApi.agreement })
  if (pathname.startsWith('/safety/')) return children
  if (agreement.isPending) return <p role="status" className="px-5 py-12 text-center text-gray-500">이용수칙 확인 중…</p>
  if (agreement.isError || !agreement.data?.accepted) return <CommunityPolicyPage required />
  return children
}
