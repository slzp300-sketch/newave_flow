import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import useAuthStore from '../store/authStore'
import { safetyApi } from '../api/safety'
import { REPORT_REASONS, REPORT_STATUS, REPORT_ACTIONS } from '../utils/communitySafety'

const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base'
export default function ContentReportsAdminPage() {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('OPEN')
  const { apiEnvironment, user } = useAuthStore()
  const qc = useQueryClient()
  const queueKey = ['content-report-queue', apiEnvironment, user?.id]
  const queue = useQuery({ queryKey: [...queueKey, status, page], queryFn: () => safetyApi.queue(page, status) })
  const refresh = () => { qc.invalidateQueries({ queryKey: queueKey }); qc.invalidateQueries({ queryKey: ['my-content-reports'] }) }
  return <div className="pb-8"><Header title="신고 관리" showBack showNotification={false} />
    <div className="space-y-5 px-4 py-5">
      <p className="text-sm leading-6 text-gray-600">신고 내용을 검토한 뒤 필요한 조치를 하고 결과를 남겨주세요. 신고자를 보호하고 업무에 필요한 범위로만 확인합니다.</p>
      <label className="block text-sm font-semibold">처리 상태
        <select aria-label="처리 상태 필터" className={fieldClass} value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>
          <option value="">전체</option>{Object.entries(REPORT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      {queue.isPending && <p role="status">불러오는 중…</p>}
      {queue.isError && <p role="alert" className="text-sm text-red-700">신고 목록을 불러오지 못했습니다. <button className="min-h-11 underline" onClick={() => queue.refetch()}>다시 시도</button></p>}
      {queue.data?.content.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500">이 상태의 신고가 없습니다.</p>}
      {queue.data?.content.map(report => <ReviewCard key={`${report.id}-${report.revision}`} report={report} onSaved={refresh} />)}
      {queue.data && queue.data.totalPages > 1 && <div className="flex items-center justify-between text-sm">
        <button className="min-h-11 px-3 disabled:opacity-30" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {queue.data.totalPages}</span>
        <button className="min-h-11 px-3 disabled:opacity-30" disabled={queue.data.last} onClick={() => setPage(page + 1)}>다음</button></div>}
    </div></div>
}
function ReviewCard({ report, onSaved }) {
  const [status, setStatus] = useState('REVIEWING')
  const [action, setAction] = useState('NONE')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const save = useMutation({ mutationFn: payload => safetyApi.resolve(report.id, payload), onSuccess: onSaved })
  const actions = ['REVIEWED', ...(report.contentType === 'MEETING_MINUTE' ? ['HIDE_MINUTE'] : []), ...(report.targetType === 'USER' ? ['SUSPEND_USER'] : [])]
  const changesAccess = ['HIDE_MINUTE', 'SUSPEND_USER'].includes(action)
  return <article className="rounded-2xl border border-gray-200 bg-white p-4">
    <p className="text-xs font-semibold text-primary-700">{REPORT_STATUS[report.status]} · {REPORT_REASONS[report.reason]}</p>
    <h2 className="mt-2 break-words text-lg font-semibold">{report.subject}</h2>
    <p className="mt-2 text-xs text-gray-500">신고자: {report.reporterName} · 접수 {report.createdAt?.replace('T', ' ').slice(0, 16)}</p>
    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{report.details}</p>
    {report.resolvedAt ? <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm">{REPORT_ACTIONS[report.action]}: {report.resolutionNote}</p> : <form className="mt-5 space-y-4 border-t border-gray-100 pt-4" onSubmit={e => {
      e.preventDefault(); save.mutate({ status, action: status === 'RESOLVED' ? action : 'NONE', note: note.trim(), expectedRevision: report.revision })
    }}>
      {report.resolutionNote && <p className="text-sm text-gray-600">이전 검토: {report.resolutionNote}</p>}
      <label className="block text-sm font-semibold">검토 결과
        <select aria-label="검토 결과" className={fieldClass} value={status} onChange={e => { setStatus(e.target.value); setAction(e.target.value === 'RESOLVED' ? 'REVIEWED' : 'NONE'); setConfirmed(false) }}>
          <option value="REVIEWING">검토 중</option><option value="RESOLVED">조치 완료</option><option value="DISMISSED">위반 없음</option>
        </select></label>
      {status === 'RESOLVED' && <label className="block text-sm font-semibold">조치
        <select aria-label="조치" className={fieldClass} value={action} onChange={e => { setAction(e.target.value); setConfirmed(false) }}>
          {actions.map(value => <option key={value} value={value}>{REPORT_ACTIONS[value]}</option>)}
        </select></label>}
      <label className="block text-sm font-semibold">처리 안내
        <textarea aria-label="처리 안내" required maxLength={2000} rows={3} className={fieldClass} value={note} onChange={e => setNote(e.target.value)} placeholder="확인 결과와 실제로 취한 조치를 적어주세요. 신고자에게 표시됩니다." />
      </label>
      {changesAccess && status === 'RESOLVED' && <label className="flex min-h-11 items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm leading-6">
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
        <span>{action === 'HIDE_MINUTE' ? '저장하면 해당 회의록이 일반 교사에게 보이지 않게 됩니다.' : '저장하면 해당 사용자의 로그인이 차단되고 기존 세션이 종료됩니다.'} 이 조치를 적용하겠습니다.</span>
      </label>}
      {save.isError && <p role="alert" className="text-sm text-red-700">{save.error.response?.data?.message || '처리 결과를 저장하지 못했습니다.'}</p>}
      <button disabled={save.isPending || !note.trim() || (status === 'RESOLVED' && changesAccess && !confirmed)}
        className="min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-40">{save.isPending ? '저장 중…' : '검토 결과 저장'}</button>
    </form>}
  </article>
}
