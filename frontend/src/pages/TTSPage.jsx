import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query'
import { Check, Trophy, BarChart3, TrendingUp } from 'lucide-react'
import { addDays, format } from 'date-fns'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import WeekNavigator from '../components/common/WeekNavigator'
import useAuthStore from '../store/authStore'
import { getWeekStartByOffset, toApiDate, weekLabels, weekLabelsByNum } from '../utils/date'
import { ttsApi } from '../api/tts'
import QueryNotice from '../components/common/QueryNotice'
import { queryReadState } from '../utils/queryReadState'
import { ttsYear, ttsYears, defaultQuarter, quartersForYear, quarterDateLabel, quarterPeople, firstTtsOffset } from '../utils/ttsPeriod'

export const DAYS = ['월', '화', '수', '목', '금', '토']
const LINK_PATH = { SAT_MEETING: '/meeting/sat', PRAYER_MEETING: '/meeting/prayer' }
const LINK_LABEL = { SAT_MEETING: '교사회의 체크', PRAYER_MEETING: '기도모임 투표' }

// 서버 TtsService.pointsOf 와 같은 규칙 (점수 미지정이면 매일 항목 5점, 참석 항목 10점)
export const pointsOf = (q) => q.points ?? (q.type === 'DAYS' ? 5 : 10)
export const isLinked = (q) => q.linkType && q.linkType !== 'NONE'
export const maxOf = (q) => q.type === 'DAYS' ? pointsOf(q) * DAYS.length : pointsOf(q)
const isDaily = (q) => q.type === 'DAYS' && !isLinked(q)
// '말씀 (3장 이상)' → ['말씀', '3장 이상'] : 좁은 칸에서는 괄호 안을 작은 글씨로 내린다
const splitTitle = (t = '') => { const m = t.match(/^(.*?)\s*\((.+)\)\s*$/); return m ? [m[1], m[2]] : [t, ''] }

