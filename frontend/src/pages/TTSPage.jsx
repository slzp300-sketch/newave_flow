import { useState, useMemo, useSyncExternalStore, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, useIsMutating, onlineManager } from '@tanstack/react-query'
import { Reveal, AnimatedValue, ProgressFill, SelectionMark } from '../components/common/Motion'
import { addDays, format } from 'date-fns'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import WeekNavigator from '../components/common/WeekNavigator'
import { getWeekStartByOffset, toApiDate, weekLabels } from '../utils/date'
import { ttsApi } from '../api/tts'
import QueryNotice from '../components/common/QueryNotice'
import { ttsReadState, ttsAnswerOptions } from '../utils/ttsQuery'
import SegmentedControl from '../components/common/SegmentedControl'
import TtsStats from '../components/tts/TtsStats'
import { firstTtsOffset } from '../utils/ttsPeriod'
import useToday from '../hooks/useToday'
import { todayTtsChecks } from '../utils/attention'
import AttentionDot from '../components/common/AttentionDot'
import FeatureIcon from '../components/common/FeatureIcon'

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
        <SegmentedControl label="TTS 보기" value={tab} onChange={setTab}
          options={[{ value: 'check', label: '내 체크' }, { value: 'stats', label: '통계 · 상세' }]} />
      </div>
      <div key={tab} className="motion-fade">{tab === 'check' ? <CheckTab /> : <TtsStats />}</div>
    </div>
  )
}

/* ───────────────────────── 내 체크 ───────────────────────── */

