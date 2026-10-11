import { queryReadState } from '../../utils/queryReadState'

export default function QueryNotice({ queries, label = '기록' }) {
  const state = queryReadState(queries)
  if (state === 'ready') return null
  const retrying = queries.some(q => q.isFetching)
  return (
    <div role={state === 'error' ? 'alert' : 'status'} className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
      <p className="text-sm font-semibold text-gray-700">
        {state === 'error' ? `${label}을 불러오지 못했습니다.` : `${label}을 불러오는 중입니다.`}
      </p>
      {state === 'error' && <>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <button type="button" disabled={retrying} onClick={() => queries.forEach(q => { void q.refetch() })}
          className="mt-4 rounded-xl bg-primary-50 px-4 py-2 text-sm font-bold text-primary-700 disabled:opacity-50">
          {retrying ? '다시 불러오는 중...' : '다시 시도'}
        </button>
      </>}
    </div>
  )
}
