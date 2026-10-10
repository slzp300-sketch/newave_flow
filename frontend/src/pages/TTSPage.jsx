import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Trophy, BarChart3, TrendingUp, ListOrdered } from 'lucide-react'
import { addDays, format } from 'date-fns'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import WeekNavigator from '../components/common/WeekNavigator'
import useAuthStore from '../store/authStore'
import { getWeekStartByOffset, toApiDate, weekLabels, weekLabelsByNum } from '../utils/date'
import { ttsApi } from '../api/tts'

export const DAYS = ['월', '화', '수', '목', '금', '토']
const LINK_PATH = { SAT_MEETING: '/meeting/sat', PRAYER_MEETING: '/meeting/prayer' }
const LINK_LABEL = { SAT_MEETING: '교사회의 체크', PRAYER_MEETING: '기도모임 투표' }
const QUARTERS = [
  { q: 1, from: 1, to: 13 },
  { q: 2, from: 14, to: 26 },
  { q: 3, from: 27, to: 39 },
  { q: 4, from: 40, to: 53 },
]

// 서버 TtsService.pointsOf 와 같은 규칙 (점수 미지정이면 매일 항목 5점, 참석 항목 10점)
export const pointsOf = (q) => q.points ?? (q.type === 'DAYS' ? 5 : 10)
export const isLinked = (q) => q.linkType && q.linkType !== 'NONE'
export const maxOf = (q) => q.type === 'DAYS' ? pointsOf(q) * DAYS.length : pointsOf(q)
const isDaily = (q) => q.type === 'DAYS' && !isLinked(q)
// '말씀 (3장 이상)' → ['말씀', '3장 이상'] : 좁은 칸에서는 괄호 안을 작은 글씨로 내린다
const splitTitle = (t = '') => { const m = t.match(/^(.*?)\s*\((.+)\)\s*$/); return m ? [m[1], m[2]] : [t, ''] }

// 항목별 색 (찬양팀 영성체크처럼 항목마다 색을 달리한다)
const PALETTE = [
  { dot: 'bg-emerald-500', fill: 'bg-emerald-600', soft: 'bg-emerald-50', text: 'text-emerald-600' },
  { dot: 'bg-violet-500',  fill: 'bg-violet-500',  soft: 'bg-violet-50',  text: 'text-violet-600' },
  { dot: 'bg-orange-500',  fill: 'bg-orange-500',  soft: 'bg-orange-50',  text: 'text-orange-600' },
  { dot: 'bg-rose-500',    fill: 'bg-rose-500',    soft: 'bg-rose-50',    text: 'text-rose-600' },
  { dot: 'bg-sky-500',     fill: 'bg-sky-500',     soft: 'bg-sky-50',     text: 'text-sky-600' },
  { dot: 'bg-amber-500',   fill: 'bg-amber-500',   soft: 'bg-amber-50',   text: 'text-amber-600' },
]

export function parseAnswer(q, raw) {
  if (q.type === 'ATTEND') return raw === 'true'
  try { return JSON.parse(raw) || {} } catch { return {} }
}

