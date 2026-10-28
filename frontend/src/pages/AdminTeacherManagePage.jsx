import FitLabel from '../components/common/FitLabel'
import AdminReadGuard from '../components/common/AdminReadGuard'
import './AdminTeacherManagePage.css'
import SearchField from '../components/common/SearchField'
import { matchesAdminSearch } from '../utils/adminSearch'
import { useState, useMemo, forwardRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { User as UserIcon, Check, Loader2, ChevronRight } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import AdminPasswordReset from '../components/AdminPasswordReset'
import ViewModeToggle, { useViewMode, DetailTable } from '../components/common/ViewModeToggle'
import { usersApi } from '../api/users'
import useAuthStore from '../store/authStore'
import { Link } from 'react-router-dom'
import AccountStatusHistory from '../components/AccountStatusHistory'

export default function AdminTeacherManagePage() {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('admin-teachers', 'large')
  const [selectedId, setSelectedId] = useState(null) // 작은 카드·목록·자세히에서 누른 교사 (권한 변경 창)
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()

  const usersQuery = useQuery({
    queryKey: ['users-management'],
    queryFn: () => usersApi.getAll().then((res) => res.data),
  })

  const { data: users = [] } = usersQuery

  const mutation = useMutation({
    mutationFn: ({ id, role }) => usersApi.updateRole(id, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users-management'] })
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
    onError: err => alert(err.response?.data?.message || '권한을 변경하지 못했습니다. 다시 시도해 주세요.'),
  })

  // 기존 관리 대상 기준 유지: 본인과 ADMIN은 목록에서 제외한다.
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (u.id === currentUser?.id) return false
      if (u.role === 'ADMIN') return false
      return matchesAdminSearch(search, u.name, u.email)
    })
  }, [users, search, currentUser])

  // 권한이 바뀌면 최신 정보로 다시 그리도록 목록에서 찾아온다
  const selectedUser = filteredUsers.find(u => u.id === selectedId)

  const handleRoleChange = (id, newRole) => {
    if (mutation.isPending) return
    if (newRole === 'PASTOR') {
      const pastorOrAdminCount = users.filter(u => u.role === 'PASTOR' || u.role === 'ADMIN').length
      if (pastorOrAdminCount >= 2) {
        alert('최종관리자 및 목사님 권한은 최대 2명까지만 설정할 수 있습니다.')
        return
      }
    }

    if (window.confirm(`${newRole === 'PASTOR' ? '목사님' : newRole === 'EXECUTIVE' ? '임원교사' : newRole === 'ADMIN' ? '최종관리자' : '일반교사'} 권한을 부여하시겠습니까?`)) {
      mutation.mutate({ id, role: newRole })
    }
  }

  return (
    <div className="admin-teachers-page flex flex-col min-h-screen bg-gray-50 pb-24">
      <Header title="교사 권한 관리" showBack />

      <div className="px-4 py-6">
        <div className="mb-5 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-gray-900">교사 · 권한 · 계정 정보</h2>
          <Link to="/admin/pending-users?tab=suspended" className="teacher-action rounded-2xl border border-gray-200 bg-white text-primary-800"><FitLabel>이용 정지 계정·복구 이력</FitLabel><ChevronRight size={18} aria-hidden="true"/></Link>
          <SearchField label="교사 검색" value={search} onChange={setSearch} placeholder="이름 또는 이메일 검색" />
        </div>

        <AdminReadGuard queries={[usersQuery]} label="교사 명단">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <UserIcon size={48} className="text-gray-600" />
            <p className="text-base font-semibold text-gray-700">{search.trim() ? '검색 결과가 없습니다. 검색어를 바꿔 주세요.' : '관리 대상 교사가 없습니다.'}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
             <div className="px-1 mb-1 flex flex-wrap gap-2 items-center justify-between">
                <p className="text-base font-semibold text-gray-700">관리 대상 {filteredUsers.length}명</p>
                <ViewModeToggle mode={viewMode} onChange={setViewMode} label="교사 명단 보기 방식" />
             </div>
            {viewMode === 'large' ? (
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => (
                  <UserManagementCard
                    key={user.id}
                    user={user}
                    onUpdate={handleRoleChange}
                    isUpdating={mutation.isPending && mutation.variables?.id === user.id}
                    disabled={mutation.isPending}
                  />
                ))}
              </AnimatePresence>
            ) : viewMode === 'detail' ? (
              <DetailTable
                rows={filteredUsers}
                onRowClick={u => setSelectedId(u.id)}
                columns={[
                  { label: '이름', render: u => u.name },
                  { label: '권한', render: u => <RoleBadge role={u.role} /> },
                  { label: '소속', render: u => u.grade || '소속 미지정' },
                  { label: '이메일', render: u => u.email },
                ]}
              />
            ) : (
              <div className={viewMode === 'small' ? 'readable-card-grid gap-3' : 'flex flex-col gap-2'}>
                {filteredUsers.map((user, idx) => (
                  <UserCompactItem key={user.id} user={user} idx={idx} mode={viewMode} onClick={() => setSelectedId(user.id)} />
                ))}
              </div>
            )}
          </div>
        )}
        </AdminReadGuard>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if (!mutation.isPending) setSelectedId(null) }} className="fixed inset-0 bg-black/40 z-[60]" />
            <div key="sheet" className="safe-overlay fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 12 }}
                role="dialog" aria-modal="true" aria-label={`${selectedUser.name} 교사 관리`}
                className="safe-modal-panel safe-modal-85d overflow-y-auto w-full max-w-[400px] pointer-events-auto flex flex-col gap-2 rounded-2xl bg-white"
              >
                <UserManagementCard
                  user={selectedUser}
                  onUpdate={handleRoleChange}
                  isUpdating={mutation.isPending && mutation.variables?.id === selectedUser.id}
                  disabled={mutation.isPending}
                />
                <button disabled={mutation.isPending} onClick={() => setSelectedId(null)}
                  className="teacher-action sticky bottom-0 rounded-xl bg-white border border-gray-200 text-gray-700 shadow-sm disabled:opacity-50">
                  <FitLabel>닫기</FitLabel>
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function UserCompactItem({ user, idx, mode, onClick }) {
  return <motion.button type="button" aria-label={`${user.name} 교사 관리`}
    initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:Math.min(idx*.03,.3)}} onClick={onClick}
    className={`min-w-0 w-full rounded-2xl border border-gray-200 bg-white p-3 text-left active:scale-[0.98] ${mode==='small'?'flex flex-col gap-3':'flex items-start gap-3'}`}>
    <div className="h-10 w-10 shrink-0 rounded-xl bg-primary-50 text-primary-800 flex items-center justify-center text-base font-bold" aria-hidden="true">{user.name?.[0]}</div>
    <div className="min-w-0 flex-1">
      <p className="text-base font-bold text-gray-900">{user.name}</p>
      <div className="mt-2"><RoleBadge role={user.role}/></div>
      <p className="mt-2 text-sm text-gray-600">{user.grade || '소속 미지정'}</p>
      {mode!=='small' && <p className="teacher-email mt-1 text-sm text-gray-600">{user.email}</p>}
    </div>
    {mode!=='small' && <ChevronRight size={18} className="mt-1 shrink-0 text-gray-600" aria-hidden="true"/>}
  </motion.button>
}

