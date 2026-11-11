import AppSelect from '../components/common/AppSelect'
import './SupportingReadability.css'
import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import useAuthStore from '../store/authStore'
import { safetyApi } from '../api/safety'
import { REPORT_REASONS, REPORT_STATUS, CONTENT_LABELS, reportTarget, reportSubmission } from '../utils/communitySafety'

const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base'
export default function ContentReportPage() {
  const location = useLocation()
  const { user, apiEnvironment } = useAuthStore()
  const qc = useQueryClient()
  const initial = reportTarget(location.search)
  const [target, setTarget] = useState(initial)
  const [subject, setSubject] = useState(location.state?.subject || '')
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [success, setSuccess] = useState(null)
  const [page, setPage] = useState(0)
  const submission = useRef(null)
  const people = useQuery({ queryKey: ['reportable-users', apiEnvironment, user?.id], queryFn: safetyApi.users })
  const historyKey = ['my-content-reports', apiEnvironment, user?.id]
  const history = useQuery({ queryKey: [...historyKey, page], queryFn: () => safetyApi.mine(page) })
  const send = useMutation({ mutationFn: safetyApi.report, onSuccess: report => {
    setSuccess(report); setDetails(''); submission.current = null; setPage(0); qc.invalidateQueries({ queryKey: historyKey })
  } })
  const submit = e => {
    e.preventDefault(); setSuccess(null)
    const payload = { ...target, subject: subject.trim(), reason, details: details.trim(), urgent }
    submission.current = reportSubmission(submission.current, payload, () => crypto.randomUUID())
    send.mutate({ ...payload, requestId: submission.current.id })
  }
  return <div className="supporting-readable readable-content pb-8">
    <Header title="콘텐츠·사용자 신고" showBack showNotification={false} />
    <div className="space-y-6 px-4 py-5">
      <div className="rounded-2xl bg-primary-50 p-4 text-sm leading-6 text-primary-900">본인·담당 관리자만 열람 · 비밀번호·인증번호 입력 금지</div>
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-semibold">신고 대상
          <AppSelect aria-label="신고 대상" className={fieldClass} value={target.targetType} onChange={e => {
            setTarget(e.target.value === 'USER' ? { targetType: 'USER', contentType: null, targetId: null } : { targetType: 'CONTENT', contentType: 'OTHER', targetId: null }); setSuccess(null)
          }}><option value="CONTENT">글·사진 등 콘텐츠</option><option value="USER">사용자</option></AppSelect>
        </label>
        {target.targetType === 'USER' ? <label className="block text-sm font-semibold">신고할 사용자
          <AppSelect aria-label="신고할 사용자" required className={fieldClass} value={target.targetId || ''} onChange={e => setTarget({ ...target, targetId: Number(e.target.value) || null })}>
            <option value="">사용자 선택</option>{people.data?.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}
          </AppSelect>
          {target.targetId && <span className="mt-2 block text-sm font-normal text-gray-600">선택: {people.data?.find(person => person.id === target.targetId)?.name}</span>}
          {people.isError && <span role="alert" className="block text-red-700">사용자를 불러오지 못했습니다. <button type="button" onClick={() => people.refetch()} className="min-h-11 underline">다시 시도</button></span>}
        </label> : target.contentType === 'OTHER' ? <label className="block text-sm font-semibold">문제가 있는 화면·콘텐츠
          <input aria-label="문제가 있는 화면·콘텐츠" required maxLength={200} className={fieldClass} value={subject} onChange={e => setSubject(e.target.value)} placeholder="예: 교적부의 프로필 사진, 출결보고 내용" />
        </label> : <div className="rounded-xl bg-gray-50 p-3 text-sm">선택한 {CONTENT_LABELS[target.contentType]} 신고
          <button type="button" className="ml-2 min-h-11 text-primary-700 underline" onClick={() => setTarget({ targetType: 'CONTENT', contentType: 'OTHER', targetId: null })}>대상 변경</button></div>}
        <label className="block text-sm font-semibold">신고 사유
          <AppSelect aria-label="신고 사유" required className={fieldClass} value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">사유 선택</option>{Object.entries(REPORT_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </AppSelect>
          {reason && <span className="mt-2 block text-sm font-normal text-gray-600">{REPORT_REASONS[reason]}</span>}
        </label>
        <label className="block text-sm font-semibold">상세 내용
          <textarea aria-label="상세 내용" required maxLength={2000} rows={5} className={fieldClass} value={details} onChange={e => setDetails(e.target.value)} placeholder="어떤 문제가 있는지, 관리자가 확인할 위치를 알려주세요." />
        </label>
        <label className="flex min-h-11 items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm leading-6"><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span>위협·개인정보 노출 등 긴급 상황은 담당자에게도 즉시 연락하세요.</span></label>
        {send.isError && <p role="alert" className="text-sm text-red-700">{send.error.response?.data?.message || '접수 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도할 수 있습니다.'}</p>}
        <button disabled={send.isPending || !details.trim() || !reason || (target.targetType === 'USER' && !target.targetId)}
          className="min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-40">{send.isPending ? '접수 중…' : '신고 접수하기'}</button>
        {success && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">신고 접수 완료 · 아래에서 처리 상태 확인</p>}
      </form>
      <section><h2 className="mb-3 text-lg font-semibold">내 신고 내역</h2>
        {history.isPending && <p role="status" className="text-sm text-gray-500">불러오는 중…</p>}
        {history.isError && <p role="alert" className="text-sm text-red-700">내역을 불러오지 못했습니다. <button className="min-h-11 underline" onClick={() => history.refetch()}>다시 시도</button></p>}
        {history.data?.content.length === 0 && <p className="text-sm text-gray-500">접수한 신고가 없습니다.</p>}
        <div className="space-y-3">{history.data?.content.map(report => <article key={report.id} className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold text-primary-700">{REPORT_STATUS[report.status]}</p><h3 className="mt-2 break-words font-semibold">{report.subject}</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-600">{report.details}</p>
          {report.resolutionNote && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm">처리 안내: {report.resolutionNote}</p>}
        </article>)}</div>
        {history.data && history.data.totalPages > 1 && <div className="mt-3 flex items-center justify-between text-sm">
          <button className="min-h-11 px-3 disabled:opacity-30" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {history.data.totalPages}</span>
          <button className="min-h-11 px-3 disabled:opacity-30" disabled={history.data.last} onClick={() => setPage(page + 1)}>다음</button></div>}
      </section>
      <Link className="inline-flex min-h-11 items-center text-sm text-primary-700 underline" to="/community-guidelines">이용수칙 다시 보기</Link>
    </div>
  </div>
}
