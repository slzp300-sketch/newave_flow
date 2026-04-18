import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic2, MicOff, Users2, CheckCircle2, CalendarCheck,
  MessageSquare, AlertCircle, Lock, PenLine, GraduationCap, ChevronDown
} from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { getTTSWeekRange } from '../utils/date'
import { getISOWeek, startOfWeek, addWeeks } from 'date-fns'
import useAuthStore from '../store/authStore'

// 마이크 로테이션: 주차 % 3 → 0: 중1/고1, 1: 중2/고2, 2: 중3/고3
const ROTATION_LABELS = [
  { key: 0, grades: ['중1', '고1'], label: '중1 · 고1' },
  { key: 1, grades: ['중2', '고2'], label: '중2 · 고2' },
  { key: 2, grades: ['중3', '고3'], label: '중3 · 고3' },
]

// ── 날짜 유틸 ──────────────────────────────
function getNow() { return new Date() }
function getDayHour() {
  const n = getNow()
  return { day: n.getDay(), hour: n.getHours() }
}

function getMicRotationIndex() {
  const now = getNow()
  const day = now.getDay()
  const base = (day === 1 || day === 2)
    ? startOfWeek(addWeeks(now, -1), { weekStartsOn: 0 })
    : startOfWeek(now, { weekStartsOn: 0 })
  return getISOWeek(base) % 3
}

// localStorage 키
function getKeys() {
  const { weekNum } = getTTSWeekRange()
  const year = getNow().getFullYear()
  return {
    prayer: `prayer_vote_${year}_w${weekNum}`,
    sat: `sat_meeting_${year}_w${weekNum}`,
  }
}

function buildPrayerState() {
  return { 
    status: null,         // 'TUE', 'THU', 'ABSENT'
    micAvailable: null,   // true, false
    reason: '',           // 불참 사유
    micReason: ''         // 마이크 불가 사유
  }
}
function buildSatState() {
  return { status: null, reason: '' }
}

