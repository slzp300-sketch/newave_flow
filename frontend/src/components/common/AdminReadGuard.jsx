import QueryNotice from './QueryNotice'
import { hasQueryData } from '../../utils/queryReadState'

// Keep the last successful result visible during refresh; never treat failed reads as zero rows.
export default function AdminReadGuard({ queries, label, children }) {
  if (!hasQueryData(queries)) return <QueryNotice queries={queries} label={label} />
  const failed = queries.some(query => query.isError)
  const paused = queries.some(query => query.fetchStatus === 'paused')
  return <>
    <div aria-live="polite">
      <p className="min-h-5 text-xs text-gray-500">{failed ? '최근 확인한 자료를 표시합니다.' : paused ? '연결이 복구되면 최신 자료를 확인합니다.' : queries.some(query => query.isFetching) ? '최신 자료 확인 중…' : ''}</p>
      {failed && <QueryNotice queries={queries} label={label} />}
    </div>
    {children}
  </>
}
