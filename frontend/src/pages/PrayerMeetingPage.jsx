import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mic2, MicOff, CheckCircle2, CalendarCheck,
  MessageSquare, Lock, PenLine, GraduationCap, Clock, BookOpen
} from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { getTTSWeekRange } from '../utils/date'
import { getISOWeek, startOfWeek, addWeeks, format, addDays } from 'date-fns'
import useAuthStore from '../store/authStore'
import { prayerVoteApi } from '../api/prayerVote'

const ROTATION_LABELS = [
  { key: 0, grades: ['중1', '고1'], label: '중1 · 고1' },
  { key: 1, grades: ['중2', '고2'], label: '중2 · 고2' },
  { key: 2, grades: ['중3', '고3'], label: '중3 · 고3' },
]

function getNow() { return new Date() }

function getThisWeekMonday() {
  const now = getNow()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return format(monday, 'yyyy-MM-dd')
}

function isVoteWindowOpen() {
  const day = getNow().getDay()
  return day >= 1 && day <= 4
}

function getMicRotationIndex() {
  const now = getNow()
  const day = now.getDay()
  const base = (day === 1 || day === 2)
    ? startOfWeek(addWeeks(now, -1), { weekStartsOn: 0 })
    : startOfWeek(now, { weekStartsOn: 0 })
  return getISOWeek(base) % 3
}