// embedded: 홈 화면에 넣을 때 — 이번 주만 보여주고 주 이동 버튼은 숨긴다
export function CheckTab({ embedded = false }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const detailId = useId()
  const todayStr = useToday()
  const saving = useIsMutating({ mutationKey: ['tts-answer'] }) > 0
  const offline = useSyncExternalStore(onlineManager.subscribe, () => !onlineManager.isOnline())
  const sunday    = getWeekStartByOffset(offset, 0)
  const weekStart = toApiDate(sunday)
  const weekKey   = ['tts-week', weekStart]

  const questionsQuery = useQuery({
    queryKey: ['tts-questions', weekStart],
    queryFn: () => ttsApi.getQuestions(weekStart).then(r => r.data),
  })

  const weekQuery = useQuery({
    queryKey: weekKey,
    enabled: !saving,
    queryFn: () => ttsApi.getWeek(weekStart).then(r => r.data),
  })

  const questions = questionsQuery.data || []
  const week = weekQuery.data
  const reads = [questionsQuery, weekQuery]
  const readState = ttsReadState(reads)
  const ready = readState.editable
  const mutationOptions = useMemo(() => ttsAnswerOptions(queryClient,
    payload => ttsApi.saveAnswer(payload).then(r => r.data)), [queryClient])
  const { mutate: saveAnswer } = useMutation({
    ...mutationOptions,
    onError: (err, intent) => {
      mutationOptions.onError(err, intent)
      setSaveError(err.response?.data?.message || '저장하지 못한 체크를 되돌렸어요. 연결을 확인하고 다시 체크해 주세요.')
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

  const currentAnswer = q => parseAnswer(q, queryClient.getQueryData(weekKey)?.answers
    ?.find(a => a.questionId === q.id)?.answerData)
  const toggleDay = (q, day) => {
    if (!ready || offline) return
    setSaveError('')
    saveAnswer({ weekStart, questionId: q.id, day, checked: !currentAnswer(q)?.[day] })
  }
  const toggleAttend = q => {
    if (!ready || offline) return
    setSaveError('')
    saveAnswer({ weekStart, questionId: q.id, checked: currentAnswer(q) !== true })
  }

  // 매일 항목은 한 카드의 표로, 참석·자동 반영 항목은 아래 목록으로 (색은 항목 순서대로)
  const withColor      = questions.map((q, i) => ({ q, color: PALETTE[i % PALETTE.length] }))
  const dayQuestions   = withColor.filter(({ q }) => isDaily(q))
  const otherQuestions = withColor.filter(({ q }) => !isDaily(q))

  const labels = weekLabels(sunday)

  const remainingToday = todayIdx >= 0
    ? questions.filter(q => q.type === 'DAYS' && !isLinked(q) && !answers[q.id]?.[DAYS[todayIdx]])
    : []
  const todayChecks = todayTtsChecks(questions, week, todayStr)

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

      {readState.hasData && (readState.error || readState.paused || saveError || offline) && (
        <div className={embedded ? 'mb-3' : 'px-4 mb-3'}>
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {offline ? (saving ? '연결을 기다리고 있어요. 아직 저장이 완료되지 않았습니다.' : '인터넷 연결을 확인해 주세요. 체크를 잠시 멈췄어요.') : saveError || '최신 기록을 확인할 수 없어 체크를 잠시 멈췄어요.'}
            {(readState.error || readState.paused) && <button className="block mt-2 font-semibold underline" onClick={() => reads.forEach(q => q.refetch())}>다시 불러오기</button>}
          </div>
        </div>
      )}
      {!readState.hasData ? (
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
          {embedded ? <section aria-label="오늘의 영성체크" className="brand-card relative rounded-2xl border border-primary-200 p-4">
            <AttentionDot show={ready && todayChecks.length > 0 && (saving || todayChecks.some(c => !c.checked))} label="오늘 영성체크가 남았어요" />
            <div className="flex items-center justify-between gap-2 pr-2">
              <h2 className="flex items-center gap-2 text-base font-semibold"><FeatureIcon path="/tts" size={24} />오늘의 영성체크</h2>
              <span className="shrink-0 text-xs text-gray-500">{format(new Date(todayStr + 'T12:00:00'), 'M.d')}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {todayChecks.map(({ q, day, checked }) => <button key={q.id} type="button" aria-pressed={checked}
                disabled={!ready || offline} onClick={() => day ? toggleDay(q, day) : toggleAttend(q)}
                aria-label={`오늘 ${q.title}`} className={`relative flex min-h-24 flex-col items-start gap-1 rounded-xl border p-3 text-left ${checked ? 'text-white border-primary-600' : 'border-primary-200'}`}>
                <AttentionDot show={ready && !checked} label="아직 체크하지 않았어요" />
                <span className="flex w-full items-center justify-between gap-2 pr-1"><span className="font-semibold text-sm break-keep">{splitTitle(q.title)[0]}</span>{checked && <SelectionMark size={18} />}</span>
                {splitTitle(q.title)[1] && <span className="text-xs">{splitTitle(q.title)[1]}</span>}
                <span className="mt-auto text-xs">{checked ? '체크됨' : '탭해서 체크'}</span>
              </button>)}
            </div>
            {!todayChecks.length && <p className="mt-3 text-sm text-gray-500">오늘 직접 체크할 항목이 없어요. 이번 주 기록을 확인해 주세요.</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <p>이번 주 <strong className="text-primary-700">{score}</strong> / {maxScore}점</p>
              <p role="status" aria-live="polite">{offline ? (saving ? '연결 대기 · 미저장' : '연결 확인 필요') : saving ? '저장 중…' : saveError ? '저장 실패 확인' : !ready ? '연결 확인 필요' : readState.refreshing ? '최신 기록 확인 중…' : todayChecks.length > 0 && todayChecks.every(c => c.checked) ? '오늘 체크 저장 완료' : '자동 저장'}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)} className="min-h-11 flex-1 rounded-xl border border-primary-200 px-2 text-xs">{expanded ? '이번 주 접기' : '이번 주 펼치기'}</button>
              <button type="button" onClick={() => navigate('/tts')} className="min-h-11 flex-1 rounded-xl border border-primary-200 px-2 text-xs">기록 · 통계</button>
            </div>
          </section> : <ScoreCard
            compact={embedded}
            saveStatus={offline ? (saving ? '연결 대기 · 미저장' : '연결 확인 필요') : saving ? '저장 중…' : saveError ? '저장 실패 확인' : readState.error || readState.paused ? '연결 확인 필요' : readState.refreshing ? '최신 기록 확인 중…' : '자동 저장'}
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
          />}

          <div id={detailId} hidden={embedded && !expanded} className="space-y-3">
          {dayQuestions.length > 0 && (
            <DayGrid
              items={dayQuestions}
              answers={answers}
              dayLabel={(i) => format(addDays(sunday, i + 1), 'M.d')}
              isFuture={(i) => dayDate(i) > todayStr}
              todayIdx={todayIdx}
              onToggle={toggleDay}
              disabled={!ready || offline}
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
                      disabled={!isLinked(q) && (!ready || offline)}
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
                    disabled={!ready || offline}
                    sub="탭해서 체크"
                    onClick={() => toggleAttend(q)}
                  />
                ))}
              </div>
              )}
            </Card>
          )}

          </div>
          {!embedded && (
            <p className="text-xs text-gray-400 font-medium text-center mt-1">
              지난 주 기록도 언제든 고칠 수 있어요. 아직 오지 않은 요일은 체크할 수 없어요.
            </p>
          )}
        </div>
      )}
    </>
  )
}
function ScoreCard({ score, maxScore, weekLabel, items, message, saveStatus }) {
  const ratio = maxScore ? Math.min(score / maxScore, 1) : 0
  return (
    <Reveal className="brand-card rounded-2xl border border-primary-100 bg-primary-50 p-5">
      <div className="flex justify-between gap-3 items-center text-sm">
        <h2 className="font-medium text-primary-800">{weekLabel} 점수</h2>
        <span className="text-xs text-gray-500" role="status" aria-live="polite"><span key={saveStatus} className="motion-fade inline-flex items-center gap-1">{saveStatus}</span></span>
      </div>
      <p className="mt-3"><strong className="text-4xl font-semibold tabular-nums"><AnimatedValue value={score} /></strong><span className="ml-2 text-sm text-gray-500">/ {maxScore}점</span></p>
      <div className="h-1.5 rounded-full bg-primary-100 overflow-hidden mt-3">
        <ProgressFill className="bg-secondary-600" ratio={ratio} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {items.map(({ q, done, total }) => <p key={q.id} className="text-xs text-gray-600">{splitTitle(q.title)[0]} <span className="font-semibold text-gray-900">{done}/{total}</span></p>)}
      </div>
      {message && <p className={`mt-3 text-sm break-keep ${message.done ? 'text-secondary-700' : 'text-primary-800'}`}>{message.text}</p>}
      {items.length === 0 && <p className="mt-3 text-sm text-gray-500">등록된 체크 항목이 없습니다.</p>}
    </Reveal>
  )
}

