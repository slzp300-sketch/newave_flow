import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Send, CheckCheck, AlertCircle } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import useAuthStore from '../store/authStore'
import { getTTSWeekRange, canSubmitTTS } from '../utils/date'

// TTS 항목 정의 (월요일 ~ 토요일) - 일요일 제거
const DAYS = ['월', '화', '수', '목', '금', '토']

const TTS_ITEMS = [
  {
    id: 'prayer',
    title: '기도 (30분 이상)',
    type: 'days',  // 요일별 체크
    emoji: '🙏',
  },
  {
    id: 'bible',
    title: '말씀 (3장 이상)',
    type: 'days',
    emoji: '📖',
  },
  {
    id: 'meeting',
    title: '교사 회의',
    type: 'attend', // 참석/불참
    emoji: '👥',
  },
  {
    id: 'zoom',
    title: '온라인 줌 기도모임',
    type: 'attend',
    emoji: '💻',
  },
  {
    id: 'main_service',
    title: '본 예배',
    type: 'attend',
    emoji: '⛪',
  },
  {
    id: 'friday_vigil',
    title: '금요 철야',
    type: 'attend',
    emoji: '🕯️',
  },
]

/** localStorage 키: 해당 연도+주차 조합 */
function getTTSKey() {
  const { weekNum } = getTTSWeekRange()
  const year = new Date().getFullYear()
  return `tts_${year}_week${weekNum}`
}

/** 초기 상태 세팅 */
function buildInitialState() {
  const state = {}
  TTS_ITEMS.forEach(item => {
    if (item.type === 'days') {
      state[item.id] = {}
      DAYS.forEach(d => { state[item.id][d] = false })
    } else {
      state[item.id] = null
    }
  })
  return state
}