export function calcScore(questions, answers, linked) {
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

// embedded: 홈 화면에 넣을 때 — 이번 주만 보여주고 주 이동 버튼은 숨긴다
export function CheckTab({ embedded = false }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const sunday    = getWeekStartByOffset(offset, 0)
  const weekStart = toApiDate(sunday)
  const todayStr  = toApiDate()
  const weekKey   = ['tts-week', weekStart]

  const { data: questions = [], isLoading: qLoading } = useQuery({
    queryKey: ['tts-questions', weekStart],
    queryFn: () => ttsApi.getQuestions(weekStart).then(r => r.data),
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

  // 매일 항목은 한 카드의 표로, 참석·자동 반영 항목은 아래 목록으로 (색은 항목 순서대로)
  const withColor      = questions.map((q, i) => ({ q, color: PALETTE[i % PALETTE.length] }))
  const dayQuestions   = withColor.filter(({ q }) => isDaily(q))
  const otherQuestions = withColor.filter(({ q }) => !isDaily(q))

  const labels = weekLabels(sunday)

  const remainingToday = todayIdx >= 0
    ? questions.filter(q => q.type === 'DAYS' && !isLinked(q) && !answers[q.id]?.[DAYS[todayIdx]])
    : []

  return (
    <>
      {!embedded && <div className="px-4 py-3">
        <WeekNavigator
          offset={offset}
          onChange={setOffset}
          title={`${labels.monthWeek} TTS`}
          sub={labels.yearWeek}
          range={`${format(sunday, 'M/d')} ~ ${format(addDays(sunday, 6), 'M/d')} · 탭하면 바로 저장돼요`}
        />
      </div>}

      {qLoading || wLoading ? (
        <div className="py-16 flex justify-center">
          <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className={`${embedded ? '' : 'px-4 '}flex flex-col gap-3`}>
          <ScoreCard
            compact={embedded}
            range={`${format(sunday, 'M/d')} ~ ${format(addDays(sunday, 6), 'M/d')}`}
            score={score}
            maxScore={maxScore}
            weekLabel={labels.monthWeek}
            items={withColor.map(({ q, color }) => ({
              q,
              color,
              done: isLinked(q) ? (linked[q.id] ? 1 : 0)
                : q.type === 'ATTEND' ? (answers[q.id] === true ? 1 : 0)
                : DAYS.filter(d => answers[q.id]?.[d]).length,
              total: isDaily(q) ? DAYS.length : 1,
            }))}
            message={
              maxScore > 0 && score >= maxScore ? { done: true, text: '이번 주 만점이에요! 수고했어요' }
              : offset === 0 && todayIdx >= 0 ? (remainingToday.length
                ? { done: false, text: `오늘(${DAYS[todayIdx]}) 남은 체크: ${remainingToday.map(q => embedded ? splitTitle(q.title)[0] : q.title).join(', ')}` }
                : { done: true, text: `오늘(${DAYS[todayIdx]}) 체크를 모두 마쳤어요` })
              : null
            }
          />

          {dayQuestions.length > 0 && (
            <DayGrid
              items={dayQuestions}
              answers={answers}
              dayLabel={(i) => format(addDays(sunday, i + 1), 'M.d')}
              isFuture={(i) => dayDate(i) > todayStr}
              todayIdx={todayIdx}
              onToggle={toggleDay}
            />
          )}

          {otherQuestions.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="font-black text-gray-900 text-sm">예배 · 모임</p>
                <p className="text-[11px] font-bold text-gray-400">참석하면 체크</p>
              </div>
              {embedded ? (
                <div className="grid grid-cols-2 gap-2">
                  {otherQuestions.map(({ q, color }) => (
                    <CheckTile
                      key={q.id}
                      q={q}
                      color={color}
                      checked={isLinked(q) ? !!linked[q.id] : answers[q.id] === true}
                      onClick={() => isLinked(q) ? navigate(LINK_PATH[q.linkType]) : toggleAttend(q)}
                    />
                  ))}
                </div>
              ) : (
              <div className="flex flex-col gap-2">
                {otherQuestions.map(({ q, color }) => isLinked(q) ? (
                  <CheckRow
                    key={q.id}
                    q={q}
                    color={color}
                    checked={!!linked[q.id]}
                    sub={`${LINK_LABEL[q.linkType]}에서 자동 반영 ›`}
                    onClick={() => navigate(LINK_PATH[q.linkType])}
                  />
                ) : (
                  <CheckRow
                    key={q.id}
                    q={q}
                    color={color}
                    checked={answers[q.id] === true}
                    sub="탭해서 체크"
                    onClick={() => toggleAttend(q)}
                  />
                ))}
              </div>
              )}
            </Card>
          )}

          {embedded ? (
            <button onClick={() => navigate('/tts')} className="text-[11px] text-primary-600 font-bold text-center mt-1">
              지난 주 기록 수정 · 통계는 TTS 화면에서 →
            </button>
          ) : (
            <p className="text-[11px] text-gray-400 font-medium text-center mt-1">
              지난 주 기록도 언제든 고칠 수 있어요. 아직 오지 않은 요일은 체크할 수 없어요.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function ScoreCard({ compact, range, score, maxScore, weekLabel, items, message }) {
  const r = 36
  const c = 2 * Math.PI * r
  const ratio = maxScore ? Math.min(score / maxScore, 1) : 0
  const full  = maxScore > 0 && score >= maxScore
  // 홈용: 점수 한 줄 + 진행 막대 + 남은 체크 한 줄 (항목별 점수는 아래 표·타일에서 보인다)
  if (compact) return (
    <Card>
      <div className="flex items-end justify-between gap-2">
        <p className="leading-none">
          <span className="text-2xl font-black text-gray-900">{score}</span>
          <span className="text-xs font-bold text-gray-400"> / {maxScore}점</span>
        </p>
        <p className="text-[11px] font-bold text-gray-400">
          <span className="font-black text-primary-500">{weekLabel}</span> · {range}
        </p>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${full ? 'bg-emerald-500' : 'bg-primary-500'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {message && (
        <p className={`mt-2.5 text-[11px] font-bold break-keep ${message.done ? 'text-primary-600' : 'text-amber-600'}`}>
          {message.done ? '🎉 ' : '⏰ '}{message.text}
        </p>
      )}
    </Card>
  )
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
            <circle cx="42" cy="42" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle
              cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
              className={`${full ? 'text-emerald-600' : 'text-primary-500'} transition-all duration-500`}
              strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-black text-gray-900 leading-none">{score}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">/ {maxScore}점</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-primary-500">{weekLabel} 점수</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
            {items.map(({ q, color, done, total }) => (
              <div key={q.id} className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                <span className="text-[11px] font-bold text-gray-500 truncate flex-1">{splitTitle(q.title)[0]}</span>
                <span className="text-[11px] font-black text-gray-900 flex-shrink-0">{done}/{total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {message && (
        <div className={`mt-4 px-4 py-3 rounded-2xl text-xs font-bold break-keep ${
          message.done ? 'bg-gradient-to-r from-primary-50 to-rose-50 text-primary-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {message.done ? '🎉 ' : '⏰ '}{message.text}
        </div>
      )}
    </Card>
  )
}

// 매일 항목: 요일을 열로, 항목을 행으로 한 표. 체크하면 칸이 항목 색으로 채워진다
function DayGrid({ items, answers, dayLabel, isFuture, todayIdx, onToggle }) {
  const pts = [...new Set(items.map(({ q }) => pointsOf(q)))]
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="font-black text-gray-900 text-sm">매일 체크</p>
        <p className="text-[11px] font-bold text-gray-400">하루 각 {pts.join('·')}점</p>
      </div>
      <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))] gap-1.5 items-center">
        <div />
        {DAYS.map((day, i) => (
          <div key={day} className="text-center leading-tight">
            <p className={`text-[11px] font-black ${i === todayIdx ? 'text-primary-600' : day === '토' ? 'text-blue-400' : 'text-gray-500'}`}>{day}</p>
            <p className="text-[9px] font-bold text-gray-300">{dayLabel(i)}</p>
          </div>
        ))}
        {items.map(({ q, color }) => (
          <DayRow key={q.id} q={q} color={color} value={answers[q.id] || {}} isFuture={isFuture} todayIdx={todayIdx} onToggle={onToggle} />
        ))}
      </div>
    </Card>
  )
}

function DayRow({ q, color, value, isFuture, todayIdx, onToggle }) {
  return (
    <>
      <div className="min-w-0">
        <p className="text-xs font-black text-gray-900 truncate">{splitTitle(q.title)[0]}</p>
        {splitTitle(q.title)[1] && <p className="text-[9px] font-bold text-gray-400 truncate">{splitTitle(q.title)[1]}</p>}
      </div>
      {DAYS.map((day, i) => {
        const done   = !!value[day]
        const future = isFuture(i)
        return (
          <button
            key={day}
            disabled={future}
            onClick={() => onToggle(q, day)}
            aria-label={`${q.title} ${day}`}
            className={`aspect-square rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              done ? color.fill : 'bg-gray-100'
            } ${future ? 'opacity-30' : ''} ${i === todayIdx && !done ? 'ring-2 ring-amber-300' : ''}`}
          >
            {done && <Check size={16} strokeWidth={3} className="text-white" />}
          </button>
        )
      })}
    </>
  )
}

// 참석·자동 반영 항목 한 줄
function CheckRow({ q, color, checked, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-[0.98] ${checked ? color.soft : 'bg-gray-50'}`}
    >
      <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-lg flex-shrink-0 shadow-sm">{q.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-gray-900 truncate">{q.title}</p>
        <p className="text-[11px] font-medium text-gray-400 truncate">{sub}</p>
      </div>
      <span className={`text-xs font-black flex-shrink-0 ${checked ? color.text : 'text-gray-300'}`}>+{pointsOf(q)}</span>
      <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${checked ? color.fill : 'bg-white border-2 border-gray-200'}`}>
        {checked && <Check size={16} strokeWidth={3} className="text-white" />}
      </span>
    </button>
  )
}

// 홈용 참석·자동 반영 항목 작은 타일 (2칸 배치)
function CheckTile({ q, color, checked, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all active:scale-[0.97] ${checked ? color.soft : 'bg-gray-50'}`}
    >
      <span className="text-base flex-shrink-0">{q.emoji}</span>
      <span className="flex-1 min-w-0 text-xs font-black text-gray-900 truncate">{q.title}</span>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${checked ? color.fill : 'bg-white border-2 border-gray-200'}`}>
        {checked && <Check size={12} strokeWidth={3} className="text-white" />}
      </span>
    </button>
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
        <QuarterRank year={year} people={people} myId={user?.id} lastWeek={lastWeek} />
      ) : view === 'weekly' ? (
        <WeeklyTable year={year} people={people} lastWeek={lastWeek} />
      ) : (
        <MyTrend year={year} me={me} lastWeek={lastWeek} />
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

function QuarterRank({ year, people, myId, lastWeek }) {
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
      <p className="text-[10px] text-gray-300 font-bold px-2 pb-1">{weekLabelsByNum(year, range.from).monthWeek} ~ {weekLabelsByNum(year, range.to).monthWeek}</p>
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

function WeeklyTable({ year, people, lastWeek }) {
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
      <div className="grid grid-cols-[64px_32px_36px_36px_1fr] gap-1 text-[10px] font-black text-gray-400 pb-2 border-b border-gray-50">
        <span>주차</span><span className="text-right">인원</span><span className="text-right">평균</span><span className="text-right">최고</span><span className="pl-2">최고점</span>
      </div>
      {rows.length === 0 && <p className="text-center text-xs text-gray-400 py-6">기록이 없어요</p>}
      {rows.map(r => (
        <div key={r.w} className="grid grid-cols-[64px_32px_36px_36px_1fr] gap-1 py-2 text-xs border-b border-gray-50 last:border-0">
          <span className="font-black text-gray-700">{weekLabelsByNum(year, r.w).monthWeek}</span>
          <span className="text-right font-bold text-gray-500">{r.count}</span>
          <span className="text-right font-bold text-gray-500">{r.avg}</span>
          <span className="text-right font-black text-primary-600">{r.max}</span>
          <span className="pl-2 font-bold text-gray-600 truncate">{r.top.join(', ')}</span>
        </div>
      ))}
    </Card>
  )
}

function MyTrend({ year, me, lastWeek }) {
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
            <span className="w-16 flex-shrink-0 text-[11px] font-black text-gray-400">{weekLabelsByNum(year, w).monthWeek}</span>
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
