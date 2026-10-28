import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, Play, CheckCircle2, Calendar, 
  ExternalLink, ChevronRight, AlertCircle, Clock,
  ChevronDown
} from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import ReportLink from '../components/common/ReportLink'
import { formatDate } from '../utils/date'
import client from '../api/client'
import useAuthStore from '../store/authStore'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function MeetingMinutesPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const { user, apiEnvironment } = useAuthStore()
  const query = useQuery({
    queryKey: ['meeting-minutes', apiEnvironment, user?.id],
    queryFn: ({ signal }) => client.get('/minutes', { signal }).then(r => r.data),
    refetchOnWindowFocus: 'always', refetchInterval: 30000,
  })
  const minutes = query.isError ? [] : query.data ?? []
  const selected = minutes.find(minute => minute.id === selectedId) ?? null
  const confirm = useMutation({
    mutationFn: id => client.post(`/minutes/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-status'] })
      return query.refetch()
    },
    onError: () => { setSelectedId(null); query.refetch() },
  })

  useEffect(() => {
    if (selectedId != null && !query.isPending && !selected) setSelectedId(null)
  }, [selectedId, selected, query.isPending])

  // 월별 그룹화 로직
  const groupedMinutes = minutes.reduce((acc, m) => {
    const month = format(new Date(m.meetingDate), 'yyyy년 M월', { locale: ko })
    if (!acc[month]) acc[month] = []
    acc[month].push(m)
    return acc
  }, {})

  if (query.isPending) return <div role="status" className="p-10 text-center text-gray-600">로딩 중...</div>

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="회의록 및 영상" showBack />
      {query.isError && <p role="alert" className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">회의록의 최신 공개 상태를 확인하지 못했습니다. <button className="min-h-11 underline" onClick={() => query.refetch()}>다시 시도</button></p>}
      {confirm.isError && <p role="alert" className="mx-4 text-sm text-red-700">{confirm.error.response?.data?.message || '확인 상태를 저장하지 못했습니다. 다시 시도해 주세요.'}</p>}

      <div className="px-4 py-5 flex flex-col gap-8">
        {!query.isError && Object.keys(groupedMinutes).length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-gray-600">
            <FileText size={48} strokeWidth={1} />
            <p className="text-base font-semibold">등록된 회의록이 없습니다.</p>
          </div>
        ) : (
          Object.entries(groupedMinutes).map(([month, items]) => (
            <div key={month} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1 h-4 bg-primary-500 rounded-full" />
                <h3 className="text-base font-bold text-gray-900">{month}</h3>
              </div>
              <div className="flex flex-col gap-3">
                {items.map(m => (
                  <MinuteCard 
                    key={m.id} 
                    minute={m} 
                    onClick={() => { confirm.reset(); setSelectedId(m.id); query.refetch() }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="safe-overlay safe-overlay-sm-spaced fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedId(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              role="dialog" aria-labelledby="meeting-minute-title"
              className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 safe-modal-panel safe-modal-90 overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="bg-primary-50 text-primary-700 text-sm font-semibold px-2 py-1 rounded-lg border border-primary-100">
                      회의록
                    </span>
                    <span className="text-sm text-gray-600 font-medium">{formatDate(selected.meetingDate)}</span>
                  </div>
                  <h3 id="meeting-minute-title" className="text-xl font-bold text-gray-900 leading-snug break-words [overflow-wrap:anywhere]">{selected.title}</h3>
                </div>
                <button aria-label="회의록 닫기" onClick={() => setSelectedId(null)} className="min-w-11 min-h-11 shrink-0 flex items-center justify-center bg-gray-50 rounded-full text-gray-600 focus-visible:ring-2 focus-visible:ring-primary-300">
                  <ChevronRight className="rotate-90" size={20} />
                </button>
              </div>

              <div className="text-base text-gray-800 mb-6 whitespace-pre-wrap leading-[1.8] break-words [overflow-wrap:anywhere]">
                {selected.content}
              </div>
              <div className="mb-4"><ReportLink contentType="MEETING_MINUTE" targetId={selected.id} label="이 회의록 신고" /></div>

              {selected.videoLink && (
                <div className="mb-8">
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <Play size={14} className="text-red-500" /> 녹화 영상
                  </p>
                  <a 
                    href={selected.videoLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="brand-action flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100 group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-red-500 flex items-center justify-center text-white shadow-sm">
                        <Play fill="currentColor" size={20} />
                      </div>
                      <span className="text-base font-bold text-red-700">영상 시청하기</span>
                    </div>
                    <ExternalLink size={16} className="shrink-0 text-red-600 group-hover:text-red-700 transition-colors" />
                  </a>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {selected.attendanceStatus === 'ATTEND' ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-4 bg-secondary-50 text-secondary-800 rounded-2xl border border-secondary-100 font-semibold text-base leading-relaxed">
                    <CheckCircle2 size={18} aria-hidden="true" className="shrink-0" /> 회의 참석 완료 (체크 불필요)
                  </div>
                ) : selected.confirmed ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-4 bg-secondary-50 text-secondary-800 rounded-2xl border border-secondary-100 font-semibold text-base leading-relaxed">
                    <CheckCircle2 size={18} aria-hidden="true" className="shrink-0" /> 확인 완료됨
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-sm font-medium leading-relaxed">
                      <AlertCircle size={16} className="shrink-0" />
                      {selected.videoLink ? '회의록과 영상을' : '회의록을'} 확인한 뒤 확인 완료를 눌러주세요.
                    </div>
                    <Button size="lg" disabled={confirm.isPending} onClick={() => confirm.mutate(selected.id)}>
                      {confirm.isPending ? '저장 중…' : '확인 완료'}
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MinuteCard({ minute, onClick }) {
  return (
    <Card 
      className="p-4 active:scale-[0.98] transition-all cursor-pointer border-gray-100 hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-primary-700">
              {formatDate(minute.meetingDate)}
            </span>
            {minute.attendanceStatus === 'ATTEND' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-50 px-2 py-1 text-sm font-semibold text-secondary-800">
                <CheckCircle2 size={14} aria-hidden="true" className="shrink-0" /> 참석 완료
              </span>
            ) : minute.confirmed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-50 px-2 py-1 text-sm font-semibold text-secondary-800">
                <CheckCircle2 size={14} aria-hidden="true" className="shrink-0" /> 확인됨
              </span>
            ) : <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-sm font-semibold text-red-700">확인 필요</span>}
          </div>
          <h4 className="text-base font-bold text-gray-900 leading-snug mb-3 break-words [overflow-wrap:anywhere]">{minute.title}</h4>
          <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
            <span className="flex items-center gap-1"><Clock size={14} /> {formatDate(minute.createdAt)} 등록</span>
            {minute.videoLink && <span className="flex items-center gap-1 text-red-700"><Play size={14} /> 영상 있음</span>}
          </div>
        </div>
        <div className="w-8 h-8 shrink-0 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500">
          <ChevronRight size={20} />
        </div>
      </div>
    </Card>
  )
}
