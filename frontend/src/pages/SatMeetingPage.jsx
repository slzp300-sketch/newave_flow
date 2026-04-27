import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CalendarCheck, MessageSquare, PenLine, Lock, Clock } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { getThisWeekInfo } from '../utils/date'
import { format, addDays } from 'date-fns'
import useAuthStore from '../store/authStore'
import client from '../api/client'

function getNow() { return new Date() }

// 월요일 00:00 ~ 토요일 12:00(정오)까지만 제출/수정 가능
function isSatWindowOpen() {
  const now  = getNow()
  const day  = now.getDay() // 0=Sun, 1=Mon ... 6=Sat
  const hour = now.getHours()
  if (day === 0)              return false          // 일요일: 닫힘
  if (day >= 1 && day <= 5)  return true           // 월~금: 항상 열림
  if (day === 6)              return hour < 12      // 토: 정오 이전만 열림
  return false
}

function getThisWeekMonday() {
  const now = getNow()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return format(monday, 'yyyy-MM-dd')
}

export default function SatMeetingPage() {
  const { user }   = useAuthStore()
  const weekInfo   = getThisWeekInfo()
  const mondayDate = new Date(getThisWeekMonday())
  const satDate    = format(addDays(mondayDate, 5), 'yyyy-MM-dd')
  const satDateLabel = format(addDays(mondayDate, 5), 'M/d')

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
      setEditingSat(false)
    },
    onError: () => alert('저장 중 오류가 발생했습니다.'),
  })

  const [sat, setSat]           = useState({ status: null, reason: '' })
  const [editingSat, setEditingSat] = useState(false)

  useEffect(() => {
    if (satData?.status) {
      setSat({ status: satData.status, reason: satData.reason || '' })
      setEditingSat(false)
    } else {
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
  const windowOpen   = isSatWindowOpen()

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title={`${weekInfo.weekNum}주차 교사회의 체크`} showBack />

      <div className="px-4 py-4 glass-effect">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">토요일 교사 회의 · 월~토 정오까지</p>
          <p className="text-sm font-bold text-gray-700 mt-0.5">{weekInfo.start} ~ {weekInfo.end}</p>
        </div>
      </div>

      <div className="px-4 py-5">
        {satLoading ? (
          <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
        ) : satSubmitted ? (
          <SatSubmittedCard sat={sat} onEdit={() => setEditingSat(true)} windowOpen={windowOpen} />
        ) : windowOpen ? (
          <SatForm
            sat={sat}
            update={updateSat}
            onSubmit={submitSat}
            valid={satValid}
            saving={saveSatMutation.isPending}
            satDateLabel={satDateLabel}
          />
        ) : (
          <SatClosedCard />
        )}
      </div>
    </div>
  )
}

function SatForm({ sat, update, onSubmit, valid, saving, satDateLabel }) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100">
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">제출 기한</p>
        <p className="text-sm font-black text-blue-800 mt-0.5">📅 매주 금요일 18:00까지</p>
      </div>

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

      <Button size="lg" disabled={!valid || saving} onClick={onSubmit}>
        <CalendarCheck size={17} />
        {saving ? '저장 중...' : '교사 회의 체크 제출'}
      </Button>
    </Card>
  )
}

function SatClosedCard() {
  return (
    <Card className="flex flex-col items-center gap-3 py-8">
      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
        <Lock size={22} className="text-gray-400" />
      </div>
      <div className="text-center">
        <p className="font-black text-gray-700 text-sm">제출 기간이 아닙니다</p>
        <p className="text-[11px] text-gray-400 mt-1 font-medium">매주 월요일부터 토요일 정오까지 제출할 수 있습니다</p>
      </div>
      <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
        <Clock size={12} className="text-blue-500" />
        <span className="text-[11px] font-black text-blue-600">Mon ~ Sat 12:00 제출 가능</span>
      </div>
    </Card>
  )
}

function SatSubmittedCard({ sat, onEdit, windowOpen }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-blue-500" />
          <span className="font-black text-gray-900 text-sm">교사 회의 체크 제출 완료</span>
        </div>
        {windowOpen && (
          <button onClick={onEdit} className="text-[11px] text-blue-600 font-black flex items-center gap-1">
            <PenLine size={12} /> 수정
          </button>
        )}
      </div>
      <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-2 text-sm">
        <Row label="참석 여부" value={sat.status === 'ATTEND' ? '✅ 참석' : '❌ 불참'} />
        {sat.reason && <Row label="사유" value={sat.reason} />}
      </div>
      {!windowOpen && (
        <p className="text-[11px] text-gray-400 font-medium text-center">제출 기간이 종료되어 수정할 수 없습니다.</p>
      )}
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
      <span className={`text-[11px] font-black text-right max-w-[200px] ${muted ? 'text-gray-300' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}
