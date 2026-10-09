import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, Link2, ChevronRight, Trophy, BarChart3, TrendingUp, ListOrdered } from 'lucide-react'
import { addDays, format } from 'date-fns'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import WeekNavigator from '../components/common/WeekNavigator'
import useAuthStore from '../store/authStore'
import { getWeekStartByOffset, toApiDate } from '../utils/date'
import { ttsApi } from '../api/tts'

const DAYS = ['월', '화', '수', '목', '금', '토']
const LINK_PATH = { SAT_MEETING: '/meeting/sat', PRAYER_MEETING: '/meeting/prayer' }
const LINK_LABEL = { SAT_MEETING: '교사회의 체크', PRAYER_MEETING: '기도모임 투표' }
const QUARTERS = [
  { q: 1, from: 1, to: 13 },
  { q: 2, from: 14, to: 26 },
  { q: 3, from: 27, to: 39 },
  { q: 4, from: 40, to: 53 },
]

// 서버 TtsService.pointsOf 와 같은 규칙 (점수 미지정이면 매일 항목 5점, 참석 항목 10점)
const pointsOf = (q) => q.points ?? (q.type === 'DAYS' ? 5 : 10)
const isLinked = (q) => q.linkType && q.linkType !== 'NONE'
const maxOf = (q) => q.type === 'DAYS' ? pointsOf(q) * DAYS.length : pointsOf(q)

function parseAnswer(q, raw) {
  if (q.type === 'ATTEND') return raw === 'true'
  try { return JSON.parse(raw) || {} } catch { return {} }
}

function calcScore(questions, answers, linked) {
  return questions.reduce((sum, q) => {
    if (isLinked(q)) return sum + (linked[q.id] ? pointsOf(q) : 0)
    const v = answers[q.id]
    if (q.type === 'ATTEND') return sum + (v === true ? pointsOf(q) : 0)
    return sum + DAYS.filter(d => v?.[d]).length * pointsOf(q)
  }, 0)
}

export default function TTSPage() {
  const [tab, setTab] = useState('check')
  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="TTS" showBack />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-xl">
          {[['check', '내 체크'], ['stats', '통계']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`py-2 rounded-lg text-sm font-black transition-all ${tab === key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400'}`}
            >{label}</button>
          ))}
        </div>
      </div>
      {tab === 'check' ? <CheckTab /> : <StatsTab />}
    </div>
  )
}

/* ───────────────────────── 내 체크 ───────────────────────── */

