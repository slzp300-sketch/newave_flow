import GradeLabel from '../components/common/GradeLabel'
import { CollapsePanel } from '../components/common/Motion'
import FitLabel from '../components/common/FitLabel'
import { useState, useEffect, useId } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mic2, MicOff, CheckCircle2, CalendarCheck,
  MessageSquare, PenLine, GraduationCap
} from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import WeekNavigator from '../components/common/WeekNavigator'
import { getWeekStartByOffset, formatUpdatedAt, toApiDate, weekLabels } from '../utils/date'
import { getISOWeek, startOfWeek, addWeeks, format, addDays } from 'date-fns'
import useAuthStore from '../store/authStore'
import { prayerVoteApi } from '../api/prayerVote'

const ROTATION_LABELS = [
  { key: 0, grades: ['중1', '고1'], label: '중1 · 고1' },
  { key: 1, grades: ['중2', '고2'], label: '중2 · 고2' },
  { key: 2, grades: ['중3', '고3'], label: '중3 · 고3' },
]

// now: 기준 시각 (지난 주를 볼 때는 그만큼 이전으로 옮긴 시각)
function getMicRotationIndex(now) {
  const day = now.getDay()
  const base = (day === 1 || day === 2)
    ? startOfWeek(addWeeks(now, -1), { weekStartsOn: 0 })
    : startOfWeek(now, { weekStartsOn: 0 })
  return getISOWeek(base) % 3
}

const EMPTY_PRAYER = { status: null, micAvailable: null, reason: '', micReason: '' }

