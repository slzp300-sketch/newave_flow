import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import SafetySummary from '../components/common/SafetySummary'
import useAuthStore from '../store/authStore'
import { safetyApi } from '../api/safety'
import { REPORT_REASONS, REPORT_STATUS, REPORT_ACTIONS, PROTECTION_ACTIONS } from '../utils/communitySafety'

const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base'
export default function ContentReportsAdminPage() {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('OPEN')
  const { apiEnvironment, user } = useAuthStore()
  const qc = useQueryClient()
  const queueKey = ['content-report-queue', apiEnvironment, user?.id]
  const queue = useQuery({ queryKey: [...queueKey, status, page], queryFn: () => safetyApi.queue(page, status) })
  const refresh = () => { qc.invalidateQueries({ queryKey: queueKey }); qc.invalidateQueries({ queryKey: ['my-content-reports'] }); qc.invalidateQueries({ queryKey: ['safety-summary'] }); qc.invalidateQueries({ queryKey: ['photo-review-queue'] }); qc.invalidateQueries({ queryKey: ['meeting-minutes'] }) }
  return <div className="pb-8"><Header title="신고 관리" showBack showNotification={false} />
    <div className="space-y-5 px-4 py-5">
      <SafetySummary />
      <p className="text-sm leading-6 text-gray-600">신고 내용을 검토한 뒤 필요한 조치를 하고 결과를 남겨주세요. 신고자를 보호하고 업무에 필요한 범위로만 확인합니다.</p>
      <label className="block text-sm font-semibold">처리 상태
        <select aria-label="처리 상태 필터" className={fieldClass} value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>
          <option value="">전체</option>{Object.entries(REPORT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      {queue.isPending && <p role="status">불러오는 중…</p>}
      {queue.isError && <p role="alert" className="text-sm text-red-700">신고 목록을 불러오지 못했습니다. <button className="min-h-11 underline" onClick={() => queue.refetch()}>다시 시도</button></p>}
      {queue.data?.content.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500">이 상태의 신고가 없습니다.</p>}
      {queue.data?.content.map(report => <ReviewCard key={`${report.id}-${report.revision}`} report={report} onSaved={refresh} scope={[apiEnvironment, user?.id]} />)}
      {queue.data && queue.data.totalPages > 1 && <div className="flex items-center justify-between text-sm">
        <button className="min-h-11 px-3 disabled:opacity-30" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {queue.data.totalPages}</span>
        <button className="min-h-11 px-3 disabled:opacity-30" disabled={queue.data.last} onClick={() => setPage(page + 1)}>다음</button></div>}
    </div></div>
}
function ReviewCard({ report, onSaved, scope }) {
  const [status, setStatus] = useState('REVIEWING')
  const [action, setAction] = useState('NONE')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [urgent, setUrgent] = useState(report.urgent)
  const [opened, setOpened] = useState(false)
  const target = useQuery({ queryKey: ['report-target', ...scope, report.id, report.revision], queryFn: () => safetyApi.target(report.id), enabled: opened, gcTime: 0, staleTime: 0 })
  const assign = useMutation({ mutationFn: () => safetyApi.assign(report.id, { expectedRevision: report.revision, urgent }), onSuccess: onSaved })
  const save = useMutation({ mutationFn: payload => safetyApi.resolve(report.id, payload), onSuccess: onSaved })
  const protection = PROTECTION_ACTIONS[report.contentType]
  const actions = [...(report.contentType === 'OTHER' ? ['REVIEWED'] : []), ...(protection ? [protection] : []), ...(report.targetType === 'USER' && protection !== 'SUSPEND_USER' ? ['SUSPEND_USER'] : [])]
  const changesAccess = action !== 'NONE' && action !== 'REVIEWED'
  const actionExplanation = { HIDE_MINUTE: '회의록이 일반 교사에게 보이지 않게 됩니다.', HIDE_REPORT_NOTES: '공동 보고의 메모만 숨깁니다. 출석 수와 제출 기록은 유지합니다.', HIDE_PHOTO: '현재 사진을 숨기고 검토 대기 중인 사진도 취소합니다.', REDACT_EVENT: '일정 제목·설명을 숨깁니다. 일정 날짜와 출석은 유지합니다.', SUSPEND_USER: '사용자의 로그인을 차단하고 기존 세션을 종료합니다.' }[action]
  return <article className="rounded-2xl border border-gray-200 bg-white p-4">
    <p className="text-xs font-semibold text-primary-700">{REPORT_STATUS[report.status]} · {REPORT_REASONS[report.reason]}</p>
    <h2 className="mt-2 break-words text-lg font-semibold">{report.subject}</h2>
    <p className="mt-2 text-xs text-gray-500">신고자: {report.reporterName} · 접수 {report.createdAt?.replace('T', ' ').slice(0, 16)}</p>
    <p className="mt-2 text-xs text-gray-600">담당: {report.assignedToName || '미지정'} · 목표 {report.dueAt?.replace('T', ' ').slice(0, 16)}</p>
    {(report.urgent || report.overdue) && <p className="mt-2 text-sm font-semibold text-red-700">{[report.urgent && '긴급 확인', report.overdue && '처리 목표시간 경과'].filter(Boolean).join(' · ')}</p>}
    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{report.details}</p>
    <button type="button" className="mt-3 min-h-11 rounded-xl border px-3 text-sm" onClick={() => setOpened(!opened)}>{opened ? '대상 닫기' : '현재 신고 대상 확인'}</button>
    {opened && <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
      {target.isPending && <p role="status">대상을 불러오는 중…</p>}
      {target.isError && <p role="alert" className="text-red-700">대상을 불러오지 못했습니다. <button className="min-h-11 underline" onClick={() => target.refetch()}>다시 시도</button></p>}
      {target.data && !target.isError && (target.data.available ? <><p className="font-semibold">{target.data.title}</p><p className="mt-2 whitespace-pre-wrap break-words">{target.data.text}</p>{target.data.image && <img src={target.data.image} alt="현재 신고 대상 사진" className="mt-3 max-h-64 w-full rounded-xl object-contain" />}</> : <p>직접 표시할 수 없는 대상입니다. 신고 내용의 위치를 확인하거나 이미 삭제·숨김 처리됐는지 확인해 주세요.</p>)}
    </div>}
    {!report.resolvedAt && <div className="mt-4 rounded-xl border border-gray-200 p-3">
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="h-5 w-5" />긴급 확인</label>
      <button type="button" disabled={assign.isPending} onClick={() => assign.mutate()} className="min-h-11 text-sm font-semibold text-primary-700">{assign.isPending ? '저장 중…' : '내가 담당하고 우선순위 저장'}</button>
      <p className="text-xs leading-5 text-gray-500">일반 신고는 접수 후 24시간, 긴급 신고는 4시간 안에 우선 확인하는 내부 목표입니다. 긴급 표시를 해제해도 기존 목표시간은 늘어나지 않습니다.</p>
      {assign.isError && <p role="alert" className="mt-2 text-sm text-red-700">{assign.error.response?.data?.message || '담당 정보를 저장하지 못했습니다.'}</p>}
    </div>}
    {report.resolvedAt ? <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm">{REPORT_ACTIONS[report.action]}: {report.resolutionNote}</p> : <form className="mt-5 space-y-4 border-t border-gray-100 pt-4" onSubmit={e => {
      e.preventDefault(); save.mutate({ status, action: status === 'RESOLVED' ? action : 'NONE', note: note.trim(), expectedRevision: report.revision })
    }}>
      {report.resolutionNote && <p className="text-sm text-gray-600">이전 검토: {report.resolutionNote}</p>}
      <label className="block text-sm font-semibold">검토 결과
        <select aria-label="검토 결과" className={fieldClass} value={status} onChange={e => { setStatus(e.target.value); setAction(e.target.value === 'RESOLVED' ? actions[0] : 'NONE'); setConfirmed(false) }}>
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
        <span>{actionExplanation} 이 조치를 적용하겠습니다.</span>
      </label>}
      {save.isError && <p role="alert" className="text-sm text-red-700">{save.error.response?.data?.message || '처리 결과를 저장하지 못했습니다.'} <button type="button" onClick={onSaved} className="min-h-11 underline">최신 상태 불러오기</button></p>}
      <button disabled={save.isPending || !note.trim() || (status === 'RESOLVED' && changesAccess && !confirmed)}
        className="min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-40">{save.isPending ? '저장 중…' : '검토 결과 저장'}</button>
    </form>}
  </article>
}
