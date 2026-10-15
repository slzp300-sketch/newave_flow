import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminUsersApi } from '../api/adminUsers'
import QueryNotice from './common/QueryNotice'
import QueryRefreshNotice from './common/QueryRefreshNotice'
import { hasQueryData } from '../utils/queryReadState'

const labels = { SUSPEND: '이용 정지', RESTORE: '이용 정지 해제', LEGACY_SUSPEND: '이전 정지 기록 확인' }
export const statusTime = value => value ? value.replace('T', ' ').slice(0, 16) : '시각 확인 필요'

export default function AccountStatusHistory({ userId }) {
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: ['user-status-history', userId],
    queryFn: () => adminUsersApi.getStatusHistory(userId).then(r => r.data),
    enabled: open,
  })
  return <div>
    <button type="button" className="min-h-11 text-sm font-semibold text-primary-700" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      {open ? '정지·복구 이력 접기' : '정지·복구 이력 보기'}
    </button>
    {open && (!hasQueryData([query]) ? <QueryNotice queries={[query]} label="계정 조치 이력" /> : <div className="space-y-3 border-t border-gray-100 pt-3">
      <QueryRefreshNotice queries={[query]} label="계정 조치 이력" />
      {!query.data.length && <p className="text-xs text-gray-500">기록된 이용 정지·복구 이력이 없습니다.</p>}
      {query.data.map(event => <div key={event.id} className="rounded-xl bg-gray-50 p-3 text-xs">
        <p className="font-bold text-gray-800">{labels[event.action] || '계정 조치'} · {statusTime(event.createdAt)}</p>
        <p className="mt-1 text-gray-500">처리자: {event.actorName}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-gray-700">{event.reason}</p>
      </div>)}
      {query.data.length === 100 && <p className="text-xs text-gray-500">최근 100건을 표시합니다.</p>}
    </div>)}
  </div>
}