export default function PrayerMeetingPage() {
  const { user }   = useAuthStore()
  const weekInfo   = getTTSWeekRange()
  const micIdx     = getMicRotationIndex()
  const micGroup   = ROTATION_LABELS[micIdx]
  const userGrade  = user?.grade
  const isMicTurn  = userGrade && micGroup.grades.includes(userGrade)
  const weekStart  = getThisWeekMonday()
  const mondayDate = new Date(weekStart)
  const tueDate    = format(addDays(mondayDate, 1), 'M/d')
  const thuDate    = format(addDays(mondayDate, 3), 'M/d')
  const voteOpen   = isVoteWindowOpen()

  const queryClient = useQueryClient()

  const { data: voteData, isLoading: voteLoading } = useQuery({
    queryKey: ['prayer-vote', weekStart, user?.id],
    queryFn:  () => prayerVoteApi.getMine(weekStart).then(r => r.data),
    enabled:  !!user,
  })

  const saveMutation = useMutation({
    mutationFn: (payload) => prayerVoteApi.save(payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-vote', weekStart, user?.id] })
      setEditingPrayer(false)
    },
    onError: () => alert('투표 저장 중 오류가 발생했습니다.'),
  })

  const [prayer, setPrayer]           = useState({ status: null, micAvailable: null, reason: '', micReason: '' })
  const [editingPrayer, setEditingPrayer] = useState(false)

  useEffect(() => {
    if (voteData) setEditingPrayer(false)
    else          setEditingPrayer(true)
  }, [voteData])

  const updatePrayer = (patch) => setPrayer(d => ({ ...d, ...patch }))

  const submitPrayer = () => {
    if (!prayer.status) return alert('참석 여부를 선택해 주세요.')
    const finalReason = prayer.status === 'ABSENT'
      ? (prayer.reason || '')
      : (prayer.micAvailable === false ? (prayer.micReason || '') : '')
    saveMutation.mutate({ weekStart, status: prayer.status, reason: finalReason })
  }

  const prayerValid = prayer.status !== null && (
    prayer.status === 'ABSENT'
      ? prayer.reason.trim() !== ''
      : (!isMicTurn || (prayer.micAvailable !== null && (
          prayer.micAvailable === true || prayer.micReason.trim() !== ''
        )))
  )

  const prayerSubmitted = !!voteData && !editingPrayer

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title={`${weekInfo.weekNum}주차 기도모임 투표`} showBack />

      <div className="px-4 py-4 glass-effect">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">온라인 기도모임 투표 · Mon ~ Thu</p>
            <p className="text-sm font-bold text-gray-700 mt-0.5">{weekInfo.start} ~ {weekInfo.end}</p>
          </div>
          {userGrade && (
            <div className="bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-100 flex items-center gap-1.5">
              <GraduationCap size={14} className="text-violet-600" />
              <span className="text-[11px] font-black text-violet-700">{userGrade} 교사</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-5">
        {voteLoading ? (
          <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
        ) : !voteOpen && !prayerSubmitted ? (
          <VoteClosedCard />
        ) : prayerSubmitted ? (
          <PrayerSubmittedCard
            vote={voteData}
            micLabel={micGroup.label}
            onEdit={() => { setPrayer({ status: voteData.status, micAvailable: null, reason: voteData.reason || '', micReason: '' }); setEditingPrayer(true) }}
            isMicTurn={isMicTurn}
          />
        ) : (
          <PrayerForm
            prayer={prayer}
            micLabel={micGroup.label}
            update={updatePrayer}
            onSubmit={submitPrayer}
            valid={prayerValid}
            isMicTurn={isMicTurn}
            saving={saveMutation.isPending}
            tueDate={tueDate}
            thuDate={thuDate}
          />
        )}
      </div>
    </div>
  )
}

function VoteClosedCard() {
  return (
    <Card className="flex flex-col items-center gap-3 py-8">
      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
        <Lock size={22} className="text-gray-400" />
      </div>
      <div className="text-center">
        <p className="font-black text-gray-700 text-sm">투표 기간이 아닙니다</p>
        <p className="text-[11px] text-gray-400 mt-1 font-medium">매주 월요일 ~ 목요일에 투표할 수 있습니다</p>
      </div>
      <div className="flex items-center gap-1.5 bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-100">
        <Clock size={12} className="text-violet-500" />
        <span className="text-[11px] font-black text-violet-600">Mon ~ Thu 투표 가능</span>
      </div>
    </Card>
  )
}

function PrayerForm({ prayer, micLabel, update, onSubmit, valid, isMicTurn, saving, tueDate, thuDate }) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="bg-violet-50 rounded-2xl px-4 py-3 border border-violet-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">이번 주 마이크 순서</p>
          <p className="text-sm font-black text-violet-800 mt-0.5">🎤 {micLabel}</p>
        </div>
        {isMicTurn && (
          <span className="bg-violet-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-sm animate-pulse">당번</span>
        )}
      </div>

      <div>
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">기도모임 참석 투표</p>
        <div className="grid grid-cols-3 gap-2">
          <VoteButton active={prayer.status === 'TUE'} onClick={() => update({ status: 'TUE', reason: '' })} label={`${tueDate}(화)`} sub="온라인" color="violet" />
          <VoteButton active={prayer.status === 'THU'} onClick={() => update({ status: 'THU', reason: '' })} label={`${thuDate}(목)`} sub="온라인" color="violet" />
          <VoteButton active={prayer.status === 'ABSENT'} onClick={() => update({ status: 'ABSENT', micAvailable: null, micReason: '' })} label="둘 다" sub="불참" color="red" />
        </div>
      </div>

      <AnimatePresence>
        {(prayer.status === 'TUE' || prayer.status === 'THU') && isMicTurn && (
          <motion.div key="mic-section" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-3 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <Mic2 size={14} className="text-violet-500" />
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">마이크 가능 여부</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => update({ micAvailable: true, micReason: '' })} className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 text-sm font-black transition-all active:scale-95 ${prayer.micAvailable === true ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
                <Mic2 size={16} /> 켤 수 있어요
              </button>
              <button onClick={() => update({ micAvailable: false })} className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 text-sm font-black transition-all active:scale-95 ${prayer.micAvailable === false ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
                <MicOff size={16} /> 어려워요
              </button>
            </div>
            <AnimatePresence>
              {prayer.micAvailable === false && (
                <motion.div key="mic-reason" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <ReasonInput value={prayer.micReason} onChange={v => update({ micReason: v })} placeholder="마이크를 켜기 어려운 사유를 입력해 주세요" required />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {prayer.status === 'ABSENT' && (
          <motion.div key="absent-reason" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-2 border-t border-gray-50">
            <ReasonInput value={prayer.reason} onChange={v => update({ reason: v })} placeholder="불참 사유를 입력해 주세요" required />
          </motion.div>
        )}
      </AnimatePresence>

      <Button size="lg" disabled={!valid || saving} onClick={onSubmit}>
        <CalendarCheck size={17} />
        {saving ? '저장 중...' : '기도모임 투표 완료'}
      </Button>
    </Card>
  )
}

function VoteButton({ active, onClick, label, sub, color }) {
  const colors = {
    violet: active ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-100 bg-gray-50/50 text-gray-400',
    red:    active ? 'border-red-400 bg-red-50 text-red-600'         : 'border-gray-100 bg-gray-50/50 text-gray-400',
  }
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 py-4 rounded-2xl border-2 transition-all active:scale-95 ${colors[color]}`}>
      <span className="text-sm font-black">{label}</span>
      <span className="text-[10px] font-bold opacity-60">{sub}</span>
      {active && <CheckCircle2 size={14} className="mt-1" />}
    </button>
  )
}

function PrayerSubmittedCard({ vote, micLabel, onEdit }) {
  const statusMap = { TUE: '화요일 참석', THU: '목요일 참석', ABSENT: '둘 다 불참' }
  const isAbsent  = vote?.status === 'ABSENT'
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-violet-500" />
          <span className="font-black text-gray-900 text-sm">기도모임 투표 완료</span>
        </div>
        <button onClick={onEdit} className="text-[11px] text-violet-600 font-black flex items-center gap-1">
          <PenLine size={12} /> 수정
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-2 text-sm">
        <Row label="투표 결과" value={statusMap[vote?.status]} />
        {vote?.reason && <Row label="불참 사유" value={vote.reason} />}
        <Row label="이번 주 순서" value={`🎤 ${micLabel}`} muted />
      </div>
      {isAbsent && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-2xl border ${vote.scriptureCopySubmitted ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <BookOpen size={16} className={vote.scriptureCopySubmitted ? 'text-emerald-500 mt-0.5' : 'text-amber-500 mt-0.5'} />
          <div>
            <p className={`text-xs font-black ${vote.scriptureCopySubmitted ? 'text-emerald-700' : 'text-amber-700'}`}>
              {vote.scriptureCopySubmitted ? '필사 제출 완료' : '필사 제출 필요'}
            </p>
            <p className={`text-[11px] mt-0.5 font-medium ${vote.scriptureCopySubmitted ? 'text-emerald-500' : 'text-amber-500'}`}>
              {vote.scriptureCopySubmitted
                ? '관리자가 필사 제출을 확인했습니다'
                : '둘 다 불참 시 이번 주 필사를 제출해야 합니다'}
            </p>
          </div>
        </div>
      )}
    </Card>
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