function CheckTab() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const sunday    = getWeekStartByOffset(offset, 0)
  const weekStart = toApiDate(sunday)
  const todayStr  = toApiDate()
  const weekKey   = ['tts-week', weekStart]

  const { data: questions = [], isLoading: qLoading } = useQuery({
    queryKey: ['tts-questions'],
    queryFn: () => ttsApi.getQuestions().then(r => r.data),
  })

  const { data: week, isLoading: wLoading } = useQuery({
    queryKey: weekKey,
    queryFn: () => ttsApi.getWeek(weekStart).then(r => r.data),
  })

  // 탭하면 화면에 바로 반영하고(낙관적 저장), 실패하면 원래대로 되돌린다
  const { mutate: saveAnswer } = useMutation({
    mutationKey: ['tts-answer'],
    // 빠르게 여러 칸을 탭해도 서버에는 하나씩 차례로 보낸다 (동시에 보내면 같은 주 기록이 겹쳐 실패)
    scope: { id: 'tts-answer' },
    mutationFn: (payload) => ttsApi.saveAnswer(payload).then(r => r.data),
    onMutate: async ({ questionId, answerData }) => {
      await queryClient.cancelQueries({ queryKey: weekKey })
      const prev = queryClient.getQueryData(weekKey)
      queryClient.setQueryData(weekKey, old => {
        if (!old) return old
        const others = (old.answers || []).filter(a => a.questionId !== questionId)
        return { ...old, answers: [...others, { questionId, answerData }] }
      })
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(weekKey, ctx.prev)
      alert(err.response?.data?.message || '저장하지 못했어요. 다시 시도해 주세요.')
    },
    onSettled: () => {
      // 연달아 탭할 때 중간 응답이 화면을 덮어쓰지 않도록 마지막 저장이 끝난 뒤에만 다시 불러온다
      if (queryClient.isMutating({ mutationKey: ['tts-answer'] }) === 1) {
        queryClient.invalidateQueries({ queryKey: weekKey })
        queryClient.invalidateQueries({ queryKey: ['tts-stats'] })
      }
    },
  })

  const answers = useMemo(() => {
    const map = {}
    ;(week?.answers || []).forEach(a => {
      const q = questions.find(x => x.id === a.questionId)
      if (q) map[a.questionId] = parseAnswer(q, a.answerData)
    })
    return map
  }, [week, questions])

  const linked = useMemo(() => {
    const map = {}
    ;(week?.linked || []).forEach(l => { map[l.questionId] = l.checked })
    return map
  }, [week])

  const score    = calcScore(questions, answers, linked)
  const maxScore = questions.reduce((s, q) => s + maxOf(q), 0)
  const dayDate  = (i) => toApiDate(addDays(sunday, i + 1)) // 월=0
  const todayIdx = DAYS.findIndex((_, i) => dayDate(i) === todayStr)

  const toggleDay = (q, day) => {
    const cur  = answers[q.id] || {}
    const next = { ...cur, [day]: !cur[day] }
    saveAnswer({ weekStart, questionId: q.id, answerData: JSON.stringify(next) })
  }
  const toggleAttend = (q) => {
    saveAnswer({ weekStart, questionId: q.id, answerData: String(!(answers[q.id] === true)) })
  }

  const remainingToday = todayIdx >= 0
    ? questions.filter(q => q.type === 'DAYS' && !isLinked(q) && !answers[q.id]?.[DAYS[todayIdx]])
    : []

  return (
    <>
      <div className="px-4 py-3">
        <WeekNavigator
          offset={offset}
          onChange={setOffset}
          title={`${week?.weekNum ?? ''}주차 TTS`}
          range={`${format(sunday, 'M/d')} ~ ${format(addDays(sunday, 6), 'M/d')} · 탭하면 바로 저장돼요`}
        />
      </div>

      {qLoading || wLoading ? (
        <div className="py-16 flex justify-center">
          <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 flex flex-col gap-3">
          <ScoreCard score={score} maxScore={maxScore} weekNum={week?.weekNum} />

          {offset === 0 && todayIdx >= 0 && (
            <div className={`px-4 py-3 rounded-2xl border text-xs font-bold ${remainingToday.length ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
              {remainingToday.length
                ? `오늘(${DAYS[todayIdx]}) 남은 체크: ${remainingToday.map(q => q.title).join(', ')}`
                : `오늘(${DAYS[todayIdx]}) 체크를 모두 마쳤어요 🎉`}
            </div>
          )}

          {questions.map(q => isLinked(q) ? (
            <LinkedCard key={q.id} q={q} checked={!!linked[q.id]} onGo={() => navigate(LINK_PATH[q.linkType])} />
          ) : q.type === 'DAYS' ? (
            <DayCard
              key={q.id}
              q={q}
              value={answers[q.id] || {}}
              isFuture={(i) => dayDate(i) > todayStr}
              todayIdx={todayIdx}
              onToggle={(day) => toggleDay(q, day)}
            />
          ) : (
            <AttendCard key={q.id} q={q} checked={answers[q.id] === true} onToggle={() => toggleAttend(q)} />
          ))}

          <p className="text-[11px] text-gray-400 font-medium text-center mt-1">
            지난 주 기록도 언제든 고칠 수 있어요. 아직 오지 않은 요일은 체크할 수 없어요.
          </p>
        </div>
      )}
    </>
  )
}

function ScoreCard({ score, maxScore, weekNum }) {
  const r = 34
  const c = 2 * Math.PI * r
  const ratio = maxScore ? Math.min(score / maxScore, 1) : 0
  return (
    <Card className="flex items-center gap-4">
      <svg width="84" height="84" viewBox="0 0 84 84" className="flex-shrink-0">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle
          cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
          className="text-primary-500 transition-all duration-500"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} transform="rotate(-90 42 42)"
        />
        <text x="42" y="47" textAnchor="middle" className="fill-gray-900 font-black" fontSize="18">{score}</text>
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest">{weekNum}주차 점수</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5">{score}<span className="text-sm text-gray-300"> / {maxScore}점</span></p>
        <p className="text-[11px] text-gray-400 font-medium mt-0.5">교사회의·기도모임은 해당 화면 기록으로 자동 반영</p>
      </div>
    </Card>
  )
}

function DayCard({ q, value, isFuture, todayIdx, onToggle }) {
  const count = DAYS.filter(d => value[d]).length
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{q.emoji}</span>
          <p className="font-black text-gray-900 text-sm truncate">{q.title}</p>
        </div>
        <span className={`text-xs font-black flex-shrink-0 ${count === 6 ? 'text-emerald-500' : 'text-gray-400'}`}>
          {count}/6 · {count * pointsOf(q)}점
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {DAYS.map((day, i) => {
          const done = !!value[day]
          const future = isFuture(i)
          return (
            <button
              key={day}
              disabled={future}
              onClick={() => onToggle(day)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all active:scale-95 ${
                done ? 'border-primary-400 bg-primary-50' : 'border-gray-50 bg-gray-50/50'
              } ${future ? 'opacity-30' : ''} ${i === todayIdx && !done ? 'border-amber-300' : ''}`}
            >
              <span className={`text-[10px] font-black ${done ? 'text-primary-600' : day === '토' ? 'text-blue-400' : 'text-gray-400'}`}>{day}</span>
              {done ? <CheckCircle2 size={16} className="text-primary-500" /> : <Circle size={16} className="text-gray-200" />}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function AttendCard({ q, checked, onToggle }) {
  return (
    <button onClick={onToggle} className="text-left active:scale-[0.99] transition-transform">
      <Card className={`flex items-center justify-between py-4 border-2 ${checked ? 'border-emerald-300' : 'border-transparent'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{q.emoji}</span>
          <div className="min-w-0">
            <p className="font-black text-gray-900 text-sm truncate">{q.title}</p>
            <p className="text-[11px] text-gray-400 font-medium">{pointsOf(q)}점</p>
          </div>
        </div>
        {checked
          ? <span className="flex items-center gap-1 text-xs font-black text-emerald-600"><CheckCircle2 size={18} /> 참석</span>
          : <span className="flex items-center gap-1 text-xs font-black text-gray-300"><Circle size={18} /> 미체크</span>}
      </Card>
    </button>
  )
}

function LinkedCard({ q, checked, onGo }) {
  return (
    <Card className="flex items-center justify-between py-4 bg-gray-50/60">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xl">{q.emoji}</span>
        <div className="min-w-0">
          <p className="font-black text-gray-900 text-sm truncate">{q.title}</p>
          <button onClick={onGo} className="text-[11px] text-primary-600 font-bold flex items-center gap-0.5">
            <Link2 size={11} /> {LINK_LABEL[q.linkType]}에서 자동 반영 <ChevronRight size={11} />
          </button>
        </div>
      </div>
      {checked
        ? <span className="flex items-center gap-1 text-xs font-black text-emerald-600 flex-shrink-0"><CheckCircle2 size={18} /> {pointsOf(q)}점</span>
        : <span className="text-xs font-black text-gray-300 flex-shrink-0">0점</span>}
    </Card>
  )
}

/* ───────────────────────── 통계 ───────────────────────── */

function StatsTab() {
  const { user } = useAuthStore()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [view, setView] = useState('rank')

  const { data, isLoading } = useQuery({
    queryKey: ['tts-stats', year],
    queryFn: () => ttsApi.getStats(year).then(r => r.data),
  })

  const people = useMemo(() => (data?.people || []).map(p => {
    const weekly = Object.fromEntries(Object.entries(p.weekly || {}).map(([w, s]) => [Number(w), s]))
    const scores = Object.values(weekly).filter(s => s > 0)
    return { ...p, weekly, total: scores.reduce((a, b) => a + b, 0), weeks: scores.length }
  }), [data])

  const lastWeek = data?.currentWeek ?? Math.max(0, ...people.flatMap(p => Object.keys(p.weekly).map(Number)))
  const me = people.find(p => p.teacherId === user?.id)

  return (
    <div className="px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-sm font-black text-gray-700"
        >
          {[thisYear, thisYear - 1].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div className="flex-1 grid grid-cols-4 bg-gray-100 p-1 rounded-xl">
          {[
            ['rank', '누적', Trophy],
            ['quarter', '분기', ListOrdered],
            ['weekly', '주차별', BarChart3],
            ['mine', '내 추이', TrendingUp],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`py-1.5 rounded-lg text-[11px] font-black flex flex-col items-center gap-0.5 ${view === key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400'}`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="py-10 text-center text-sm text-gray-400">불러오는 중...</Card>
      ) : people.length === 0 ? (
        <Card className="py-10 text-center text-sm text-gray-400">{year}년 기록이 아직 없어요</Card>
      ) : view === 'rank' ? (
        <CumulativeRank people={people} myId={user?.id} />
      ) : view === 'quarter' ? (
        <QuarterRank people={people} myId={user?.id} lastWeek={lastWeek} />
      ) : view === 'weekly' ? (
        <WeeklyTable people={people} lastWeek={lastWeek} />
      ) : (
        <MyTrend me={me} lastWeek={lastWeek} />
      )}
    </div>
  )
}

function RankRow({ rank, p, isMe, right, sub }) {
  const medal = ['🥇', '🥈', '🥉'][rank - 1]
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isMe ? 'bg-primary-50 border border-primary-100' : ''}`}>
      <span className="w-7 text-center text-sm font-black text-gray-400">{medal || rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-gray-900 truncate">
          {p.name}{isMe && <span className="text-[10px] text-primary-500 ml-1">나</span>}
        </p>
        {sub && <p className="text-[10px] text-gray-400 font-bold">{sub}</p>}
      </div>
      <div className="text-right flex-shrink-0">{right}</div>
    </div>
  )
}

// 같은 점수는 같은 순위
const withRanks = (list, key) => {
  let prev = null, rank = 0
  return list.map((p, i) => {
    if (p[key] !== prev) { rank = i + 1; prev = p[key] }
    return { ...p, rank }
  })
}

function CumulativeRank({ people, myId }) {
  const list = withRanks([...people].filter(p => p.total > 0).sort((a, b) => b.total - a.total), 'total')
  return (
    <Card className="flex flex-col gap-1 px-2">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 pb-1">누적 점수 순위</p>
      {list.map(p => (
        <RankRow
          key={p.key}
          rank={p.rank}
          p={p}
          isMe={p.teacherId === myId}
          sub={`${p.weeks}주 참여 · 주 평균 ${Math.round(p.total / p.weeks)}점`}
          right={<span className="text-sm font-black text-primary-600">{p.total}점</span>}
        />
      ))}
    </Card>
  )
}

function QuarterRank({ people, myId, lastWeek }) {
  const currentQ = QUARTERS.find(x => lastWeek >= x.from && lastWeek <= x.to)?.q ?? 1
  const [q, setQ] = useState(currentQ)
  const range = QUARTERS[q - 1]
  const scored = people.map(p => {
    const total = Object.entries(p.weekly)
      .filter(([w]) => w >= range.from && w <= range.to)
      .reduce((s, [, v]) => s + v, 0)
    return { ...p, qTotal: total }
  }).filter(p => p.qTotal > 0)
  const avg = scored.length ? scored.reduce((s, p) => s + p.qTotal, 0) / scored.length : 0
  const list = withRanks(scored.sort((a, b) => b.qTotal - a.qTotal), 'qTotal')

  return (
    <Card className="flex flex-col gap-1 px-2">
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">분기 순위 · 평균 {Math.round(avg)}점</p>
        <div className="flex gap-1">
          {QUARTERS.map(x => (
            <button
              key={x.q}
              onClick={() => setQ(x.q)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-black ${q === x.q ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-400'}`}
            >{x.q}Q</button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-gray-300 font-bold px-2 pb-1">{range.from}~{range.to}주차</p>
      {list.length === 0 && <p className="text-center text-xs text-gray-400 py-6">이 분기 기록이 없어요</p>}
      {list.map(p => {
        const diff = Math.round(p.qTotal - avg)
        return (
          <RankRow
            key={p.key}
            rank={p.rank}
            p={p}
            isMe={p.teacherId === myId}
            right={
              <>
                <p className="text-sm font-black text-primary-600">{p.qTotal}점</p>
                <p className={`text-[10px] font-black ${diff >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>평균 {diff >= 0 ? '+' : ''}{diff}</p>
              </>
            }
          />
        )
      })}
    </Card>
  )
}

function WeeklyTable({ people, lastWeek }) {
  const rows = []
  for (let w = lastWeek; w >= 1; w--) {
    const entries = people.map(p => ({ name: p.name, s: p.weekly[w] || 0 })).filter(e => e.s > 0)
    if (entries.length === 0) continue
    const max = Math.max(...entries.map(e => e.s))
    rows.push({
      w,
      count: entries.length,
      avg: Math.round(entries.reduce((a, e) => a + e.s, 0) / entries.length),
      max,
      top: entries.filter(e => e.s === max).map(e => e.name),
    })
  }
  return (
    <Card className="flex flex-col px-3">
      <div className="grid grid-cols-[44px_36px_40px_40px_1fr] gap-1 text-[10px] font-black text-gray-400 pb-2 border-b border-gray-50">
        <span>주차</span><span className="text-right">인원</span><span className="text-right">평균</span><span className="text-right">최고</span><span className="pl-2">최고점</span>
      </div>
      {rows.length === 0 && <p className="text-center text-xs text-gray-400 py-6">기록이 없어요</p>}
      {rows.map(r => (
        <div key={r.w} className="grid grid-cols-[44px_36px_40px_40px_1fr] gap-1 py-2 text-xs border-b border-gray-50 last:border-0">
          <span className="font-black text-gray-700">{r.w}주</span>
          <span className="text-right font-bold text-gray-500">{r.count}</span>
          <span className="text-right font-bold text-gray-500">{r.avg}</span>
          <span className="text-right font-black text-primary-600">{r.max}</span>
          <span className="pl-2 font-bold text-gray-600 truncate">{r.top.join(', ')}</span>
        </div>
      ))}
    </Card>
  )
}

function MyTrend({ me, lastWeek }) {
  if (!me) return <Card className="py-10 text-center text-sm text-gray-400">내 기록이 아직 없어요</Card>
  const weeks = Array.from({ length: lastWeek }, (_, i) => lastWeek - i)
  const max = Math.max(150, ...Object.values(me.weekly))
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">내 주차별 점수</p>
        <p className="text-xs font-black text-primary-600">누적 {me.total}점 · {me.weeks}주 참여</p>
      </div>
      {weeks.map(w => {
        const s = me.weekly[w] || 0
        return (
          <div key={w} className="flex items-center gap-2">
            <span className="w-9 text-[11px] font-black text-gray-400">{w}주</span>
            <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden">
              <div className="h-full bg-primary-400 rounded-full" style={{ width: `${(s / max) * 100}%` }} />
            </div>
            <span className={`w-9 text-right text-[11px] font-black ${s ? 'text-gray-700' : 'text-gray-200'}`}>{s}</span>
          </div>
        )
      })}
    </Card>
  )
}
