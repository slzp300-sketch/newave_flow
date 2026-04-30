import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, UserCheck, Clock } from 'lucide-react'
import { adminUsersApi } from '../api/adminUsers'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import Card from '../components/common/Card'

export default function AdminPendingUsersPage() {
  const qc = useQueryClient()

  const { data: pendingUsers = [], isLoading: isUsersLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => adminUsersApi.getPending().then(r => r.data)
  })

  const { mutate: approve, isPending } = useMutation({
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

  if (isUsersLoading) return <div className="p-10 text-center">불러오는 중...</div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="가입 승인 대기" showBack />
      
      <div className="px-5 pt-6 pb-4">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Clock className="text-amber-500" size={24} />
          대기 목록 <span className="text-amber-500">{pendingUsers.length}</span>명
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          신규 가입한 교사를 확인하고 활동을 승인해주세요.<br/>
          (반 배정은 '반 담임/부담임 배정' 메뉴에서 진행할 수 있습니다.)
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {pendingUsers.length === 0 ? (
            <div className="py-10 text-center text-gray-400 font-bold bg-white rounded-3xl border border-gray-100">
              승인 대기 중인 사용자가 없습니다.
            </div>
          ) : (
            pendingUsers.map(user => (
              <Card key={user.id} className="p-5 flex flex-col gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-amber-50 text-amber-600 rounded-bl-2xl text-[10px] font-black tracking-widest">
                  PENDING
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-gray-900">{user.name}</h3>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">{user.email}</p>
                </div>
                
                <Button 
                  onClick={() => approve(user.id)}
                  loading={isPending}
                  className="w-full mt-2 flex items-center justify-center gap-2"
                >
                  <UserCheck size={18} />
                  가입 승인 처리
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
