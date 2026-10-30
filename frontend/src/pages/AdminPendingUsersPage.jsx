import FitLabel from '../components/common/FitLabel'
import './AdminPendingUsersPage.css'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck } from 'lucide-react'
import { adminUsersApi } from '../api/adminUsers'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import SearchField from '../components/common/SearchField'
import { AdminIntro, AdminEmpty, FilterResults } from '../components/common/AdminTools'
import QueryNotice from '../components/common/QueryNotice'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import { hasQueryData, queryReadState } from '../utils/queryReadState'
import { matchesAdminSearch } from '../utils/adminSearch'
import { approvalScope } from '../utils/approvalScope'
import { useSearchParams } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import AccountStatusHistory, { statusTime } from '../components/AccountStatusHistory'
import ApprovalAssignmentDialog from '../components/ApprovalAssignmentDialog'

export default function AdminPendingUsersPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'suspended' ? 'suspended' : 'pending'
  const auth = useAuthStore()
  const scope = approvalScope(auth)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [followUp, setFollowUp] = useState(null)
  const approvalLock = useRef(false)
  const pendingQuery = useQuery({
    queryKey: ['pending-users', scope],
    queryFn: ({ signal }) => adminUsersApi.getPending({ signal, expectedAuthSessionId: auth.authIdentity?.sessionId }).then(r => r.data),
    enabled: !!auth.user,
  })
  const suspendedQuery = useQuery({
    queryKey: ['suspended-users', scope],
    queryFn: ({ signal }) => adminUsersApi.getSuspended({ signal, expectedAuthSessionId: auth.authIdentity?.sessionId }).then(r => r.data),
    enabled: !!auth.user,
  })
  useEffect(() => {
    setSelected(new Set()); setError(''); setNotice(''); setFollowUp(null); approvalLock.current = false
  }, [scope])
  useEffect(() => {
    const ids = new Set((pendingQuery.data || []).map(user => user.id))
    setSelected(previous => {
      const next = new Set([...previous].filter(id => ids.has(id)))
      return next.size === previous.size ? previous : next
    })
  }, [pendingQuery.data])

  const approval = useMutation({
    mutationFn: request => {
      const config = { expectedAuthSessionId: request.sessionId }
      return request.users.length === 1
        ? adminUsersApi.approve(request.users[0].id, null, config)
        : adminUsersApi.approveMany(request.users.map(user => user.id), config)
    },
    onSuccess: (_, request) => {
      if (approvalScope(useAuthStore.getState()) !== request.scope) return
      const ids = new Set(request.users.map(user => user.id))
      qc.setQueryData(['pending-users', request.scope], rows => rows?.filter(user => !ids.has(user.id)))
      setSelected(new Set())
      setNotice(request.users.length === 1 ? request.users[0].name + ' 선생님을 승인했습니다.' : request.users.length + '명의 교사를 승인했습니다.')
      setFollowUp({ users: request.users, scope: request.scope })
      void Promise.all(['pending-users', 'teachers', 'teacher-roster', 'users-management', 'all-users-pool', 'report-summary'].map(key => qc.invalidateQueries({ queryKey: [key] })))
    },
    onError: (err, request) => {
      if (approvalScope(useAuthStore.getState()) !== request.scope) return
      setError(err.response?.data?.message || '승인 결과를 확인하지 못했습니다. 목록을 다시 확인해주세요.')
      void qc.invalidateQueries({ queryKey: ['pending-users'] })
    },
    onSettled: (_, __, request) => {
      if (approvalScope(useAuthStore.getState()) === request.scope) approvalLock.current = false
    },
  })
  const pendingUsers = pendingQuery.data || []
  const filtered = pendingUsers.filter(user => matchesAdminSearch(search, user.name, user.email))
  const selectedUsers = filtered.filter(user => selected.has(user.id))
  const allSelected = filtered.length > 0 && selectedUsers.length === filtered.length
  const ready = queryReadState([pendingQuery]) === 'ready'
  const busy = approval.isPending
  function approveUsers(rows) {
    if (!ready || busy || approvalLock.current || !rows.length || rows.length > 100) return
    approvalLock.current = true
    setError(''); setNotice('')
    approval.mutate({ users: rows.map(({ id, name, email }) => ({ id, name, email })), scope, sessionId: auth.authIdentity?.sessionId })
  }
  function changeSearch(value) {
    setSearch(value); setSelected(new Set()); setError('')
  }
  return <div className="admin-accounts-page readable-content min-h-screen bg-gray-50 pb-20">
    <Header title="가입·이용 정지 관리" showBack />
    <div className="flex flex-col gap-4 px-4 py-5">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="계정 관리 구분">
        {[['pending', '가입 승인 대기'], ['suspended', '이용 정지']].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value}
          className={'min-h-11 rounded-2xl px-3 py-3 text-sm font-bold ' + (tab === value ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200')}
          onClick={() => { setParams(value === 'suspended' ? { tab: value } : {}); changeSearch('') }}><FitLabel>{label}</FitLabel></button>)}
      </div>
      {tab === 'suspended' ? <SuspendedAccounts key={scope} query={suspendedQuery} actor={auth.user} scope={scope} /> : <>
        <AdminIntro title="가입 승인" />
        <SearchField label="승인 대기 교사 검색" value={search} onChange={changeSearch} placeholder="이름 또는 이메일 검색" />
        {notice && <p role="status" className="account-feedback">{notice}</p>}
        {error && <p role="alert" className="account-feedback account-feedback-error">{error}</p>}
        {!hasQueryData([pendingQuery]) ? <QueryNotice queries={[pendingQuery]} label="승인 대기 목록" /> : <>
          <QueryRefreshNotice queries={[pendingQuery]} label="승인 대기 목록" />
          <FilterResults count={filtered.length} total={pendingUsers.length} filtered={!!search.trim()} onReset={() => changeSearch('')} />
          {!filtered.length ? <AdminEmpty title={search.trim() ? undefined : '승인 대기 중인 교사가 없습니다'} /> : <>
            <div className="account-selection-bar">
              <label className="account-select-all">
                <input type="checkbox" checked={allSelected} disabled={!ready || busy}
                  ref={node => { if (node) node.indeterminate = selectedUsers.length > 0 && !allSelected }}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map(user => user.id)))} />
                <span>{search.trim() ? '검색 결과 전체 선택' : '전체 선택'}</span>
              </label>
              <Button type="button" disabled={!ready || !selectedUsers.length || selectedUsers.length > 100 || busy}
                loading={busy && approval.variables?.users.length > 1} onClick={() => approveUsers(selectedUsers)}>
                {'선택한 ' + selectedUsers.length + '명 승인'}
              </Button>
            </div>
            {selectedUsers.length > 100 && <p role="alert" className="text-sm text-rose-700">한 번에 최대 100명까지 승인할 수 있습니다. 선택 인원을 줄여주세요.</p>}
            <ul className="account-list" aria-label="승인 대기 교사 목록">
              {filtered.map(user => <li key={user.id} className="account-list-row account-pending-row">
                <label className="account-select-person">
                  <input type="checkbox" aria-label={user.name + ' 선택'} checked={selected.has(user.id)} disabled={!ready || busy}
                    onChange={() => setSelected(previous => { const next = new Set(previous); next.has(user.id) ? next.delete(user.id) : next.add(user.id); return next })} />
                </label>
                <div className="account-identity"><h3 className="account-name font-bold text-gray-900">{user.name}</h3><p className="account-email text-gray-600">{user.email}</p></div>
                <Button type="button" size="sm" aria-label={user.name + ' 승인'} disabled={!ready || busy}
                  loading={busy && approval.variables?.users.length === 1 && approval.variables.users[0].id === user.id} onClick={() => approveUsers([user])}>
                  <UserCheck size={16} aria-hidden="true" />승인
                </Button>
              </li>)}
            </ul>
          </>}
        </>}
      </>}
    </div>
    {followUp?.scope === scope && <ApprovalAssignmentDialog users={followUp.users} scope={scope} onClose={() => setFollowUp(null)} />}
  </div>
}

