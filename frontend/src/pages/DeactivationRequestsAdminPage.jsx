import './PeopleReadability.css'
import SearchField from '../components/common/SearchField'
import { AdminIntro, FilterResults, AdminEmpty } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import AdminReadGuard from '../components/common/AdminReadGuard'
import { useState } from 'react'
import { queryReadState } from '../utils/queryReadState'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, Clock, Users } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import { deactivationApi } from '../api/students'

export default function DeactivationRequestsAdminPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('admin-deactivation-requests', 'large')

  const requestsQuery = useQuery({
    queryKey: ['deactivation-requests-pending'],
    queryFn: () => deactivationApi.getPending().then(r => r.data),
  })
  const { data: requests = [], isLoading } = requestsQuery

  const approveMutation = useMutation({
    mutationFn: (id) => deactivationApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deactivation-requests-pending'] }),
    onError: err => alert(err.response?.data?.message || '신청을 처리하지 못했습니다. 다시 시도해 주세요.'),
  })

  const rejectMutation = useMutation({
    mutationFn: (id) => deactivationApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deactivation-requests-pending'] }),
    onError: err => alert(err.response?.data?.message || '신청을 처리하지 못했습니다. 다시 시도해 주세요.'),
  })

  const filtered = requests.filter(req => matchesAdminSearch(search, req.studentName, req.studentGrade, req.classGroupName, req.teacherName))

  return (
    <div className="people-readable readable-content flex flex-col min-h-screen pb-24">
      <Header title="제적 승인 관리" showBack />

      <div className="flex flex-col gap-4 px-4 py-5">
        <AdminIntro title="제적 신청" />
        <SearchField label="제적 신청 검색" value={search} onChange={setSearch} placeholder="학생, 반 또는 담임 이름 검색" />
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <AdminReadGuard queries={[requestsQuery]} label="제적 신청 목록">
      {!!search.trim() && <div className="px-4"><FilterResults count={filtered.length} total={requests.length} unit="건" filtered onReset={() => setSearch('')} />{!filtered.length && <AdminEmpty />}</div>}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center mt-20">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 mt-20 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary-50 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-secondary-700" />
          </div>
          <p className="font-bold text-gray-700">대기 중인 제적 신청이 없습니다</p>

        </div>
      ) : (
        <div className="px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Clock size={14} className="text-amber-500" />
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">
              승인 대기 {requests.length}건
            </p>
          </div>

          <RecordViews mode={viewMode} rows={filtered} columns={[
            { label: '학생', render: req => req.studentName },
            { label: '학년 · 반', render: req => `${req.studentGrade || ''} ${req.classGroupName || ''}` },
            { label: '담임', render: req => req.teacherName },
            { label: '신청 일시', render: req => req.requestedAt },
            { label: '제적 사유', render: req => req.reason },
            { label: '신청 처리', action: true, render: req => <div className="flex flex-wrap gap-2">
              <button type="button" aria-label={`${req.studentName} 제적 반려`} onClick={() => rejectMutation.mutate(req.id)} disabled={rejectMutation.isPending || approveMutation.isPending || queryReadState([requestsQuery]) !== 'ready'} className="min-h-11 flex-1 rounded-xl bg-gray-100 px-2 font-semibold">반려</button>
              <button type="button" aria-label={`${req.studentName} 제적 승인`} onClick={() => approveMutation.mutate(req.id)} disabled={rejectMutation.isPending || approveMutation.isPending || queryReadState([requestsQuery]) !== 'ready'} className="min-h-11 flex-1 rounded-xl bg-red-500 px-2 font-semibold text-white">승인</button>
            </div> },
          ]}>
          {filtered.map((req, idx) => (
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
                      <p className="font-bold text-gray-900 text-sm">{req.studentName}</p>
                      <span className="text-[0.6875rem] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">
                        {req.studentGrade} {req.classGroupName}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      담임: {req.teacherName} · {req.requestedAt}
                    </p>
                  </div>
                </div>

                {/* 제적 사유 */}
                <div className="brand-card bg-gray-50 rounded-2xl px-4 py-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">제적 사유</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{req.reason}</p>
                </div>

                {/* 버튼 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectMutation.mutate(req.id)}
                    disabled={rejectMutation.isPending || approveMutation.isPending || queryReadState([requestsQuery]) !== 'ready'}
                    className="flex-1 flex min-h-11 items-center justify-center gap-1.5 py-2.5 rounded-full bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    <XCircle size={15} />반려
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(req.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending || queryReadState([requestsQuery]) !== 'ready'}
                    className="flex-1 flex min-h-11 items-center justify-center gap-1.5 py-2.5 rounded-full bg-red-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} />승인
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
          </RecordViews>
        </div>
      )}
    </AdminReadGuard>
    </div>
  )
}