// Labels above controls keep weekdays readable on narrow phones.
function DayGrid({ items, answers, dayLabel, isFuture, todayIdx, onToggle, disabled }) {
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
                    <button disabled={future || disabled} onClick={() => onToggle(q, day)}
                      aria-label={q.title + ' ' + day + (future ? ' (아직 체크할 수 없음)' : '')} aria-pressed={done}
                      className={'tts-day w-full flex items-center justify-center border transition-colors ' + (done ? 'bg-primary-600 border-primary-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-300') + (future ? ' opacity-40' : '') + (i === todayIdx && !done ? ' ring-1 ring-primary-600' : '')}>
                      {done ? <SelectionMark /> : <span aria-hidden="true">—</span>}
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
function CheckRow({ q, color, checked, sub, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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
        {checked && <SelectionMark size={16} className="text-white" />}
      </span>
    </button>
  )
}

// 홈용 참석·자동 반영 항목 작은 타일 (2칸 배치)
function CheckTile({ q, color, checked, onClick, disabled }) {
  return (
    <button aria-pressed={checked}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all active:scale-[0.97] ${checked ? color.soft : 'bg-gray-50'}`}
    >
      <span className="text-base flex-shrink-0">{q.emoji}</span>
      <span className="flex-1 min-w-0 text-xs font-bold text-gray-900 truncate">{q.title}</span>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${checked ? color.fill : 'bg-white border-2 border-gray-200'}`}>
        {checked && <SelectionMark size={12} className="text-white" />}
      </span>
    </button>
  )
}