const UserManagementCard = forwardRef(function UserManagementCard({ user, onUpdate, isUpdating, disabled }, ref) {
  const actor = useAuthStore(state => state.user)
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="min-w-0 p-4 flex flex-col gap-4 relative">
        <div className="flex min-w-0 items-start gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-primary-50 text-primary-800 flex items-center justify-center text-lg font-bold" aria-hidden="true">{user.name?.[0]}</div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-gray-900">{user.name}</p>
            <div className="mt-2"><RoleBadge role={user.role}/></div>
            <p className="mt-2 text-sm text-gray-600">{user.grade || '소속 미지정'}</p>
          </div>
        </div>
        <p className="teacher-email text-sm text-gray-600">{user.email}</p>
        <fieldset disabled={disabled} className="min-w-0">
          <legend className="mb-2 text-sm font-semibold text-gray-600">권한 선택</legend>
          {isUpdating && <p role="status" className="mb-2 flex items-center gap-2 text-sm text-primary-800"><Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true"/>권한 변경 중…</p>}
        <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2">

          <RoleButton
            active={user.role === 'TEACHER'}
            label="일반교사"
            onClick={() => onUpdate(user.id, 'TEACHER')}
          />
          <RoleButton
            active={user.role === 'EXECUTIVE'}
            label="임원교사"
            onClick={() => onUpdate(user.id, 'EXECUTIVE')}
          />
          <RoleButton
            active={user.role === 'PASTOR'}
            label="목사님"
            variant="pastor"
            onClick={() => onUpdate(user.id, 'PASTOR')}
          />
          {user.role === 'ADMIN' && (
            <RoleButton
              active={true}
              label="최종관리자"
              variant="admin"
              onClick={() => onUpdate(user.id, 'ADMIN')}
            />
          )}
        </div>
        </fieldset>
        <fieldset disabled={isUpdating} className="teacher-account-tools">
        {actor?.role === 'ADMIN' && <AdminPasswordReset key={user.id} user={user} />}
        <AccountStatusHistory key={`history-${user.id}`} userId={user.id} />
        </fieldset>
      </Card>
    </motion.div>
  )
})

function RoleButton({ active, label, onClick, variant = 'default' }) {
  const styles = {
    default: active
      ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
      : 'bg-primary-50 text-primary-700 hover:bg-primary-100',
    pastor: active
      ? 'bg-amber-700 text-white shadow-lg shadow-amber-100'
      : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    admin: active
      ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
      : 'bg-primary-50 text-primary-700 hover:bg-primary-100',
  }

  return (
    <button
      type="button" aria-pressed={active}
      onClick={onClick}
      className={`teacher-action teacher-role-choice rounded-xl text-base font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${styles[variant]}`}
    >
      <span className="flex h-4 items-center justify-center" aria-hidden="true">{active && <Check size={16} />}</span>
      <FitLabel>{label}</FitLabel>
    </button>
  )
}

function RoleBadge({ role }) {
  const map = {
    TEACHER:   ['일반교사', 'bg-primary-50 text-primary-800'],
    EXECUTIVE: ['임원교사', 'bg-secondary-50 text-secondary-800'],
    PASTOR:    ['목사님', 'bg-amber-50 text-amber-800'],
    ADMIN:     ['최종관리자', 'bg-primary-50 text-primary-800'],
  }
  const [label, cls] = map[role] ?? ['사용자', 'bg-gray-50 text-gray-600']
  return <span className={`teacher-role inline-flex max-w-full text-sm font-semibold px-2.5 py-1 rounded-lg ${cls}`}>{label}</span>
}
