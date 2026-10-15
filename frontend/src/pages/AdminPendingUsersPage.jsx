import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck } from 'lucide-react'
import { adminUsersApi } from '../api/adminUsers'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import SearchField from '../components/common/SearchField'
import { AdminIntro, AdminEmpty, FilterResults } from '../components/common/AdminTools'
import QueryNotice from '../components/common/QueryNotice'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import { hasQueryData, queryReadState } from '../utils/queryReadState'
import { matchesAdminSearch } from '../utils/adminSearch'
import { Link, useSearchParams } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import AccountStatusHistory, { statusTime } from '../components/AccountStatusHistory'

export default function AdminPendingUsersPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'suspended' ? 'suspended' : 'pending'
  const actor = useAuthStore(state => state.user)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('admin-pending-users', 'large')

  const pendingQuery = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => adminUsersApi.getPending().then(r => r.data)
  })
  const suspendedQuery = useQuery({ queryKey: ['suspended-users'], queryFn: () => adminUsersApi.getSuspended().then(r => r.data) })

  const { mutate: approve, isPending, variables } = useMutation({
    mutationFn: (userId) => adminUsersApi.approve(userId, null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-users'] })
      qc.invalidateQueries({ queryKey: ['teachers'] })
      qc.invalidateQueries({ queryKey: ['report-summary'] })
      alert('사용자가 승인되었습니다.')
    },
    onError: (err) => {
      console.error(err);
      alert('에러: ' + (err.response?.data?.message || err.message));
    }
  })

  const pendingUsers = pendingQuery.data || []
  const filtered = pendingUsers.filter(user => matchesAdminSearch(search, user.name, user.email))
  const ready = queryReadState([pendingQuery]) === 'ready'
  return <div className="min-h-screen bg-gray-50 pb-20">
    <Header title="가입·이용 정지 관리" showBack />
    <div className="flex flex-col gap-4 px-4 py-5">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="계정 관리 구분">
        {[['pending', '가입 승인 대기'], ['suspended', '이용 정지']].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value}
          className={`min-h-11 rounded-2xl px-3 py-3 text-sm font-bold ${tab === value ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          onClick={() => { setParams(value === 'suspended' ? { tab: value } : {}); setSearch('') }}>{label}</button>)}
      </div>
      {tab === 'suspended' ? <SuspendedAccounts query={suspendedQuery} actor={actor} /> : <>
      <AdminIntro title="새로운 교사를 맞이해요" description="신규 가입 정보를 확인해 승인한 뒤 반을 배정해주세요. 이용 정지 계정은 별도 목록에서 확인합니다." />
      <Link to="/admin/class-assignment" className="brand-action flex min-h-11 items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600">
        승인 후 반 배정하기 <span aria-hidden="true">›</span>
      </Link>
      <SearchField label="승인 대기 교사 검색" value={search} onChange={setSearch} placeholder="이름 또는 이메일 검색" />
      <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      {!hasQueryData([pendingQuery]) ? <QueryNotice queries={[pendingQuery]} label="승인 대기 목록" /> : <>
        <QueryRefreshNotice queries={[pendingQuery]} label="승인 대기 목록" />
        <FilterResults count={filtered.length} total={pendingUsers.length} filtered={!!search.trim()} onReset={() => setSearch('')} />
        {!filtered.length && <AdminEmpty title={search.trim() ? undefined : '승인 대기 중인 교사가 없습니다'} description={search.trim() ? undefined : '신규 가입 신청이 들어오면 여기에 표시됩니다.'} />}
        <RecordViews mode={viewMode} rows={filtered} columns={[
          { label: '교사', render: user => user.name },
          { label: '이메일', render: user => user.email },
          { label: '상태', render: () => '승인 대기' },
          { label: '승인', action: true, render: user => <Button onClick={() => approve(user.id)} loading={isPending && variables === user.id} disabled={!ready || isPending} className="w-full">{user.name} 승인</Button> },
        ]}>
        {filtered.map(user => <Card key={user.id} className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><h3 className="font-bold text-gray-900">{user.name}</h3><p className="mt-1 break-all text-xs text-gray-500">{user.email}</p></div>
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">승인 대기</span>
          </div>
          <Button onClick={() => approve(user.id)} loading={isPending && variables === user.id} disabled={!ready || isPending} className="w-full">
            <UserCheck size={17} /> {user.name} 승인
          </Button>
        </Card>)}
        </RecordViews>
      </>}
      </>}
    </div>
  </div>
}

function SuspendedAccounts({ query, actor }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [reviewVersion, setReviewVersion] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const ready = queryReadState([query]) === 'ready'
  const mutation = useMutation({
    mutationFn: ({ row, note, version }) => adminUsersApi.restore(row.user.id, note, version),
    onSuccess: async (_, { row }) => {
      setSelectedId(null); setReviewVersion(null); setReason(''); setError('')
      await Promise.all(['suspended-users', 'pending-users', 'teachers', 'users-management', 'report-summary', 'user-status-history'].map(key => qc.invalidateQueries({ queryKey: [key] })))
      alert(`${row.user.name} 계정의 이용 정지를 해제했습니다. 다시 로그인해야 이용할 수 있습니다.`)
    },
    onError: err => {
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
    <AdminIntro title="이용 정지 계정" description="정지 사유와 조치 이력을 검토해주세요. 최종 관리자만 사유를 남기고 이용 정지를 해제할 수 있습니다." />
    <SearchField label="이용 정지 계정 검색" value={search} onChange={setSearch} placeholder="이름 또는 이메일 검색" />
    {!hasQueryData([query]) ? <QueryNotice queries={[query]} label="이용 정지 목록" /> : <>
      <QueryRefreshNotice queries={[query]} label="이용 정지 목록" />
      <FilterResults count={rows.length} total={query.data.length} filtered={!!search.trim()} onReset={() => setSearch('')} />
      {!rows.length && <AdminEmpty title={search.trim() ? undefined : '이용 정지 중인 계정이 없습니다'} />}
      {rows.map(row => <Card key={row.user.id} className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-bold text-gray-900">{row.user.name}</h3><p className="mt-1 break-all text-xs text-gray-500">{row.user.email}</p></div>
          <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">이용 정지</span></div>
        <p className="text-xs text-gray-500">정지 시각: {statusTime(row.suspendedAt)}</p>
        <p className="whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{row.reason}</p>
        <AccountStatusHistory userId={row.user.id} />
        {actor?.role === 'ADMIN' && actor.id !== row.user.id ? selectedId === row.user.id ? <form onSubmit={event => restore(event, row)} className="space-y-3 border-t border-gray-100 pt-3">
          <label className="block text-sm font-semibold text-gray-700">이용 정지 해제 사유
            <textarea required maxLength={2000} rows={3} value={reason} disabled={mutation.isPending} onChange={event => { setReason(event.target.value); setError('') }}
              placeholder="문제 해결 여부와 복구 사유를 입력해주세요." className="mt-2 block w-full rounded-xl border border-gray-300 p-3 text-sm font-normal" />
          </label>
          <p className="text-xs text-gray-500">계정 권한은 유지되며 이전 로그인은 다시 사용할 수 없습니다.</p>
          {reviewVersion !== row.authVersion && <p role="alert" className="text-sm text-rose-700">계정 상태가 변경됐습니다. 취소한 뒤 최신 사유를 다시 검토해주세요.</p>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!ready || !reason.trim() || reviewVersion !== row.authVersion} loading={mutation.isPending}>사유 저장 후 이용 정지 해제</Button>
            <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => { setSelectedId(null); setReviewVersion(null); setReason(''); setError('') }}>취소</Button></div>
        </form> : <Button className="w-full" disabled={!ready || mutation.isPending} onClick={() => { setSelectedId(row.user.id); setReviewVersion(row.authVersion); setReason(''); setError('') }}>이용 정지 해제 검토</Button> : <p className="text-xs text-gray-500">복구가 필요하면 최종 관리자에게 요청해주세요.</p>}
      </Card>)}
    </>}
  </>
}
