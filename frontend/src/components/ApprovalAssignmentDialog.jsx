import AppSelect from './common/AppSelect'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { classesApi } from '../api/classes'
import useAuthStore from '../store/authStore'
import { approvalScope } from '../utils/approvalScope'
import { hasQueryData, queryReadState } from '../utils/queryReadState'
import Button from './common/Button'
import QueryNotice from './common/QueryNotice'
import QueryRefreshNotice from './common/QueryRefreshNotice'

export default function ApprovalAssignmentDialog({ users, scope, onClose }) {
  const dialog = useRef(null)
  const busy = useRef(false)
  const titleId = useId()
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  useLayoutEffect(() => {
    const node = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    node.showModal()
    document.body.style.overflow = 'hidden'
    return () => { node.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  useLayoutEffect(() => { dialog.current?.querySelector('.account-assignment-question')?.focus({ preventScroll: true }) }, [index])
  const close = () => { if (!busy.current) onClose() }
  const next = () => index + 1 < users.length ? setIndex(value => value + 1) : onClose()
  const teacher = users[index]
  return createPortal(<dialog ref={dialog} className="admin-accounts-page account-approval-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }}>
    <header className="account-dialog-heading">
      <div><p aria-live="polite" className="text-sm text-primary-700">가입 승인 완료{users.length > 1 ? ' · ' + (index + 1) + ' / ' + users.length : ''}</p>
        <h2 id={titleId} className="text-lg font-bold text-gray-900">교사 반 배정</h2></div>
      <button type="button" className="account-dialog-close" aria-label="반 배정 닫기" disabled={saving} onClick={close}><X size={22} /></button>
    </header>
    <AssignmentStep key={teacher.id} teacher={teacher} scope={scope} last={index + 1 === users.length} onNext={next}
      onBusy={value => { busy.current = value; setSaving(value) }} />
    {users.length > 1 && index + 1 < users.length && <button type="button" className="account-skip-rest" disabled={saving} onClick={close}>나머지는 나중에 배정</button>}
  </dialog>, document.body)
}

function AssignmentStep({ teacher, scope, last, onNext, onBusy }) {
  const qc = useQueryClient()
  const [phase, setPhase] = useState('ask')
  const [grade, setGrade] = useState('')
  const [classId, setClassId] = useState('')
  const [primary, setPrimary] = useState(false)
  const [error, setError] = useState('')
  const requestLock = useRef(false)
  const question = useRef(null)
  useLayoutEffect(() => { question.current?.focus({ preventScroll: true }) }, [phase])
  const sessionId = useAuthStore(state => state.authIdentity?.sessionId)
  const rosterQuery = useQuery({
    queryKey: ['admin-roster-approval', scope],
    queryFn: ({ signal }) => classesApi.getRoster({ signal, expectedAuthSessionId: sessionId }).then(r => r.data),
    enabled: phase === 'choose',
    refetchOnMount: 'always',
  })
  const roster = rosterQuery.data || []
  const gradeOrder = ['중1', '중2', '중3', '고1', '고2', '고3']
  const grades = [...new Set(roster.map(row => row.grade || '미분류'))].sort((a, b) => {
    const order = value => gradeOrder.includes(value) ? gradeOrder.indexOf(value) : gradeOrder.length
    return order(a) - order(b) || a.localeCompare(b, 'ko')
  })
  const classes = roster.filter(row => (row.grade || '미분류') === grade).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }))
  const chosen = classes.find(row => String(row.id) === classId)
  const currentPrimary = chosen?.teachers?.find(user => user.isPrimary && user.id !== teacher.id)
  const ready = queryReadState([rosterQuery]) === 'ready'
  const mutation = useMutation({
    mutationFn: request => classesApi.assignTeacher(request.classId, teacher.id, request.primary, { expectedAuthSessionId: request.sessionId }),
    onSuccess: () => {
      if (approvalScope(useAuthStore.getState()) !== scope) return
      setPhase('done')
      void Promise.all(['admin-roster', 'roster', 'teachers', 'teacher-roster', 'my-classes', 'report-summary'].map(key =>
        qc.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith(key) })))
    },
    onError: err => {
      if (approvalScope(useAuthStore.getState()) !== scope) return
      setError(err.response?.data?.message || '반 배정 결과를 확인하지 못했습니다. 현재 배정을 다시 확인해주세요.')
      void rosterQuery.refetch()
    },
    onSettled: () => { requestLock.current = false; onBusy(false) },
  })
  function assign(event) {
    event.preventDefault()
    if (!ready || !chosen || mutation.isPending || requestLock.current || approvalScope(useAuthStore.getState()) !== scope) return
    requestLock.current = true; onBusy(true); setError('')
    mutation.mutate({ classId: chosen.id, primary, sessionId })
  }
  if (phase === 'ask') return <div className="account-assignment-step">
    <p ref={question} tabIndex={-1} className="account-assignment-question">{teacher.name + ' 선생님의 반을 배정하시겠어요?'}</p>
    <p className="account-email text-gray-600">{teacher.email}</p>
    <div className="account-dialog-actions">
      <Button type="button" onClick={() => setPhase('choose')}>지금 반 배정하기</Button>
      <Button type="button" variant="secondary" onClick={onNext}>나중에 하기</Button>
    </div>
  </div>
  if (phase === 'done') return <div className="account-assignment-step">
    <p ref={question} tabIndex={-1} role="status" className="account-assignment-question">{teacher.name + ' 선생님의 반 배정을 저장했습니다.'}</p>
    <p className="text-sm text-gray-600">{(chosen?.grade || '미분류') + ' ' + (chosen?.name || '') + ' · ' + (primary ? '담임' : '부담임')}</p>
    <Button type="button" onClick={onNext} disabled={mutation.isPending}>{last ? '완료' : '다음 교사 배정'}</Button>
  </div>
  return <form className="account-assignment-step" onSubmit={assign}>
    <p ref={question} tabIndex={-1} className="account-assignment-question">{teacher.name + ' 선생님 반 배정'}</p>
    <p className="account-email text-gray-600">{teacher.email}</p>
    {!hasQueryData([rosterQuery]) ? <QueryNotice queries={[rosterQuery]} label="반 목록" /> : <>
      <QueryRefreshNotice queries={[rosterQuery]} label="반 목록" />
      {!roster.length && <p className="text-sm text-gray-600">반을 먼저 등록하세요.</p>}
      <label className="account-assignment-field">학년
        <AppSelect aria-label="학년" value={grade} disabled={!ready || mutation.isPending} required onChange={event => { setGrade(event.target.value); setClassId(''); setError('') }}>
          <option value="">학년 선택</option>
          {grades.map(value => <option key={value} value={value}>{value}</option>)}
        </AppSelect>
      </label>
      <label className="account-assignment-field">반
        <AppSelect aria-label="반" value={classId} disabled={!ready || !grade || mutation.isPending} required onChange={event => {
          const row = classes.find(value => String(value.id) === event.target.value)
          setClassId(event.target.value); setPrimary(!row?.teachers?.some(value => value.isPrimary)); setError('')
        }}>
          <option value="">반 선택</option>
          {classes.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </AppSelect>
      </label>
      <label className="account-assignment-field">담당 구분
        <AppSelect aria-label="담당 구분" value={String(primary)} disabled={!ready || !chosen || mutation.isPending} onChange={event => setPrimary(event.target.value === 'true')}>
          <option value="true">담임</option><option value="false">부담임</option>
        </AppSelect>
      </label>
      {currentPrimary && <p className="text-sm text-gray-600">{'현재 담임: ' + currentPrimary.name + (primary ? ' · 기존 담임은 부담임으로 변경됩니다.' : ' · 기존 담임 배정은 유지됩니다.')}</p>}
    </>}
    {error && <p role="alert" className="account-feedback account-feedback-error">{error}</p>}
    <div className="account-dialog-actions">
      <Button type="submit" disabled={!ready || !chosen || mutation.isPending} loading={mutation.isPending}>반 배정 저장</Button>
      <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onNext}>나중에 하기</Button>
    </div>
  </form>
}
