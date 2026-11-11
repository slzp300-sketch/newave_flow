import { useInfiniteQuery } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { attendanceApi } from '../api/attendance'
import useAuthStore from '../store/authStore'
import { checkLabels } from '../utils/gradeCare'
import { formatDate } from '../utils/date'
import { hasQueryData, queryReadState } from '../utils/queryReadState'
import Badge from './common/Badge'
import Button from './common/Button'
import Card from './common/Card'
import ListItemMotion from './common/ListItemMotion'
import QueryNotice from './common/QueryNotice'
import QueryRefreshNotice from './common/QueryRefreshNotice'

export default function StudentAttendanceHistory({ studentId }) {
  const userId = useAuthStore(s => s.user?.id)
  const query = useInfiniteQuery({
    queryKey: ['student-history', studentId, userId, 'pages'],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) => attendanceApi.getHistoryPage(studentId, pageParam, signal).then(r => r.data),
    getNextPageParam: page => page.hasMore ? page.nextBefore : undefined,
    refetchOnWindowFocus: false,
  })
  const available = hasQueryData([query])
  const rows = available ? query.data.pages.flatMap(page => page.items) : []
  const more = () => { void query.fetchNextPage({ cancelRefetch: false }) }
  return <section className="flex flex-col gap-3" aria-label="출석 이력">
    <div className="flex justify-between items-end">
      <h3 className="text-xs font-bold text-gray-400 px-1">출석 이력</h3>
      <span className="text-xs font-bold text-gray-400">최근 순</span>
    </div>
    {!query.isFetchNextPageError && !query.isFetchingNextPage && <QueryRefreshNotice queries={[query]} label="출석 이력"/>}
    {!available ? <QueryNotice queries={[query]} label="출석 이력"/> : <>
      {rows.length === 0 && queryReadState([query]) === 'ready' && <Card className="py-10 text-center text-gray-400 text-sm">출석 기록이 없습니다</Card>}
      <div className="flex flex-col gap-2">
        {rows.map((record, index) => <ListItemMotion key={record.attendanceDate} index={index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="flex flex-wrap gap-2 items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${record.status === 'PRESENT' ? 'bg-secondary-500' : record.status === 'LATE' ? 'bg-amber-400' : 'bg-red-400'}`} />
              <time dateTime={record.attendanceDate} className="text-sm font-semibold text-gray-700">{formatDate(record.attendanceDate)}</time>
            </div>
            <div className="flex items-center gap-3">
              {record.note && <MessageSquare size={14} className="text-gray-300" />}
              <Badge variant={record.status === 'PRESENT' ? 'success' : record.status === 'LATE' ? 'warning' : 'danger'}>{checkLabels[record.status] || '미기록'}</Badge>
            </div>
          </Card>
        </ListItemMotion>)}
      </div>
      {query.isFetchNextPageError ? <QueryNotice queries={[{ ...query, refetch: more }]} label="이전 출석 기록"/> : query.hasNextPage &&
        <Button variant="secondary" disabled={query.isFetching || query.fetchStatus === 'paused'} onClick={more}>{query.isFetchingNextPage ? '불러오는 중…' : '이전 기록 20개 더 보기'}</Button>}
      {rows.length > 0 && <p role="status" className="text-center text-xs text-gray-500">{rows.length}개 표시{!query.hasNextPage && !query.isError && !query.isFetching ? ' · 마지막 기록입니다' : ''}</p>}
    </>}
  </section>
}