// ── 메인 컴포넌트 ───────────────────────────
export default function MeetingAttendancePage() {
  const { user }   = useAuthStore()
  const weekInfo   = getTTSWeekRange()
  const keys       = getKeys()
  const micIdx     = getMicRotationIndex()
  const micGroup   = ROTATION_LABELS[micIdx]
  
  // Grade is now from the user object
  const userGrade = user?.grade

  // Prayer state
  const [prayer, setPrayer]           = useState(buildPrayerState)
  const [prayerSubmitted, setPrayerSub] = useState(false)

  // Sat state
  const [sat, setSat]                 = useState(buildSatState)
  const [satSubmitted, setSatSub]     = useState(false)

  // Load from localStorage
  useEffect(() => {
    const savedP = localStorage.getItem(keys.prayer)
    if (savedP) {
      const p = JSON.parse(savedP)
      if (p.submitted) { setPrayer(p.data); setPrayerSub(true) }
      else if (p.data) setPrayer(p.data)
    }
    const savedS = localStorage.getItem(keys.sat)
    if (savedS) {
      const s = JSON.parse(savedS)
      if (s.submitted) { setSat(s.data); setSatSub(true) }
      else if (s.data) setSat(s.data)
    }
  }, [keys.prayer, keys.sat])

  // Auto-save prayer
  useEffect(() => {
    if (!prayerSubmitted) {
      localStorage.setItem(keys.prayer, JSON.stringify({ submitted: false, data: prayer }))
    }
  }, [prayer, prayerSubmitted, keys.prayer])

  // Auto-save sat
  useEffect(() => {
    if (!satSubmitted) {
      localStorage.setItem(keys.sat, JSON.stringify({ submitted: false, data: sat }))
    }
  }, [sat, satSubmitted, keys.sat])

  const updatePrayer = (patch) => setPrayer(d => ({ ...d, ...patch }))
  const updateSat    = (patch) => setSat(d => ({ ...d, ...patch }))

  const submitPrayer = () => {
    localStorage.setItem(keys.prayer, JSON.stringify({ submitted: true, data: prayer }))
    setPrayerSub(true)
  }
  const submitSat = () => {
    localStorage.setItem(keys.sat, JSON.stringify({ submitted: true, data: sat }))
    setSatSub(true)
  }
  const editPrayer = () => setPrayerSub(false)
  const editSat    = () => setSatSub(false)

  // prayer 제출 가능 조건
  const isMicTurn = userGrade && micGroup.grades.includes(userGrade)
  const prayerValid = prayer.status !== null && (
    prayer.status === 'ABSENT' 
      ? prayer.reason.trim() !== ''
      : (!isMicTurn || (prayer.micAvailable !== null && (prayer.micAvailable === true || (prayer.micAvailable === false && prayer.micReason.trim() !== ''))))
  )

  // sat 제출 가능 조건
  const satValid = sat.status !== null && (sat.status === 'ATTEND' || sat.reason.trim() !== '')

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title={`${weekInfo.weekNum}주차 주간 모임`} showBack />

      {/* 상단 배너 */}
      <div className="px-4 py-4 glass-effect">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Weekly Meeting Check</p>
            <p className="text-sm font-bold text-gray-700 mt-0.5">
              {weekInfo.start} ~ {weekInfo.end}
            </p>
          </div>
          {userGrade && (
            <div className="bg-primary-50 px-3 py-1.5 rounded-xl border border-primary-100 flex items-center gap-1.5">
              <GraduationCap size={14} className="text-primary-600" />
              <span className="text-[11px] font-black text-primary-700">{userGrade} 교사</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-5">

        {/* ══ 기도모임 섹션 ══ */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <SectionLabel icon={<Mic2 size={14} className="text-violet-500" />} color="violet">
            온라인 기도모임 투표
          </SectionLabel>

          {prayerSubmitted ? (
            <PrayerSubmittedCard
              prayer={prayer}
              micLabel={micGroup.label}
              onEdit={editPrayer}
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
            />
          )}
        </motion.div>

        {/* ══ 토요일 교사회의 섹션 ══ */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SectionLabel icon={<Users2 size={14} className="text-blue-500" />} color="blue">
            토요일 교사 회의
          </SectionLabel>

          {satSubmitted ? (
            <SatSubmittedCard
              sat={sat}
              onEdit={editSat}
            />
          ) : (
            <SatForm
              sat={sat}
              update={updateSat}
              onSubmit={submitSat}
              valid={satValid}
            />
          )}
        </motion.div>

      </div>
    </div>
  )
}

// ── 섹션 레이블 ─────────────────────────────
function SectionLabel({ icon, children, color }) {
  const colors = {
    violet: 'text-violet-600 bg-violet-50 border-violet-200',
    blue:   'text-blue-600 bg-blue-50 border-blue-200',
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 ${colors[color]}`}>
      {icon}
      <span className="text-xs font-black tracking-wide">{children}</span>
    </div>
  )
}

// ── 기도모임 폼 ─────────────────────────────
function PrayerForm({ prayer, micLabel, update, onSubmit, valid, isMicTurn }) {
  return (
    <Card className="flex flex-col gap-5">
      {/* 마이크 로테이션 안내 */}
      <div className="bg-violet-50 rounded-2xl px-4 py-3 border border-violet-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">이번 주 마이크 순서</p>
          <p className="text-sm font-black text-violet-800 mt-0.5">🎤 {micLabel}</p>
        </div>
        {isMicTurn && (
          <span className="bg-violet-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-sm animate-pulse">당번</span>
        )}
      </div>

      {/* 3지선다 투표 */}
      <div>
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">기도모임 참석 투표</p>
        <div className="grid grid-cols-3 gap-2">
          <VoteButton
            active={prayer.status === 'TUE'}
            onClick={() => update({ status: 'TUE', reason: '' })}
            label="화요일"
            sub="온라인"
            color="violet"
          />
          <VoteButton
            active={prayer.status === 'THU'}
            onClick={() => update({ status: 'THU', reason: '' })}
            label="목요일"
            sub="온라인"
            color="violet"
          />
          <VoteButton
            active={prayer.status === 'ABSENT'}
            onClick={() => update({ status: 'ABSENT', micAvailable: null, micReason: '' })}
            label="둘 다"
            sub="불참"
            color="red"
          />
        </div>
      </div>

      {/* 참석 시 + 마이크 순서일 때만 마이크 여부 노출 */}
      <AnimatePresence>
        {(prayer.status === 'TUE' || prayer.status === 'THU') && isMicTurn && (
          <motion.div
            key="mic-section"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-3 pt-2 border-t border-gray-50"
          >
            <div className="flex items-center gap-2">
              <Mic2 size={14} className="text-violet-500" />
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">마이크 가능 여부</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => update({ micAvailable: true, micReason: '' })}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 text-sm font-black transition-all active:scale-95 ${
                  prayer.micAvailable === true
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-gray-100 bg-gray-50 text-gray-400'
                }`}
              >
                <Mic2 size={16} /> 켤 수 있어요
              </button>
              <button
                onClick={() => update({ micAvailable: false })}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 text-sm font-black transition-all active:scale-95 ${
                  prayer.micAvailable === false
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-gray-100 bg-gray-50 text-gray-400'
                }`}
              >
                <MicOff size={16} /> 어려워요
              </button>
            </div>

            {/* 마이크 불가 → 사유 */}
            <AnimatePresence>
              {prayer.micAvailable === false && (
                <motion.div
                  key="mic-reason"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <ReasonInput
                    value={prayer.micReason}
                    onChange={v => update({ micReason: v })}
                    placeholder="마이크를 켜기 어려운 사유를 입력해 주세요"
                    color="red"
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 둘 다 불참 → 불참 사유 */}
      <AnimatePresence>
        {prayer.status === 'ABSENT' && (
          <motion.div
            key="absent-reason"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-2 border-t border-gray-50"
          >
            <ReasonInput
              value={prayer.reason}
              onChange={v => update({ reason: v })}
              placeholder="불참 사유를 입력해 주세요"
              color="red"
              required
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Button size="lg" disabled={!valid} onClick={onSubmit}>
        <CalendarCheck size={17} />
        기도모임 투표 완료
      </Button>
    </Card>
  )
}

function VoteButton({ active, onClick, label, sub, color }) {
  const colors = {
    violet: active ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-100 bg-gray-50/50 text-gray-400',
    red:    active ? 'border-red-400 bg-red-50 text-red-600'       : 'border-gray-100 bg-gray-50/50 text-gray-400',
  }
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-4 rounded-2xl border-2 transition-all active:scale-95 ${colors[color]}`}
    >
      <span className="text-sm font-black">{label}</span>
      <span className="text-[10px] font-bold opacity-60">{sub}</span>
      {active && <CheckCircle2 size={14} className="mt-1" />}
    </button>
  )
}

// ── 기도모임 제출 완료 카드 ─────────────────
function PrayerSubmittedCard({ prayer, micLabel, onEdit, isMicTurn }) {
  const statusMap = { TUE: '화요일 참석', THU: '목요일 참석', ABSENT: '둘 다 불참' }
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
        <Row label="투표 결과" value={statusMap[prayer.status]} />
        {isMicTurn && (prayer.status === 'TUE' || prayer.status === 'THU') && (
          <Row label="마이크" value={prayer.micAvailable === true ? '🎤 켤 수 있음' : '🔇 어려움'} />
        )}
        {prayer.status === 'ABSENT' && prayer.reason && <Row label="불참 사유" value={prayer.reason} />}
        {isMicTurn && prayer.micAvailable === false && prayer.micReason && <Row label="마이크 사유" value={prayer.micReason} />}
        <Row label="이번 주 순서" value={`🎤 ${micLabel}`} muted />
      </div>
    </Card>
  )
}

