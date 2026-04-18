import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, Play, CheckCircle2, Calendar, 
  ExternalLink, ChevronRight, AlertCircle, Clock,
  ChevronDown
} from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { formatDate } from '../utils/date'
import client from '../api/client'
import useAuthStore from '../store/authStore'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function MeetingMinutesPage() {
  const [minutes, setMinutes] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    fetchMinutes()
  }, [])

  const fetchMinutes = async () => {
    try {
      const res = await client.get('/minutes')
      setMinutes(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (id) => {
    try {
      await client.post(`/minutes/${id}/confirm`)
      fetchMinutes() // Refresh
      if (selected?.id === id) {
        setSelected(prev => ({ ...prev, confirmed: true }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // 월별 그룹화 로직
  const groupedMinutes = minutes.reduce((acc, m) => {
    const month = format(new Date(m.meetingDate), 'yyyy년 M월', { locale: ko })
    if (!acc[month]) acc[month] = []
    acc[month].push(m)
    return acc
  }, {})

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="회의록 및 영상" showBack />

      <div className="px-4 py-5 flex flex-col gap-8">
        {Object.keys(groupedMinutes).length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
            <FileText size={48} strokeWidth={1} />
            <p className="text-sm font-medium">등록된 회의록이 없습니다.</p>
          </div>
        ) : (
          Object.entries(groupedMinutes).map(([month, items]) => (
            <div key={month} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1 h-4 bg-primary-500 rounded-full" />
                <h3 className="text-sm font-black text-gray-900">{month}</h3>
              </div>
              <div className="flex flex-col gap-3">
                {items.map(m => (
                  <MinuteCard 
                    key={m.id} 
                    minute={m} 
                    onClick={() => setSelected(m)} 
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
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-violet-50 text-violet-600 text-[10px] font-black px-2 py-0.5 rounded-lg border border-violet-100">
                      회의록
                    </span>
                    <span className="text-xs text-gray-400 font-bold">{formatDate(selected.meetingDate)}</span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 leading-tight">{selected.title}</h3>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 bg-gray-50 rounded-full text-gray-400">
                  <ChevronRight className="rotate-90" size={20} />
                </button>
              </div>

              <div className="prose prose-sm max-w-none text-gray-600 mb-8 whitespace-pre-wrap leading-relaxed">
                {selected.content}
              </div>

              {selected.videoLink && (
                <div className="mb-8">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Play size={14} className="text-red-500" /> 녹화 영상
                  </p>
                  <a 
                    href={selected.videoLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100 group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white shadow-sm">
                        <Play fill="currentColor" size={20} />
                      </div>
                      <span className="text-sm font-black text-red-700">영상 시청하기</span>
                    </div>
                    <ExternalLink size={16} className="text-red-300 group-hover:text-red-500 transition-colors" />
                  </a>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {selected.attendanceStatus === 'ATTEND' ? (
                  <div className="flex items-center justify-center gap-2 py-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 font-black text-sm">
                    <CheckCircle2 size={18} /> 회의 참석 완료 (체크 불필요)
                  </div>
                ) : selected.confirmed ? (
                  <div className="flex items-center justify-center gap-2 py-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 font-black text-sm">
                    <CheckCircle2 size={18} /> 확인 완료됨
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 text-xs font-bold leading-normal">
                      <AlertCircle size={16} className="shrink-0" />
                      회의에 참석하지 못하셨다면 회의록과 영상을 꼼꼼히 확인하신 후 아래 버튼을 눌러주세요.
                    </div>
                    <Button size="lg" onClick={() => handleConfirm(selected.id)}>
                      확인 체크하기
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
      className="p-4 active:scale-[0.98] transition-all cursor-pointer border-gray-100 hover:border-violet-200"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">
              {formatDate(minute.meetingDate)}
            </span>
            {minute.attendanceStatus === 'ATTEND' ? (
              <span className="flex items-center gap-0.5 text-[10px] font-black text-emerald-500">
                <CheckCircle2 size={10} /> 참석 완료
              </span>
            ) : minute.confirmed && (
              <span className="flex items-center gap-0.5 text-[10px] font-black text-emerald-500">
                <CheckCircle2 size={10} /> 확인됨
              </span>
            )}
          </div>
          <h4 className="font-black text-gray-900 leading-tight mb-2">{minute.title}</h4>
          <div className="flex items-center gap-3 text-[11px] text-gray-400 font-bold">
            <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(minute.createdAt)} 등록</span>
            {minute.videoLink && <span className="flex items-center gap-1 text-red-400"><Play size={12} /> 영상 있음</span>}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300">
          <ChevronRight size={20} />
        </div>
      </div>
    </Card>
  )
}
