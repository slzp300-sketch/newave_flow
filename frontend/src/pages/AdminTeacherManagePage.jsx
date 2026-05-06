import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ShieldCheck, UserCog, User as UserIcon, Check, Loader2, ChevronRight, AlertCircle, Sparkles } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { usersApi } from '../api/users'
import useAuthStore from '../store/authStore'

export default function AdminTeacherManagePage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users-management'],
    queryFn: () => usersApi.getAll().then((res) => res.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, role }) => usersApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-management'] })
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })

  // 목사님이나 최고관리자는 수정 대상에서 제외 (처음부터 리스트에서 숨김)
  // 단, 새로 PASTOR 권한을 받은 사람이 있는 경우 리스트에 남아있으면 계속 수정 가능하게 할지 고민
  // 유저의 요구사항: "목사님이나 최고관리자는 수정대상에 포함하지 말아줘"
  // 해석: 현재 ADMIN이나 PASTOR인 사람은 리스트에 노출하지 않거나 수정을 막음
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (u.id === currentUser?.id) return false
      if (u.role === 'ADMIN') return false
      const searchLower = search.toLowerCase()
      return u.name.toLowerCase().includes(searchLower) || u.email.toLowerCase().includes(searchLower)
    })
  }, [users, search, currentUser])

  const handleRoleChange = (id, newRole) => {
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
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <Header title="교사 권한 관리" showBack />

      <div className="px-4 py-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="이름 또는 이메일로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-4 bg-white rounded-3xl border-none shadow-sm focus:ring-2 focus:ring-primary-500 font-medium text-gray-900 placeholder:text-gray-300 transition-all"
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={32} className="text-primary-500 animate-spin" />
            <p className="text-sm font-bold text-gray-400">명단을 불러오고 있습니다...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-rose-500">
            <AlertCircle size={48} />
            <p className="font-bold">데이터를 불러오지 못했습니다.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 opacity-40">
            <UserIcon size={48} className="text-gray-400" />
            <p className="text-sm font-bold text-gray-500">관리 대상 교사가 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
             <div className="px-1 mb-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Management Target ({filteredUsers.length})</p>
             </div>
            <AnimatePresence mode="popLayout">
              {filteredUsers.map((user) => (
                <UserManagementCard
                  key={user.id}
                  user={user}
                  onUpdate={handleRoleChange}
                  isUpdating={mutation.isLoading && mutation.variables?.id === user.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

function UserManagementCard({ user, onUpdate, isUpdating }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="p-5 flex flex-col gap-5 relative overflow-hidden group">
        {isUpdating && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 size={24} className="text-primary-500 animate-spin" />
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-black text-lg shadow-sm">
            {user.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-black text-gray-900 text-base flex-shrink-0">{user.name}</p>
              <RoleBadge role={user.role} />
            </div>
            <p className="text-xs font-medium text-gray-400 mt-0.5 truncate">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
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
      </Card>
    </motion.div>
  )
}

function RoleButton({ active, label, onClick, variant = 'default' }) {
  const styles = {
    default: active
      ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
      : 'bg-primary-50 text-primary-700 hover:bg-primary-100',
    pastor: active
      ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
      : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    admin: active
      ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
      : 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  }

  return (
    <button
      onClick={onClick}
      className={`py-2.5 px-1 rounded-xl text-[11px] font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 ${styles[variant]}`}
    >
      {active && <Check size={12} />}
      {label}
    </button>
  )
}

function RoleBadge({ role }) {
  const map = {
    TEACHER:   ['일반교사', 'bg-blue-50 text-blue-600'],
    EXECUTIVE: ['임원교사', 'bg-emerald-50 text-emerald-600'],
    PASTOR:    ['목사님', 'bg-amber-50 text-amber-600'],
    ADMIN:     ['최종관리자', 'bg-purple-50 text-purple-600'],
  }
  const [label, cls] = map[role] ?? ['사용자', 'bg-gray-50 text-gray-600']
  return <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${cls}`}>{label}</span>
}