function SuspendedAccounts({ query, actor, scope }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [reviewVersion, setReviewVersion] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const ready = queryReadState([query]) === 'ready'
  const mutation = useMutation({
    mutationFn: ({ row, note, version }) => adminUsersApi.restore(row.user.id, note, version),
    onSuccess: async (_, { row }) => {
      if (approvalScope(useAuthStore.getState()) !== scope) return
      setSelectedId(null); setReviewVersion(null); setReason(''); setError('')
      await Promise.all(['suspended-users', 'pending-users', 'teachers', 'users-management', 'report-summary', 'user-status-history'].map(key => qc.invalidateQueries({ queryKey: [key] })))
      alert(`${row.user.name} 계정의 이용 정지를 해제했습니다. 다시 로그인해야 이용할 수 있습니다.`)
    },
    onError: err => {
      if (approvalScope(useAuthStore.getState()) !== scope) return
      setError(err.response?.data?.message || '복구하지 못했습니다. 상태를 다시 확인해주세요.')
      qc.invalidateQueries({ queryKey: ['suspended-users'] })
    },
  })
  const rows = (query.data || []).filter(row => matchesAdminSearch(search, row.user.name, row.user.email))
  function restore(event, row) {
    event.preventDefault()
    if (!ready || mutation.isPending || !reason.trim() || reviewVersion !== row.authVersion) return
    if (window.confirm(`${row.user.name} 계정의 이용 정지를 해제할까요?\n기존 로그인은 복구되지 않으며 다시 로그인해야 합니다.`)) mutation.mutate({ row, note: reason.trim(), version: reviewVersion })
  }
  return <>
    <AdminIntro title="이용 정지 계정" description="최종 관리자만 정지 해제 가능" />
    <SearchField label="이용 정지 계정 검색" value={search} onChange={setSearch} placeholder="이름 또는 이메일 검색" />
    {!hasQueryData([query]) ? <QueryNotice queries={[query]} label="이용 정지 목록" /> : <>
      <QueryRefreshNotice queries={[query]} label="이용 정지 목록" />
      <FilterResults count={rows.length} total={query.data.length} filtered={!!search.trim()} onReset={() => setSearch('')} />
      {!rows.length && <AdminEmpty title={search.trim() ? undefined : '이용 정지 중인 계정이 없습니다'} />}
      <ul className="account-list" aria-label="이용 정지 계정 목록">{rows.map(row => <li key={row.user.id} className="account-list-row">
        <div className="account-heading"><div className="account-identity"><h3 className="account-name font-bold text-gray-900">{row.user.name}</h3><p className="account-email mt-1 text-gray-600">{row.user.email}</p></div>
          <span className="account-status rounded-full bg-rose-50 px-3 py-1 font-bold text-rose-700">이용 정지</span></div>
        <Button type="button" variant="secondary" className="account-suspended-detail" aria-expanded={expandedId === row.user.id} onClick={() => {
          setExpandedId(expandedId === row.user.id ? null : row.user.id); setSelectedId(null); setReviewVersion(null); setReason(''); setError('')
        }}>{expandedId === row.user.id ? '상세 접기' : '상세 보기'}</Button>
        {expandedId === row.user.id && <div className="account-suspended-panel space-y-3">
        <p className="text-xs text-gray-500">정지 시각: {statusTime(row.suspendedAt)}</p>
        <div className="account-reason rounded-xl bg-gray-50 p-4"><h4 className="text-sm font-semibold text-gray-600">정지 사유</h4><p className="mt-2 whitespace-pre-wrap">{row.reason || '등록된 사유가 없습니다.'}</p></div>
        <div className="account-history"><AccountStatusHistory userId={row.user.id} /></div>
        {actor?.role === 'ADMIN' && actor.id !== row.user.id ? selectedId === row.user.id ? <form onSubmit={event => restore(event, row)} className="space-y-3 border-t border-gray-100 pt-3">
          <label className="block text-sm font-semibold text-gray-700">이용 정지 해제 사유
            <textarea required maxLength={2000} rows={3} value={reason} disabled={mutation.isPending} onChange={event => { setReason(event.target.value); setError('') }}
              placeholder="문제 해결 여부와 복구 사유를 입력해주세요." className="mt-2 block w-full rounded-xl border border-gray-300 p-3 text-sm font-normal" />
          </label>
          <p className="text-xs text-gray-500">권한 유지 · 해제 후 재로그인 필요</p>
          {reviewVersion !== row.authVersion && <p role="alert" className="text-sm text-rose-700">계정 상태가 변경됐습니다. 취소한 뒤 최신 사유를 다시 검토해주세요.</p>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <div className="account-review-actions"><Button type="submit" disabled={!ready || !reason.trim() || reviewVersion !== row.authVersion} loading={mutation.isPending}>사유 저장 후 이용 정지 해제</Button>
            <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => { setSelectedId(null); setReviewVersion(null); setReason(''); setError('') }}>취소</Button></div>
        </form> : <Button className="w-full" disabled={!ready || mutation.isPending} onClick={() => { setSelectedId(row.user.id); setReviewVersion(row.authVersion); setReason(''); setError('') }}>이용 정지 해제 검토</Button> : <p className="text-xs text-gray-500">복구가 필요하면 최종 관리자에게 요청해주세요.</p>}
        </div>}
      </li>)}</ul>
    </>}
  </>
}
