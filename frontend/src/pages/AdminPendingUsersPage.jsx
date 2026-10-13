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
import { Link } from 'react-router-dom'

export default function AdminPendingUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('admin-pending-users', 'large')

  const pendingQuery = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => adminUsersApi.getPending().then(r => r.data)
  })

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
    <Header title="가입 승인 대기" showBack />
    <div className="flex flex-col gap-4 px-4 py-5">
      <AdminIntro title="새로운 교사를 맞이해요" description="가입 정보를 확인해 승인한 뒤, 담당할 반을 배정해 주세요." />
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
    </div>
  </div>
}
