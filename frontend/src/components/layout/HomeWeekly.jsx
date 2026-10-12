import { useMemo } from 'react'
import { useQuery, useIsMutating } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { addDays, format, startOfWeek } from 'date-fns'
import { weeklyStatusApi } from '../../api/weeklyStatus'
import { prayerVoteApi } from '../../api/prayerVote'
import { ttsApi } from '../../api/tts'
import client from '../../api/client'
import useAuthStore from '../../store/authStore'
import { getWeekStartByOffset, toApiDate } from '../../utils/date'
import { queryReadState } from '../../utils/queryReadState'
import { ttsReadState } from '../../utils/ttsQuery'
import { parseAnswer, calcScore, maxOf } from '../../pages/TTSPage'
import QueryNotice from '../common/QueryNotice'
import FeatureIcon from '../common/FeatureIcon'
import { Reveal, AnimatedValue, ProgressFill, WaveAccent } from '../common/Motion'

export default function HomeWeekly({ navigate }) {
  const { user } = useAuthStore()
  const savingTts = useIsMutating({ mutationKey: ['tts-answer'] }) > 0
  const sunday = getWeekStartByOffset(0, 0)
  const weekStart = toApiDate(sunday)
  const monday = toApiDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const saturday = toApiDate(addDays(new Date(monday + 'T00:00:00'), 5))
  const statusQuery = useQuery({
    queryKey: ['weekly-status'],
    queryFn: () => weeklyStatusApi.getStatus().then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
  const questionsQuery = useQuery({
    queryKey: ['tts-questions', weekStart],
    queryFn: () => ttsApi.getQuestions(weekStart).then(r => r.data),
  })
  const weekQuery = useQuery({
    queryKey: ['tts-week', weekStart],
    enabled: !savingTts,
    queryFn: () => ttsApi.getWeek(weekStart).then(r => r.data),
    staleTime: 60 * 1000,
  })
  const prayerQuery = useQuery({
    queryKey: ['prayer-vote', monday, user?.id],
    queryFn: () => prayerVoteApi.getMine(monday).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
  const meetingQuery = useQuery({
    queryKey: ['meeting-attendance', saturday, user?.id],
    queryFn: () => client.get('/meetings/attendance?date=' + saturday).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
  const questions = questionsQuery.data || []
  const week = weekQuery.data
  const ttsState = ttsReadState([questionsQuery, weekQuery])
  const answers = useMemo(() => {
    const map = {}
    ;(week?.answers || []).forEach(a => {
      const q = questions.find(x => x.id === a.questionId)
      if (q) map[a.questionId] = parseAnswer(q, a.answerData)
    })
    return map
  }, [week, questions])
  const linked = Object.fromEntries((week?.linked || []).map(l => [l.questionId, l.checked]))
  const score = week?.importedPeriod ? week.importedScore : calcScore(questions, answers, linked)
  const maximum = questions.reduce((total, q) => total + maxOf(q), 0)
  const tasks = [
    { to: '/attendance', label: '우리 반 출석', sub: '담임·부담임 공동 기록', query: statusQuery, done: statusQuery.data?.attendanceSubmittedThisWeek },
    { to: '/meeting/prayer', label: '기도모임 투표', sub: '이번 주 참석 여부를 알려 주세요', query: prayerQuery, done: !!prayerQuery.data },
    { to: '/meeting/sat', label: '교사회의 체크', sub: '교사회의 참석 기록', query: meetingQuery, done: !!meetingQuery.data?.status },
  ]
  return (
    <>
      {ttsState.hasData && ttsState.error && <QueryNotice queries={[questionsQuery, weekQuery]} label="최신 TTS 기록" />}
      {!ttsState.hasData ? <QueryNotice queries={[questionsQuery, weekQuery]} label="이번 주 TTS 기록" /> : (
        <Reveal className="brand-card brand-card-solid relative isolate overflow-hidden rounded-2xl bg-primary-600 text-white p-5 shadow-premium" delay={0.04}>
          <WaveAccent />
          <div className="relative flex flex-wrap items-center justify-between gap-3 text-sm">
            <h3 className="flex items-center gap-2 font-medium"><FeatureIcon path="/tts" />이번 주 TTS</h3>
            <span className="shrink-0 self-center text-primary-200">{format(sunday, 'M.d')} – {format(addDays(sunday, 6), 'M.d')}</span>
          </div>
          <p className="mt-4 mb-3">
            <strong className="text-4xl font-semibold tabular-nums"><AnimatedValue value={score ?? '기록 없음'} /></strong>
            {score != null && <span className="ml-2 text-sm text-primary-200">{week?.importedPeriod ? '점 · 시트 확정 기록' : '/ ' + maximum + '점'}</span>}
          </p>
          {!week?.importedPeriod && <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
            <ProgressFill className="bg-secondary-300" ratio={maximum ? score / maximum : 0} />
          </div>}
          <button onClick={() => navigate('/tts')} className="motion-row motion-tap relative flex items-center justify-between w-full text-sm min-h-11 mt-2 text-primary-100 rounded-lg">
            {week?.importedPeriod ? '이번 주 기록 확인하기' : '오늘의 말씀·기도 기록하기'}<ChevronRight size={17} />
          </button>
          {(savingTts || ttsState.refreshing || ttsState.paused) && <p role="status" className="relative text-xs text-primary-200">{ttsState.paused ? '연결 확인 필요' : savingTts ? 'TTS 저장 중…' : '최신 기록 확인 중…'}</p>}
        </Reveal>
      )}
      <Reveal delay={0.1}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">이번 주 할 일</h3>
          <button onClick={() => navigate('/checklist')} className="min-h-11 text-sm text-gray-500">전체 보기</button>
        </div>
        <div className="brand-card bg-white border border-gray-200 rounded-2xl divide-y divide-gray-200">
          {tasks.map(({ to, label, sub, query, done }) => {
            const state = queryReadState([query])
            return <button key={to} onClick={() => navigate(to)} className="motion-row motion-tap w-full flex items-center gap-3 p-4 text-left">
              <span className="brand-action-icon w-12 h-12 rounded-xl flex items-center justify-center shrink-0"><FeatureIcon path={to} /></span>
              <span className="flex-1 min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-gray-500 mt-1">{sub}</span></span>
              <span className={'text-xs shrink-0 ' + (state !== 'ready' ? 'text-gray-500' : done ? 'text-success' : 'text-primary-700')}>{state === 'error' ? '확인 필요' : state !== 'ready' ? '확인 중' : done ? '완료' : '미완료'}</span>
              <ChevronRight size={15} className="text-gray-300 shrink-0" />
            </button>
          })}
        </div>
      </Reveal>
    </>
  )
}
