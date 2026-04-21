import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, Clock, Users } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { deactivationApi } from '../api/students'

export default function DeactivationRequestsAdminPage() {
  const queryClient = useQueryClient()

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['deactivation-requests-pending'],
    queryFn: () => deactivationApi.getPending().then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id) => deactivationApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deactivation-requests-pending'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id) => deactivationApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deactivation-requests-pending'] }),
  })

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="제적 승인 관리" showBack />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center mt-20">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 mt-20 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-emerald-500" />
          </div>
          <p className="font-black text-gray-700">대기 중인 제적 신청이 없습니다</p>
          <p className="text-xs text-gray-400">새로운 제적 신청이 들어오면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Clock size={14} className="text-amber-500" />
            <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">
              승인 대기 {requests.length}건
            </p>
          </div>

          {requests.map((req, idx) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="flex flex-col gap-3 p-4">
                {/* 학생 정보 */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-gray-900 text-sm">{req.studentName}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-black">
                        {req.studentGrade} {req.classGroupName}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      담임: {req.teacherName} · {req.requestedAt}
                    </p>
                  </div>
                </div>

                {/* 제적 사유 */}
                <div className="bg-gray-50 rounded-2xl px-4 py-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">제적 사유</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{req.reason}</p>
                </div>

                {/* 버튼 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectMutation.mutate(req.id)}
                    disabled={rejectMutation.isPending || approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    <XCircle size={15} />반려
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(req.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-red-500 text-white font-black text-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} />승인
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
