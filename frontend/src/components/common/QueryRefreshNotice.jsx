import QueryNotice from './QueryNotice'

// Reserve one line so background reads do not move the form or its scroll position.
export default function QueryRefreshNotice({ queries, label = '기록' }) {
  const failed = queries.some(q => q.isError)
  const paused = queries.some(q => q.fetchStatus === 'paused')
  return <div aria-live="polite">
    <p role="status" className="min-h-5 text-xs text-gray-500">
      {failed ? '' : paused ? '연결이 복구되면 다시 확인합니다. 입력 내용은 유지됩니다.' :
        queries.some(q => q.isFetching) ? `${label} 확인 중… 입력 내용은 유지됩니다.` : ''}
    </p>
    {failed && <QueryNotice queries={queries} label={label} />}
  </div>
}