export default function PrayerMeetingPage() {
  const { user }   = useAuthStore()
  const [offset, setOffset] = useState(0)
  const micIdx     = getMicRotationIndex(addWeeks(new Date(), offset))
  const micGroup   = ROTATION_LABELS[micIdx]
  const userGrade  = user?.grade
  const isMicTurn  = userGrade && micGroup.grades.includes(userGrade)
  const mondayDate = getWeekStartByOffset(offset, 1)
  const weekStart  = toApiDate(mondayDate)
  const labels     = weekLabels(mondayDate)
  const tueDate    = format(addDays(mondayDate, 1), 'M/d')
  const thuDate    = format(addDays(mondayDate, 3), 'M/d')

  const queryClient = useQueryClient()

  const { data: voteData, isLoading: voteLoading } = useQuery({
    queryKey: ['prayer-vote', weekStart, user?.id],
    queryFn:  () => prayerVoteApi.getMine(weekStart).then(r => r.data),
    enabled:  !!user,
  })

  const saveMutation = useMutation({
    mutationFn: (payload) => prayerVoteApi.save(payload).then(r => r.data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prayer-vote', weekStart, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['prayer-participation'] }),
        queryClient.invalidateQueries({ queryKey: ['tts-week'] }),
      ])
      setEditingPrayer(false)
    },
    onError: (err) => alert(err.response?.data?.message || '투표 저장 중 오류가 발생했습니다.'),
  })

  const [prayer, setPrayer]           = useState(EMPTY_PRAYER)
  const [editingPrayer, setEditingPrayer] = useState(false)

  // 주를 바꾸거나 저장 결과가 오면 화면 상태를 그 주 기록에 맞춘다
  useEffect(() => {
    if (voteData) {
      setEditingPrayer(false)
    } else {
      setPrayer(EMPTY_PRAYER)
      setEditingPrayer(true)
    }
  }, [voteData, weekStart])

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
      <Header title="기도모임 투표" showBack />

      <div className="px-4 py-3 glass-effect flex flex-col gap-2">
        <WeekNavigator
          offset={offset}
          onChange={setOffset}
          disabled={saveMutation.isPending}
          title={labels.monthWeek}
          range={`${tueDate}(화) · ${thuDate}(목)`}
        />
        {userGrade && (
          <div className="self-end bg-primary-50 px-3 py-1 rounded-xl border border-primary-100 flex items-center gap-1.5">
            <GraduationCap size={13} className="text-primary-600" />
            <span className="text-sm font-bold text-primary-700">{userGrade} 교사</span>
          </div>
        )}
      </div>

      <div className="px-4 py-5">
        {voteLoading ? (
          <Card className="py-8 text-center text-base text-gray-600">불러오는 중...</Card>
        ) : prayerSubmitted ? (
          <PrayerSubmittedCard
            vote={voteData}
            micLabel={micGroup.label}
            onEdit={() => { setPrayer({ status: voteData.status, micAvailable: voteData.status === 'ABSENT' ? null : !voteData.reason, reason: voteData.status === 'ABSENT' ? voteData.reason || '' : '', micReason: voteData.status === 'ABSENT' ? '' : voteData.reason || '' }); setEditingPrayer(true) }}
            isMicTurn={isMicTurn}
          />
        ) : (
          <PrayerForm
            prayer={prayer}
            micLabel={micGroup.label}
            update={updatePrayer}
            onSubmit={submitPrayer}
            onCancel={voteData ? () => setEditingPrayer(false) : null}
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


function PrayerForm({ prayer, micLabel, update, onSubmit, onCancel, valid, isMicTurn, saving, tueDate, thuDate }) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="brand-card bg-primary-50 rounded-2xl px-4 py-3 border border-primary-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-primary-700 uppercase tracking-widest">마이크 순서</p>
          <p className="text-base font-bold text-primary-800 mt-1">🎤 <GradeLabel value={micLabel} /></p>
        </div>
        {isMicTurn && (
          <span className="bg-primary-600 text-white text-sm font-bold px-2 py-1 rounded-lg shadow-sm">당번</span>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">참석할 날을 선택해 주세요</h2>
        <fieldset disabled={saving} aria-label="기도모임 참석 여부" className="grid grid-cols-2 gap-3 min-w-0">
          <VoteButton active={prayer.status === 'TUE'} onClick={() => update({ status: 'TUE', reason: '' })} label="화요일 참석" sub={`${tueDate} · 온라인`} color="violet" />
          <VoteButton active={prayer.status === 'THU'} onClick={() => update({ status: 'THU', reason: '' })} label="목요일 참석" sub={`${thuDate} · 온라인`} color="violet" />
          <VoteButton active={prayer.status === 'ABSENT'} onClick={() => update({ status: 'ABSENT', micAvailable: null, micReason: '' })} label="둘 다 불참" sub="" color="red" />
        </fieldset>
      </div>

      <AnimatePresence>
        {(prayer.status === 'TUE' || prayer.status === 'THU') && isMicTurn && (
          <CollapsePanel key="mic-section" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-3 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <Mic2 size={14} className="text-primary-500" />
              <p className="text-base font-semibold text-gray-800">마이크 가능 여부</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button disabled={saving} aria-pressed={prayer.micAvailable === true} onClick={() => update({ micAvailable: true, micReason: '' })} className={`flex items-center justify-center gap-2 px-3 min-w-0 min-h-12 py-3.5 rounded-2xl border-2 text-base font-bold transition-colors disabled:opacity-60 active:scale-95 ${prayer.micAvailable === true ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
                <Mic2 size={16} aria-hidden="true" /> <FitLabel>켤 수 있어요</FitLabel>
              </button>
              <button disabled={saving} aria-pressed={prayer.micAvailable === false} onClick={() => update({ micAvailable: false })} className={`flex items-center justify-center gap-2 px-3 min-w-0 min-h-12 py-3.5 rounded-2xl border-2 text-base font-bold transition-colors disabled:opacity-60 active:scale-95 ${prayer.micAvailable === false ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
                <MicOff size={16} aria-hidden="true" /> <FitLabel>어려워요</FitLabel>
              </button>
            </div>
            <AnimatePresence>
              {prayer.micAvailable === false && (
                <CollapsePanel key="mic-reason" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <ReasonInput value={prayer.micReason} onChange={v => update({ micReason: v })} label="마이크 사용이 어려운 사유" placeholder="마이크를 켜기 어려운 사유를 입력해 주세요" required disabled={saving} />
                </CollapsePanel>
              )}
            </AnimatePresence>
          </CollapsePanel>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {prayer.status === 'ABSENT' && (
          <CollapsePanel key="absent-reason" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-2 border-t border-gray-50">
            <ReasonInput value={prayer.reason} onChange={v => update({ reason: v })} label="불참 사유" placeholder="불참 사유를 입력해 주세요" required disabled={saving} />
          </CollapsePanel>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        {onCancel && (
          <Button size="lg" variant="secondary" disabled={saving} onClick={onCancel} className="flex-1">취소</Button>
        )}
        <Button size="lg" disabled={!valid || saving} onClick={onSubmit} className="flex-[2]">
          <CalendarCheck size={17} />
          {saving ? '저장 중…' : '참석 여부 저장'}
        </Button>
      </div>
    </Card>
  )
}

function VoteButton({ active, onClick, label, sub, color }) {
  const colors = {
    violet: active ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50/50 text-gray-700',
    red:    active ? 'border-red-400 bg-red-50 text-red-600'         : 'border-gray-200 bg-gray-50/50 text-gray-700',
  }
  return (
    <button data-tone={color === 'red' ? 'absence' : undefined} aria-pressed={active} onClick={onClick} className={`flex flex-col min-w-0 items-center justify-center gap-1 px-3 py-4 min-h-24 rounded-2xl border-2 transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-95 ${color === 'red' ? 'col-span-2' : ''} ${colors[color]}`}>
      <span className="w-full min-w-0 text-base font-bold"><FitLabel>{label}</FitLabel></span>
      {sub && <span className="text-sm font-medium leading-relaxed">{sub.split(" · ").map(part => <span key={part} className="block">{part}</span>)}</span>}
      <CheckCircle2 size={20} aria-hidden="true" className={active ? "mt-1" : "mt-1 invisible"} />
    </button>
  )
}

function PrayerSubmittedCard({ vote, micLabel, onEdit }) {
  const statusMap = { TUE: '화요일 참석', THU: '목요일 참석', ABSENT: '둘 다 불참' }
  const isAbsent  = vote?.status === 'ABSENT'
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-primary-500" />
          <span className="font-bold text-gray-900 text-base">기도모임 투표 완료</span>
        </div>
        <button onClick={onEdit} className="min-h-11 px-3 rounded-xl text-sm text-primary-700 font-bold flex items-center gap-1.5">
          <PenLine size={16} /> 수정
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl px-4 py-4 flex flex-col gap-4">
        <Row label="투표 결과" value={statusMap[vote?.status]} absent={isAbsent} />
        {vote?.reason && <Row label={isAbsent ? "불참 사유" : "마이크 사용이 어려운 사유"} value={vote.reason} />}
        <Row label="마이크 순서" value={<>🎤 <GradeLabel value={micLabel} /></>} muted />
        {vote?.updatedAt && <Row label="마지막 수정" value={formatUpdatedAt(vote.updatedAt)} muted />}
      </div>
    </Card>
  )
}

function ReasonInput({ value, onChange, placeholder, required, disabled, label }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="flex flex-wrap items-center gap-1.5 mb-2">
        <MessageSquare size={13} className="text-red-700" />
        <span className="text-sm font-bold text-gray-700">{label}</span>
        {required && <span className="text-sm text-red-700 font-bold">(필수)</span>}
      </label>
      <textarea id={id} disabled={disabled} required={required} rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base resize-y min-h-28 focus:outline-none focus:ring-2 focus:ring-red-200 text-gray-700 placeholder-gray-500 font-medium bg-gray-50" />
    </div>
  )
}

function Row({ label, value, muted, absent }) {
  return <div className="flex flex-col gap-1 min-w-0">
    <span className="text-sm font-medium text-gray-600">{label}</span>
    <span className={`${muted ? 'text-sm text-gray-600' : absent ? 'text-base text-red-700' : 'text-base text-gray-900'} font-semibold leading-relaxed [overflow-wrap:anywhere]`}>{value}</span>
  </div>
}