export default function TTSPage() {
  const { user }     = useAuthStore()
  const weekInfo     = getTTSWeekRange()
  const storageKey   = getTTSKey()
  const submissionOpen = canSubmitTTS()

  const [checks, setChecks]         = useState(buildInitialState)
  const [submitted, setSubmitted]   = useState(false)
  const [openSections, setOpen]     = useState({ prayer: true, bible: true })

  // 데이터 초기화 및 로드
  useEffect(() => {
    // 박교사용 데이터 리셋 요청 처리
    if (user?.email === 'teacher1@church.com') {
      const resetFlag = `reset_done_${storageKey}`
      if (!localStorage.getItem(resetFlag)) {
        localStorage.removeItem(storageKey)
        localStorage.setItem(resetFlag, 'true')
        window.location.reload()
      }
    }

    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.submitted) {
        setSubmitted(true)
        setChecks(parsed.checks)
      } else if (parsed.checks) {
        // 기존 7일 데이터가 있을 경우 6일로 마이그레이션 방지 (단순 덮어쓰기)
        setChecks(parsed.checks)
      }
    }
  }, [storageKey, user])

  // 자동 저장 (제출 전 임시 저장)
  useEffect(() => {
    if (!submitted) {
      localStorage.setItem(storageKey, JSON.stringify({ submitted: false, checks }))
    }
  }, [checks, submitted, storageKey])

  const toggleDay = (itemId, day) => {
    if (submitted) return
    setChecks(c => ({
      ...c,
      [itemId]: { ...c[itemId], [day]: !c[itemId][day] }
    }))
  }

  const setAttend = (itemId, value) => {
    if (submitted) return
    setChecks(c => ({ ...c, [itemId]: value }))
  }

  const toggleSection = (id) =>
    setOpen(o => ({ ...o, [id]: !o[id] }))

  const handleSubmit = () => {
    if (!submissionOpen) return
    localStorage.setItem(storageKey, JSON.stringify({ submitted: true, checks }))
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <SubmittedView 
        weekInfo={weekInfo} 
        checks={checks} 
        canEdit={submissionOpen} 
        onEdit={() => setSubmitted(false)} 
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title={`${weekInfo.weekNum}주차 TTS`} showBack />

      {/* 헤더 서브 정보 */}
      <div className="px-4 py-4 glass-effect">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teacher Training Sheet</p>
            <p className="text-sm font-bold text-gray-700 mt-0.5">
              {weekInfo.start} ~ {weekInfo.end} 기간 활동 체크
            </p>
          </div>
        </div>
        {!submissionOpen && (
          <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-xl text-[11px] font-bold">
            <AlertCircle size={14} />
            제출은 매주 토요일~화요일에만 가능합니다.
          </div>
        )}
      </div>

      <div className="px-4 py-5 flex flex-col gap-4">
        {TTS_ITEMS.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            {item.type === 'days' ? (
              <DayCheckCard
                item={item}
                checks={checks[item.id]}
                onToggle={(day) => toggleDay(item.id, day)}
                isOpen={openSections[item.id] ?? true}
                onToggleOpen={() => toggleSection(item.id)}
              />
            ) : (
              <AttendCard
                item={item}
                value={checks[item.id]}
                onChange={(v) => setAttend(item.id, v)}
              />
            )}
          </motion.div>
        ))}

        {/* 제출 버튼 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pt-2"
        >
          <Button 
            size="lg" 
            onClick={handleSubmit} 
            disabled={!submissionOpen}
            className={!submissionOpen ? 'opacity-50 grayscale' : ''}
          >
            <Send size={18} />
            {weekInfo.weekNum}주차 TTS 제출하기
          </Button>
          <p className="text-center text-[10px] text-gray-400 mt-2 font-medium">
            {submissionOpen 
              ? '제출 후에는 이번 주 수정이 불가합니다' 
              : '현재는 기록만 가능하며, 제출은 토-화에 가능합니다'}
          </p>
        </motion.div>
      </div>
    </div>
  )
}

// ── 요일별 체크 카드 ──
function DayCheckCard({ item, checks, onToggle, isOpen, onToggleOpen }) {
  const count = DAYS.filter(d => checks?.[d]).length

  return (
    <Card className="overflow-visible">
      <button
        className="w-full flex items-center justify-between"
        onClick={onToggleOpen}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{item.emoji}</span>
          <div className="text-left">
            <p className="font-black text-gray-900">{item.title}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              {count}/{DAYS.length}일 완료
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black ${count === DAYS.length ? 'text-emerald-500' : 'text-gray-300'}`}>
            {count}/{DAYS.length}
          </span>
          {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-gray-100"
        >
          <div className="grid grid-cols-6 gap-2">
            {DAYS.map(day => {
              const done = checks?.[day]
              return (
                <button
                  key={day}
                  onClick={() => onToggle(day)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                    done
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <span className={`text-xs font-black ${day === '토' ? 'text-blue-400' : done ? 'text-primary-600' : 'text-gray-400'}`}>{day}</span>
                  {done
                    ? <CheckCircle2 size={18} className="text-primary-500" />
                    : <Circle size={18} className="text-gray-200" />
                  }
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </Card>
  )
}

// ── 참석/불참 카드 ──
function AttendCard({ item, value, onChange }) {
  return (
    <Card className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{item.emoji}</span>
        <p className="font-black text-gray-900">{item.title}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(true)}
          className={`px-4 py-2 rounded-xl text-sm font-black transition-all active:scale-95 ${
            value === true
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          참석
        </button>
        <button
          onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-xl text-sm font-black transition-all active:scale-95 ${
            value === false
              ? 'bg-red-400 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          불참
        </button>
      </div>
    </Card>
  )
}

// ── 제출 완료 화면 ──
function SubmittedView({ weekInfo, checks, canEdit, onEdit }) {
  const prayerCount = DAYS.filter(d => checks?.prayer?.[d]).length
  const bibleCount  = DAYS.filter(d => checks?.bible?.[d]).length

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title={`${weekInfo.weekNum}주차 TTS`} showBack />
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-24 h-24 rounded-3xl premium-gradient flex items-center justify-center shadow-glow"
        >
          <CheckCheck size={48} className="text-white" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <p className="text-2xl font-black text-gray-900">{weekInfo.weekNum}주차 TTS</p>
          <p className="text-primary-600 font-bold mt-1 text-lg">제출 완료되었습니다!</p>
          <p className="text-gray-400 text-sm mt-3 px-4">
            {weekInfo.start} ~ {weekInfo.end} 기간 활동 기록이 <br/>성공적으로 제출되었습니다.
          </p>
        </motion.div>

        {/* 제출 요약 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full"
        >
          <Card className="flex flex-col gap-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">제출 요약</p>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm font-bold text-gray-700">🙏 기도 (30분 이상)</span>
              <span className="font-black text-primary-600">{prayerCount}/{DAYS.length}일</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm font-bold text-gray-700">📖 말씀 (3장 이상)</span>
              <span className="font-black text-primary-600">{bibleCount}/{DAYS.length}일</span>
            </div>
            {['교사 회의', '온라인 줌 기도모임', '본 예배', '금요 철야'].map((label, i) => {
              const keys = ['meeting', 'zoom', 'main_service', 'friday_vigil']
              const val  = checks[keys[i]]
              return (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-bold text-gray-700">{label}</span>
                  <span className={`font-black text-sm ${val === true ? 'text-emerald-500' : val === false ? 'text-red-400' : 'text-gray-300'}`}>
                    {val === true ? '참석' : val === false ? '불참' : '-'}
                  </span>
                </div>
              )
            })}
          </Card>
        </motion.div>

        {canEdit ? (
          <button
            onClick={onEdit}
            className="text-primary-600 font-bold text-sm underline underline-offset-4 active:opacity-60 transition-opacity"
          >
            기록 내용 수정하기
          </button>
        ) : (
          <p className="text-center text-[11px] text-gray-400 font-medium">
            다음 주 TTS는 다음 주 주일부터 작성 가능합니다.
          </p>
        )}
      </div>
    </div>
  )
}