// ── 토요일 교사회의 폼 ──────────────────────
function SatForm({ sat, update, onSubmit, valid }) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100">
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">제출 기한</p>
        <p className="text-sm font-black text-blue-800 mt-0.5">📅 매주 금요일 18:00까지</p>
      </div>

      <div>
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">교사 회의 참석 여부</p>
        <div className="grid grid-cols-2 gap-3">
          <AttendButton
            active={sat.status === 'ATTEND'}
            onClick={() => update({ status: 'ATTEND', reason: '' })}
            color="blue"
            label="참석"
          />
          <AttendButton
            active={sat.status === 'ABSENT'}
            onClick={() => update({ status: 'ABSENT' })}
            color="red"
            label="불참"
          />
        </div>
      </div>

      <AnimatePresence>
        {sat.status === 'ABSENT' && (
          <motion.div
            key="sat-reason"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ReasonInput
              value={sat.reason}
              onChange={v => update({ reason: v })}
              placeholder="불참 사유를 입력해 주세요"
              color="red"
              required
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Button size="lg" disabled={!valid} onClick={onSubmit}>
        <CalendarCheck size={17} />
        교사 회의 체크 제출
      </Button>
    </Card>
  )
}

function SatSubmittedCard({ sat, onEdit }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-blue-500" />
          <span className="font-black text-gray-900 text-sm">교사 회의 체크 제출 완료</span>
        </div>
        <button onClick={onEdit} className="text-[11px] text-blue-600 font-black flex items-center gap-1">
          <PenLine size={12} /> 수정
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-2 text-sm">
        <Row label="참석 여부" value={sat.status === 'ATTEND' ? '✅ 참석' : '❌ 불참'} />
        {sat.reason && <Row label="사유" value={sat.reason} />}
      </div>
    </Card>
  )
}

// ── 공통 서브 컴포넌트 ───────────────────────
function AttendButton({ active, onClick, color, label }) {
  const colors = {
    blue:   active ? 'border-blue-400 bg-blue-50'     : 'border-gray-100 bg-gray-50/50',
    red:    active ? 'border-red-400 bg-red-50'       : 'border-gray-100 bg-gray-50/50',
  }
  const textColors = {
    blue:   active ? 'text-blue-700'   : 'text-gray-400',
    red:    active ? 'text-red-600'    : 'text-gray-400',
  }
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all active:scale-95 ${colors[color]}`}
    >
      {active
        ? <CheckCircle2 size={22} className={textColors[color]} />
        : <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-200" />
      }
      <span className={`font-black text-sm ${textColors[color]}`}>{label}</span>
    </button>
  )
}

function ReasonInput({ value, onChange, placeholder, color, required }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={13} className="text-red-400" />
        <span className="text-xs font-black text-gray-500">사유 입력</span>
        {required && <span className="text-[10px] text-red-400 font-bold">*필수</span>}
      </div>
      <textarea
        rows={3}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-gray-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200 text-gray-700 placeholder-gray-300 font-medium bg-gray-50"
      />
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