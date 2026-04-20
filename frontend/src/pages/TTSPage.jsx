import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Send, CheckCheck, AlertCircle, Clock } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import useAuthStore from '../store/authStore'
import { getTTSWeekRange, canSubmitTTS } from '../utils/date'
import { ttsApi } from '../api/tts'

const DAYS = ['월', '화', '수', '목', '금', '토']

export default function TTSPage() {
  const { user }     = useAuthStore()
  const queryClient  = useQueryClient()
  const weekInfo     = getTTSWeekRange()
  const submissionOpen = canSubmitTTS()
  const currentYear  = new Date().getFullYear()

  const [checks, setChecks]         = useState({})
  const [submitted, setSubmitted]   = useState(false)
  const [openSections, setOpen]     = useState({})

  // 1. 질문 목록 가져오기
  const { data: questions = [], isLoading: qLoading } = useQuery({
    queryKey: ['tts-questions'],
    queryFn: () => ttsApi.getQuestions().then(r => r.data)
  })

  // 2. 나의 이번 주 제출 기록 가져오기
  const { data: record, isLoading: rLoading } = useQuery({
    queryKey: ['tts-my', currentYear, weekInfo.weekNum],
    queryFn: () => ttsApi.getMyTts(currentYear, weekInfo.weekNum).then(r => r.data),
    staleTime: 0
  })

  // 초기 상태 및 데이터 동기화
  useEffect(() => {
    if (record) {
      setSubmitted(record.submitted)
      const initialChecks = {}
      record.answers.forEach(ans => {
        try {
          initialChecks[ans.questionId] = JSON.parse(ans.answerData)
        } catch (e) {
          initialChecks[ans.questionId] = ans.answerData === 'true'
        }
      })
      setChecks(initialChecks)
    }
  }, [record])

  const { mutate: submit, isPending: submitting, data: submitData } = useMutation({
    mutationFn: (data) => ttsApi.submitTts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tts-my'] })
      setSubmitted(true)
    },
    onError: (err) => {
      console.error('TTS Submit Error:', err)
      alert(err.response?.data?.message || '제출 중 오류가 발생했습니다.')
    }
  })

  const toggleDay = (qId, day) => {
    if (submitted) return
    const current = checks[qId] || {}
    setChecks(c => ({
      ...c,
      [qId]: { ...current, [day]: !current[day] }
    }))
  }

  const setAttend = (qId, value) => {
    if (submitted) return
    setChecks(c => ({ ...c, [qId]: value }))
  }

  const handleSubmit = () => {
    if (!submissionOpen) return
    const answers = questions.map(q => ({
      questionId: q.id,
      answerData: JSON.stringify(checks[q.id] || (q.type === 'DAYS' ? {} : null))
    }))
    submit({
      year: currentYear,
      weekNum: weekInfo.weekNum,
      answers
    })
  }

  if (qLoading || rLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="TTS" showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <SubmittedView
        weekInfo={weekInfo}
        questions={questions}
        checks={checks}
        canEdit={submissionOpen}
        onEdit={() => setSubmitted(false)}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title={`${weekInfo.weekNum}주차 TTS`} showBack />

      <div className="px-4 py-4 glass-effect">
        <div>
          <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest">{weekInfo.month}월 {weekInfo.weekOfMonth}주차</p>
          <p className="text-sm font-bold text-gray-700 mt-0.5">
            {weekInfo.start} ~ {weekInfo.end} 기간 활동 체크
          </p>
        </div>
        {!submissionOpen && (
          <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-xl text-[11px] font-bold">
            <AlertCircle size={14} />
            제출 기간이 아닙니다 (토~화 가능)
          </div>
        )}
      </div>

      <div className="px-4 py-5 flex flex-col gap-4">
        {questions.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            {item.type === 'DAYS' ? (
              <DayCheckCard
                item={item}
                checks={checks[item.id] || {}}
                onToggle={(day) => toggleDay(item.id, day)}
                isOpen={openSections[item.id] ?? true}
                onToggleOpen={() => setOpen(o => ({ ...o, [item.id]: !o[item.id] }))}
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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pt-2"
        >
          <Button 
            size="lg" 
            onClick={handleSubmit} 
            loading={submitting}
            disabled={!submissionOpen}
            className={!submissionOpen ? 'opacity-50 grayscale' : ''}
          >
            <Send size={18} />
            {weekInfo.weekNum}주차 TTS 제출하기
          </Button>
          <p className="text-center text-[10px] text-gray-400 mt-2 font-medium">
            {submissionOpen 
              ? '제출 후에도 기간 내에는 수정이 가능합니다' 
              : '현재는 작성만 가능하며, 제출은 토-화에 가능합니다'}
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function DayCheckCard({ item, checks, onToggle, isOpen, onToggleOpen }) {
  const count = DAYS.filter(d => checks?.[d]).length

  return (
    <Card className="overflow-visible">
      <button className="w-full flex items-center justify-between" onClick={onToggleOpen}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{item.emoji}</span>
          <div className="text-left">
            <p className="font-black text-gray-900">{item.title}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">{count}/6일 완료</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black ${count === 6 ? 'text-emerald-500' : 'text-gray-300'}`}>{count}/6</span>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {isOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-6 gap-2">
            {DAYS.map(day => {
              const done = checks?.[day]
              return (
                <button
                  key={day}
                  onClick={() => onToggle(day)}
                  className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 transition-all ${
                    done ? 'border-primary-400 bg-primary-50' : 'border-gray-50 bg-gray-50/50'
                  }`}
                >
                  <span className={`text-[10px] font-black ${day === '일' ? 'text-red-400' : day === '토' ? 'text-blue-400' : done ? 'text-primary-600' : 'text-gray-400'}`}>{day}</span>
                  {done ? <CheckCircle2 size={16} className="text-primary-500" /> : <Circle size={16} className="text-gray-200" />}
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </Card>
  )
}

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
          className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${value === true ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'}`}
        >참석</button>
        <button
          onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${value === false ? 'bg-red-400 text-white shadow-sm' : 'bg-gray-100 text-gray-400'}`}
        >불참</button>
      </div>
    </Card>
  )
}

function SubmittedView({ weekInfo, questions, checks, canEdit, onEdit }) {
  const displayTitle = `${weekInfo.weekNum}주차`
  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title={`${displayTitle} TTS`} showBack />
      <div className="flex-1 flex flex-col items-center justify-top py-10 px-6 gap-6">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-20 h-20 rounded-3xl premium-gradient flex items-center justify-center shadow-glow">
          <CheckCheck size={40} className="text-white" />
        </motion.div>

        <div className="text-center">
          <p className="text-[10px] font-black text-primary-500 mb-1">{weekInfo.month}월 {weekInfo.weekOfMonth}주차</p>
          <p className="text-xl font-black text-gray-900">{displayTitle} TTS</p>
          <p className="text-primary-600 font-bold mt-1">제출 완료되었습니다!</p>
        </div>

        <Card className="w-full flex flex-col gap-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">제출 요약</p>
            {questions.map(q => {
              const val = checks[q.id]
              const totalDays = q.type === 'DAYS' ? 6 : 0
              const count = q.type === 'DAYS' ? DAYS.filter(d => val?.[d]).length : 0
              return (
                <div key={q.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-bold text-gray-700">{q.emoji} {q.title}</span>
                  <span className={`font-black text-sm ${q.type === 'DAYS' ? 'text-primary-600' : val === true ? 'text-emerald-500' : val === false ? 'text-red-400' : 'text-gray-300'}`}>
                    {q.type === 'DAYS' ? `${count}/${totalDays}일` : val === true ? '참석' : val === false ? '불참' : '-'}
                  </span>
                </div>
              )
            })}
        </Card>

        {canEdit ? (
          <button onClick={onEdit} className="text-primary-600 font-bold text-sm underline underline-offset-4">수정하기</button>
        ) : (
          <p className="text-[11px] text-gray-400 font-medium">제출 기간이 종료되었습니다.</p>
        )}
      </div>
    </div>
  )
}
