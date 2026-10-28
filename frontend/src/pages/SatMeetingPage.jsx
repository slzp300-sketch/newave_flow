import { CollapsePanel } from '../components/common/Motion'
import { useState, useEffect, useId } from 'react'
import { AnimatePresence } from 'framer-motion'
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
          disabled={saveSatMutation.isPending}
          title={labels.monthWeek}

          range={`${satDateLabel} (토)`}
        />
      </div>

      <div className="px-4 py-5">
        {satLoading ? (
          <Card className="py-8 text-center text-base text-gray-600">불러오는 중...</Card>
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
        <p className="text-sm text-gray-600 leading-relaxed text-center mt-4">
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
        <h2 className="text-lg font-bold text-gray-900 mb-1">참석 여부를 선택해 주세요</h2>
        <p className="text-sm text-gray-600 mb-4">{satDateLabel} 토요일 교사회의</p>
        <fieldset disabled={saving} aria-label="교사회의 참석 여부" className="grid grid-cols-2 gap-3 min-w-0">
          <AttendButton active={sat.status === 'ATTEND'} onClick={() => update({ status: 'ATTEND', reason: '' })} color="blue" label="참석" />
          <AttendButton active={sat.status === 'ABSENT'} onClick={() => update({ status: 'ABSENT' })} color="red" label="불참" />
        </fieldset>
      </div>

      <AnimatePresence>
        {sat.status === 'ABSENT' && (
          <CollapsePanel key="sat-reason" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <ReasonInput value={sat.reason} onChange={v => update({ reason: v })} placeholder="불참 사유를 입력해 주세요" required disabled={saving} />
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

function SatSubmittedCard({ sat, updatedAt, onEdit }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-primary-700 shrink-0" />
          <span className="font-bold text-gray-900 text-base">교사회의 투표 완료</span>
        </div>
        <button onClick={onEdit} className="min-h-11 px-3 rounded-xl text-sm text-primary-700 font-bold flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary-300">
          <PenLine size={16} /> 수정
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl px-4 py-4 flex flex-col gap-4">
        <Row label="참석 여부" value={sat.status === 'ATTEND' ? '참석' : '불참'} tone={sat.status === 'ABSENT' ? 'absence' : 'present'} />
        {sat.reason && <Row label="사유" value={sat.reason} />}
        {updatedAt && <Row label="마지막 수정" value={formatUpdatedAt(updatedAt)} muted />}
      </div>
    </Card>
  )
}

function AttendButton({ active, onClick, color, label }) {
  const colors    = { blue: active ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50/50', red: active ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50/50' }
  const textColors = { blue: active ? 'text-primary-700' : 'text-gray-700', red: active ? 'text-red-600' : 'text-gray-700' }
  return (
    <button data-tone={color === 'red' ? 'absence' : undefined} aria-pressed={active} onClick={onClick} className={`flex flex-col items-center gap-2 min-h-24 px-3 py-5 rounded-2xl border-2 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-95 ${colors[color]}`}>
      {active ? <CheckCircle2 size={22} aria-hidden="true" className={textColors[color]} /> : <div aria-hidden="true" className="w-[22px] h-[22px] rounded-full border-2 border-gray-200" />}
      <span className={`font-bold text-base ${textColors[color]}`}>{label}</span>
    </button>
  )
}

function ReasonInput({ value, onChange, placeholder, required, disabled }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="flex flex-wrap items-center gap-1.5 mb-2">
        <MessageSquare size={16} aria-hidden="true" className="text-red-700" />
        <span className="text-sm font-semibold text-gray-700">불참 사유</span>
        {required && <span className="text-sm text-red-700 font-semibold">(필수)</span>}
      </label>
      <textarea id={id} required={required} disabled={disabled} rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base resize-y min-h-28 focus:outline-none focus:ring-2 focus:ring-red-200 text-gray-900 placeholder-gray-500 bg-gray-50" />
    </div>
  )
}

function Row({ label, value, muted, tone }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className={`${muted ? 'text-sm font-medium text-gray-600' : 'text-base font-semibold'} ${tone === 'absence' ? 'text-red-700' : tone === 'present' ? 'text-secondary-800' : muted ? '' : 'text-gray-900'} leading-relaxed break-words [overflow-wrap:anywhere]`}>{value}</span>
    </div>
  )
}
