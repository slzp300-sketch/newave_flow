import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { newFamilyApi } from '../api/newFamily'
import useAuthStore from '../store/authStore'
export default function NewFamilyEntry() {
  const id = useAuthStore(s => s.user?.id)
  const access = useQuery({ queryKey: ['new-family-capability', id], queryFn: newFamilyApi.capability, staleTime: 30000 })
  return access.data?.canManage ? <Link className="brand-action flex min-h-12 items-center justify-between rounded-xl px-3 font-semibold" to="/new-family">새가족팀 관리 <span className="text-sm font-normal">첫 방문·출결·과정·반 배정 →</span></Link> : null
}