// Actions share one brand color; check marks also communicate completion.
const PALETTE = [
  { dot: 'bg-primary-600', fill: 'bg-primary-600', soft: 'bg-primary-50', text: 'text-primary-700' },
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
          {[['check', '내 체크'], ['stats', '분기 현황']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`min-h-11 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
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

  const questionsQuery = useQuery({
    queryKey: ['tts-questions', weekStart],
    queryFn: () => ttsApi.getQuestions(weekStart).then(r => r.data),
  })

  const weekQuery = useQuery({
    queryKey: weekKey,
    queryFn: () => ttsApi.getWeek(weekStart).then(r => r.data),
  })

  const questions = questionsQuery.data || []
  const week = weekQuery.data
  const reads = [questionsQuery, weekQuery]
  const ready = queryReadState(reads) === 'ready'
  const saving = useIsMutating({ mutationKey: ['tts-answer'] }) > 0

  // 탭하면 화면에 바로 반영하고(낙관적 저장), 실패하면 원래대로 되돌린다
  const { mutate: saveAnswer } = useMutation({
    mutationKey: ['tts-answer'],
    // 빠르게 여러 칸을 탭해도 서버에는 하나씩 차례로 보낸다 (동시에 보내면 같은 주 기록이 겹쳐 실패)
    scope: { id: 'tts-answer' },
    mutationFn: (payload) => ttsApi.saveAnswer(payload).then(r => r.data),
    onMutate: async ({ weekStart: targetWeek, questionId, answerData }) => {
      const key = ['tts-week', targetWeek]
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData(key)
      queryClient.setQueryData(key, old => {
        if (!old) return old
        const others = (old.answers || []).filter(a => a.questionId !== questionId)
        return { ...old, answers: [...others, { questionId, answerData }] }
      })
      return { prev, key }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev)
      alert(err.response?.data?.message || '저장하지 못했어요. 다시 시도해 주세요.')
    },
    onSettled: (_data, _error, variables) => {
      // 연달아 탭할 때 중간 응답이 화면을 덮어쓰지 않도록 마지막 저장이 끝난 뒤에만 다시 불러온다
      if (queryClient.isMutating({ mutationKey: ['tts-answer'] }) === 1) {
        queryClient.invalidateQueries({ queryKey: ['tts-week', variables.weekStart] })
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
    if (!ready) return
    const cur  = answers[q.id] || {}
    const next = { ...cur, [day]: !cur[day] }
    saveAnswer({ weekStart, questionId: q.id, answerData: JSON.stringify(next) })
  }
  const toggleAttend = (q) => {
    if (!ready) return
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
          disabled={saving}
          minOffset={firstTtsOffset()}
          title={`${labels.monthWeek} TTS`}
          sub={labels.yearWeek}
          range={`${format(sunday, 'M/d')} ~ ${format(addDays(sunday, 6), 'M/d')}${week?.importedPeriod ? ' · 시트 확정 기록' : ''}`}
        />
      </div>}

      {!ready ? (
        <div className={embedded ? '' : 'px-4'}><QueryNotice queries={reads} label="TTS 기록" /></div>
      ) : week?.importedPeriod ? (
        <div className={embedded ? '' : 'px-4'}>
          <Card className="text-center py-6">
            <p className="text-xs font-bold text-gray-500">시트 확정 점수</p>
            <p className="text-3xl font-bold text-primary-600 mt-2">{week.importedScore != null ? `${week.importedScore}점` : '기록 없음'}</p>
            <p className="text-xs text-gray-500 mt-3">당시 주간 총점을 보존한 기록입니다.</p>
            <p className="text-xs text-gray-400 mt-1">수정이 필요하면 관리자에게 알려 주세요.</p>
          </Card>
        </div>
      ) : (
        <div className={`${embedded ? '' : 'px-4 '}flex flex-col gap-3`}>
          <ScoreCard
            compact={embedded}
            saving={saving}
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
                <p className="font-bold text-gray-900 text-sm">예배 · 모임</p>
                <p className="text-xs font-bold text-gray-400">참석하면 체크</p>
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
            <button onClick={() => navigate('/tts')} className="text-xs text-primary-600 font-bold text-center mt-1">
              지난 주 기록 수정 · 통계는 TTS 화면에서 →
            </button>
          ) : (
            <p className="text-xs text-gray-400 font-medium text-center mt-1">
              지난 주 기록도 언제든 고칠 수 있어요. 아직 오지 않은 요일은 체크할 수 없어요.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function ScoreCard({ score, maxScore, weekLabel, items, message, saving }) {
  const ratio = maxScore ? Math.min(score / maxScore, 1) : 0
  return (
    <section className="rounded-2xl border border-primary-100 bg-primary-50 p-5">
      <div className="flex justify-between gap-3 items-center text-sm">
        <h2 className="font-medium text-primary-800">{weekLabel} 점수</h2>
        <span className="text-xs text-gray-500" role="status" aria-live="polite">{saving ? '저장 중…' : '자동 저장'}</span>
      </div>
      <p className="mt-3"><strong className="text-4xl font-semibold tabular-nums">{score}</strong><span className="ml-2 text-sm text-gray-500">/ {maxScore}점</span></p>
      <div className="h-1.5 rounded-full bg-primary-100 overflow-hidden mt-3">
        <div className="h-full rounded-full bg-primary-600 transition-[width]" style={{ width: ratio * 100 + '%' }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {items.map(({ q, done, total }) => <p key={q.id} className="text-xs text-gray-600">{splitTitle(q.title)[0]} <span className="font-semibold text-gray-900">{done}/{total}</span></p>)}
      </div>
      {message && <p className="mt-3 text-sm text-primary-800 break-keep">{message.text}</p>}
      {items.length === 0 && <p className="mt-3 text-sm text-gray-500">등록된 체크 항목이 없습니다.</p>}
    </section>
  )
}

// Labels above controls keep weekdays readable on narrow phones.
function DayGrid({ items, answers, dayLabel, isFuture, todayIdx, onToggle }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="font-semibold text-base">매일의 말씀과 기도</h2>
        <span className="text-xs text-gray-500">탭하면 저장돼요</span>
      </div>
      <div className="flex flex-col gap-5">
        {items.map(({ q }) => (
          <div key={q.id}>
            <div className="flex items-baseline justify-between mb-3 gap-2">
              <p className="text-sm font-medium">{q.title}</p>
              <span className="text-xs text-gray-500 shrink-0">하루 {pointsOf(q)}점</span>
            </div>
            <div className="tts-days">
              {DAYS.map((day, i) => {
                const done = !!answers[q.id]?.[day]
                const future = isFuture(i)
                return (
                  <div key={day} className="min-w-0 text-center">
                    <p className={'text-xs mb-1 ' + (i === todayIdx ? 'text-primary-700 font-semibold' : 'text-gray-500')}>{day}</p>
                    <p className="text-xs text-gray-400 mb-2">{dayLabel(i)}</p>
                    <button disabled={future} onClick={() => onToggle(q, day)}
                      aria-label={q.title + ' ' + day + (future ? ' (아직 체크할 수 없음)' : '')} aria-pressed={done}
                      className={'tts-day w-full flex items-center justify-center border transition-colors ' + (done ? 'bg-primary-600 border-primary-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-300') + (future ? ' opacity-40' : '') + (i === todayIdx && !done ? ' !border-primary-600' : '')}>
                      {done ? <Check size={18} strokeWidth={2} /> : <span aria-hidden="true">—</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// 참석·자동 반영 항목 한 줄
function CheckRow({ q, color, checked, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isLinked(q) ? undefined : checked}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-[0.98] ${checked ? color.soft : 'bg-gray-50'}`}
    >
      <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-lg flex-shrink-0 shadow-sm">{q.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{q.title}</p>
        <p className="text-xs font-normal text-gray-500">{sub}</p>
      </div>
      <span className={`text-xs font-bold flex-shrink-0 ${checked ? color.text : 'text-gray-300'}`}>+{pointsOf(q)}</span>
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${checked ? color.fill : 'bg-white border-2 border-gray-200'}`}>
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
      <span className="flex-1 min-w-0 text-xs font-bold text-gray-900 truncate">{q.title}</span>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${checked ? color.fill : 'bg-white border-2 border-gray-200'}`}>
        {checked && <Check size={12} strokeWidth={3} className="text-white" />}
      </span>
    </button>
  )
}

