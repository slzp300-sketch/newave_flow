import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CalendarCheck, MessageSquare, PenLine } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import WeekNavigator from '../components/common/WeekNavigator'
import { getWeekStartByOffset, formatUpdatedAt, toApiDate, weekLabels } from '../utils/date'
import { format, addDays } from 'date-fns'
import useAuthStore from '../store/authStore'
import client from '../api/client'

export default function SatMeetingPage() {
  const { user }   = useAuthStore()
  const [offset, setOffset] = useState(0)
  // 월요일 시작 주의 토요일 (일요일에는 어제 토요일이 '이번 주')
  const satDay       = addDays(getWeekStartByOffset(offset, 1), 5)
  const satDate      = toApiDate(satDay)
  const satDateLabel = format(satDay, 'M/d')
  const labels       = weekLabels(satDay)

  const queryClient = useQueryClient()

  const { data: satData, isLoading: satLoading } = useQuery({
    queryKey: ['meeting-attendance', satDate, user?.id],
    queryFn:  () => client.get(`/meetings/attendance?date=${satDate}`).then(r => r.data),
    enabled:  !!user,
  })

  const saveSatMutation = useMutation({
    mutationFn: (payload) => client.post('/meetings/attendance', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-attendance', satDate, user?.id] })
      queryClient.invalidateQueries({ queryKey: ['tts-week'] })
      setEditingSat(false)
    },
    onError: (err) => alert(err.response?.data?.message || '저장 중 오류가 발생했습니다.'),
  })

  const [sat, setSat]           = useState({ status: null, reason: '' })
  const [editingSat, setEditingSat] = useState(false)

  useEffect(() => {
    if (satData?.status) {
      setSat({ status: satData.status, reason: satData.reason || '' })
      setEditingSat(false)
    } else {
      setSat({ status: null, reason: '' })
      setEditingSat(true)
    }
  }, [satData])

  const updateSat  = (patch) => setSat(d => ({ ...d, ...patch }))
  const submitSat  = () => {
    if (!sat.status) return alert('참석 여부를 선택해주세요.')
    saveSatMutation.mutate({
      meetingDate: satDate,
      status: sat.status,
      reason: sat.status === 'ABSENT' ? sat.reason : ''
    })
  }
  const satValid     = sat.status !== null && (sat.status === 'ATTEND' || sat.reason.trim() !== '')
  const satSubmitted = satData?.status && !editingSat

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="교사회의 체크" showBack />

      <div className="px-4 py-3 glass-effect">
        <WeekNavigator
          offset={offset}
          onChange={setOffset}
          title={`${labels.monthWeek} 토요 교사회의`}
          sub={labels.yearWeek}
          range={`${satDateLabel} (토) · 지난 주 기록도 언제든 수정할 수 있어요`}
        />
      </div>

      <div className="px-4 py-5">
        {satLoading ? (
          <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
        ) : satSubmitted ? (
          <SatSubmittedCard sat={sat} updatedAt={satData?.updatedAt} onEdit={() => setEditingSat(true)} />
        ) : (
          <SatForm
            sat={sat}
            update={updateSat}
            onSubmit={submitSat}
            onCancel={satData?.status ? () => {
              setSat({ status: satData.status, reason: satData.reason || '' })
              setEditingSat(false)
            } : null}
            valid={satValid}
            saving={saveSatMutation.isPending}
            satDateLabel={satDateLabel}
          />
        )}
        <p className="text-[11px] text-gray-400 font-medium text-center mt-3">
          참석으로 체크하면 TTS의 '교사회의' 점수에 자동으로 반영돼요.
        </p>
      </div>
    </div>
  )
}

function SatForm({ sat, update, onSubmit, onCancel, valid, saving, satDateLabel }) {
  return (
    <Card className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">교사 회의 참석 여부 ({satDateLabel} 토요일)</p>
        <div className="grid grid-cols-2 gap-3">
          <AttendButton active={sat.status === 'ATTEND'} onClick={() => update({ status: 'ATTEND', reason: '' })} color="blue" label="참석" />
          <AttendButton active={sat.status === 'ABSENT'} onClick={() => update({ status: 'ABSENT' })} color="red" label="불참" />
        </div>
      </div>

      <AnimatePresence>
        {sat.status === 'ABSENT' && (
          <motion.div key="sat-reason" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <ReasonInput value={sat.reason} onChange={v => update({ reason: v })} placeholder="불참 사유를 입력해 주세요" required />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        {onCancel && (
          <Button size="lg" variant="secondary" onClick={onCancel} className="flex-1">취소</Button>
        )}
        <Button size="lg" disabled={!valid || saving} onClick={onSubmit} className="flex-[2]">
          <CalendarCheck size={17} />
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </Card>
  )
}

function SatSubmittedCard({ sat, updatedAt, onEdit }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-blue-500" />
          <span className="font-black text-gray-900 text-sm">교사 회의 체크 완료</span>
        </div>
        <button onClick={onEdit} className="text-[11px] text-blue-600 font-black flex items-center gap-1">
          <PenLine size={12} /> 수정
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-2 text-sm">
        <Row label="참석 여부" value={sat.status === 'ATTEND' ? '✅ 참석' : '❌ 불참'} />
        {sat.reason && <Row label="사유" value={sat.reason} />}
        {updatedAt && <Row label="마지막 수정" value={formatUpdatedAt(updatedAt)} muted />}
      </div>
    </Card>
  )
}

function AttendButton({ active, onClick, color, label }) {
  const colors    = { blue: active ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50/50', red: active ? 'border-red-400 bg-red-50' : 'border-gray-100 bg-gray-50/50' }
  const textColors = { blue: active ? 'text-blue-700' : 'text-gray-400', red: active ? 'text-red-600' : 'text-gray-400' }
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all active:scale-95 ${colors[color]}`}>
      {active ? <CheckCircle2 size={22} className={textColors[color]} /> : <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-200" />}
      <span className={`font-black text-sm ${textColors[color]}`}>{label}</span>
    </button>
  )
}

function ReasonInput({ value, onChange, placeholder, required }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={13} className="text-red-400" />
        <span className="text-xs font-black text-gray-500">사유 입력</span>
        {required && <span className="text-[10px] text-red-400 font-bold">*필수</span>}
      </div>
      <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 rounded-xl border border-gray-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200 text-gray-700 placeholder-gray-300 font-medium bg-gray-50" />
    </div>
  )
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className={`text-[11px] font-bold ${muted ? 'text-gray-300' : 'text-gray-400'}`}>{label}</span>
      <span className={`text-[11px] font-black text-right max-w-[200px] ${muted ? 'text-gray-400' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}
