import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { ttsAdminReadState } from '../../utils/ttsAdminReadState'

const subscribe = listener => onlineManager.subscribe(listener)
const snapshot = () => onlineManager.isOnline()
export function useAdminStatsReadState(query) {
  const online = useSyncExternalStore(subscribe, snapshot, snapshot)
  return ttsAdminReadState(query, online)
}

export default function AdminStatsNotice({ query, state, label }) {
  if (state === 'ready') return null
  const offline = state === 'offline'
  const failed = state === 'error'
  return <section role={failed ? 'alert' : 'status'} aria-live="polite"
    className="rounded-2xl border border-gray-200 bg-white p-4 text-left">
    <p className="text-base font-bold text-gray-900">{offline ? '인터넷 연결 대기 중' : failed ? label + ' 조회에 실패했습니다.' : '최신 ' + label + ' 확인 중'}</p>
    <p className="mt-2 text-sm leading-relaxed text-gray-600">{offline
      ? '연결 후 자동 갱신 · 조회 조건 유지'
      : failed ? '조회 조건 유지 · 다시 시도하세요.'
      : '최신 통계 조회 중 · 조회 조건 유지'}</p>
    {failed && <button type="button" disabled={query.isFetching} onClick={() => { void query.refetch() }}
      className="mt-3 min-h-11 rounded-xl bg-primary-50 px-4 py-2 font-semibold text-primary-700 disabled:opacity-50">다시 시도</button>}
  </section>
}