/* ───────────────────────── 통계 ───────────────────────── */

function StatsTab() {
  const { user } = useAuthStore()
  const [year, setYear] = useState(ttsYear)
  const [quarter, setQuarter] = useState(() => defaultQuarter(ttsYear()))
  const [view, setView] = useState('quarter')
  const range = quartersForYear(year).find(x => x.q === quarter)

  const statsQuery = useQuery({
    queryKey: ['tts-stats', year],
    queryFn: () => ttsApi.getStats(year).then(r => r.data),
  })
  const { data } = statsQuery

  const people = useMemo(() => quarterPeople(data?.people || [], year, quarter), [data, year, quarter])

  const lastWeek = Math.min(range.to, data?.currentWeek ?? Math.max(0, ...people.flatMap(p => Object.keys(p.weekly).map(Number))))
  const me = people.find(p => p.teacherId === user?.id)

  return (
    <div className="px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <select
          value={year}
          aria-label="통계 연도"
          onChange={e => { const next = Number(e.target.value); setYear(next); setQuarter(defaultQuarter(next)) }}
          className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-sm font-bold text-gray-700"
        >
          {ttsYears().map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div className="flex-1 grid grid-cols-3 bg-gray-100 p-1 rounded-xl">
          {[
            ['quarter', '분기 순위', Trophy],
            ['weekly', '주차별', BarChart3],
            ['mine', '내 추이', TrendingUp],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`py-1.5 rounded-lg text-xs font-bold flex flex-col items-center gap-0.5 ${view === key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400'}`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {quartersForYear(year).map(x => (
          <button key={x.q} onClick={() => setQuarter(x.q)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold ${quarter === x.q ? 'bg-primary-500 text-white' : 'bg-white text-gray-500'}`}>
            {x.q}분기
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 text-center">{quarterDateLabel(year, quarter)}</p>

      {queryReadState([statsQuery]) !== 'ready' ? (
        <QueryNotice queries={[statsQuery]} label="TTS 통계" />
      ) : people.length === 0 ? (
        <Card className="py-10 text-center text-sm text-gray-400">이 분기 기록이 아직 없어요</Card>
      ) : view === 'quarter' ? (
        <QuarterRank people={people} myId={user?.id} />
      ) : view === 'weekly' ? (
        <WeeklyTable year={year} people={people} firstWeek={range.from} lastWeek={lastWeek} />
      ) : (
        <MyTrend year={year} me={me} firstWeek={range.from} lastWeek={lastWeek} />
      )}
    </div>
  )
}

function RankRow({ rank, p, isMe, right, sub }) {
  const medal = ['🥇', '🥈', '🥉'][rank - 1]
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isMe ? 'bg-primary-50 border border-primary-100' : ''}`}>
      <span className="w-7 text-center text-sm font-bold text-gray-400">{medal || rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          {p.name}{isMe && <span className="text-xs text-primary-500 ml-1">나</span>}
        </p>
        {sub && <p className="text-xs text-gray-400 font-bold">{sub}</p>}
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

function QuarterRank({ people, myId }) {
  const scored = people.filter(p => p.total > 0)
  const avg = scored.length ? scored.reduce((s, p) => s + p.total, 0) / scored.length : 0
  const list = withRanks(scored.sort((a, b) => b.total - a.total), 'total')

  return (
    <Card className="flex flex-col gap-1 px-2">
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">분기 순위 · 평균 {Math.round(avg)}점</p>
      </div>
      {list.length === 0 && <p className="text-center text-xs text-gray-400 py-6">이 분기 기록이 없어요</p>}
      {list.map(p => {
        const diff = Math.round(p.total - avg)
        return (
          <RankRow
            key={p.key}
            rank={p.rank}
            p={p}
            isMe={p.teacherId === myId}
            sub={`${p.weeks}주 참여 · 주 평균 ${Math.round(p.total / p.weeks)}점`}
            right={
              <>
                <p className="text-sm font-bold text-primary-600">{p.total}점</p>
                <p className={`text-xs font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>평균 {diff >= 0 ? '+' : ''}{diff}</p>
              </>
            }
          />
        )
      })}
    </Card>
  )
}

function WeeklyTable({ year, people, firstWeek, lastWeek }) {
  const rows = []
  for (let w = lastWeek; w >= firstWeek; w--) {
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
      <div className="grid grid-cols-[64px_32px_36px_36px_1fr] gap-1 text-xs font-bold text-gray-400 pb-2 border-b border-gray-50">
        <span>주차</span><span className="text-right">인원</span><span className="text-right">평균</span><span className="text-right">최고</span><span className="pl-2">최고점</span>
      </div>
      {rows.length === 0 && <p className="text-center text-xs text-gray-400 py-6">기록이 없어요</p>}
      {rows.map(r => (
        <div key={r.w} className="grid grid-cols-[64px_32px_36px_36px_1fr] gap-1 py-2 text-xs border-b border-gray-50 last:border-0">
          <span className="font-bold text-gray-700">{weekLabelsByNum(year, r.w).monthWeek}</span>
          <span className="text-right font-bold text-gray-500">{r.count}</span>
          <span className="text-right font-bold text-gray-500">{r.avg}</span>
          <span className="text-right font-bold text-primary-600">{r.max}</span>
          <span className="pl-2 font-bold text-gray-600 truncate">{r.top.join(', ')}</span>
        </div>
      ))}
    </Card>
  )
}

function MyTrend({ year, me, firstWeek, lastWeek }) {
  if (!me) return <Card className="py-10 text-center text-sm text-gray-400">내 기록이 아직 없어요</Card>
  const weeks = Array.from({ length: Math.max(0, lastWeek - firstWeek + 1) }, (_, i) => lastWeek - i)
  const max = Math.max(150, ...Object.values(me.weekly))
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">내 주차별 점수</p>
        <p className="text-xs font-bold text-primary-600">분기 {me.total}점 · {me.weeks}주 참여</p>
      </div>
      {weeks.map(w => {
        const s = me.weekly[w]
        return (
          <div key={w} className="flex items-center gap-2">
            <span className="w-16 flex-shrink-0 text-xs font-bold text-gray-400">{weekLabelsByNum(year, w).monthWeek}</span>
            <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden">
              <div className="h-full bg-primary-400 rounded-full" style={{ width: `${((s ?? 0) / max) * 100}%` }} />
            </div>
            <span className={`w-14 shrink-0 text-right text-xs ${s != null ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{s != null ? s : '기록 없음'}</span>
          </div>
        )
      })}
    </Card>
  )
}
