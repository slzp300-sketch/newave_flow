import { memo, useCallback, useState, useMemo, useSyncExternalStore, useEffect, useRef, useId } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useQuery, useMutation, useQueryClient, useIsMutating, useMutationState, onlineManager } from '@tanstack/react-query'
import { ttsFeedbackIndex, ttsCompletionMessage } from '../utils/ttsFeedback'
import { Reveal, AnimatedValue, ProgressFill, SelectionMark, Collapse, Disclosure } from '../components/common/Motion'
import { addDays, addWeeks, format, startOfWeek } from 'date-fns'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import WeekNavigator from '../components/common/WeekNavigator'
import { toApiDate, weekLabels } from '../utils/date'
import { ttsApi } from '../api/tts'
import QueryNotice from '../components/common/QueryNotice'
import { ttsReadState, ttsAnswerOptions } from '../utils/ttsQuery'
import SegmentedControl from '../components/common/SegmentedControl'
import TtsStats from '../components/tts/TtsStats'
import HomeTtsSummary from '../components/tts/HomeTtsSummary'
import { firstTtsOffset, ttsToday } from '../utils/ttsPeriod'
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
  { dot: 'bg-primary-600', fill: 'bg-secondary-700', soft: 'bg-secondary-50', text: 'text-secondary-700' },
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
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'stats' ? 'stats' : 'check'
  const setTab = value => setParams(previous => {
    const next = new URLSearchParams(previous)
    next.set('tab', value)
    if (value === 'check') next.delete('view')
    return next
  }, { replace: true })
  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="TTS" showBack />
      <div className="px-4 pt-3">
        <SegmentedControl label="TTS 보기" value={tab} onChange={setTab}
          options={[{ value: 'check', label: '내 체크' }, { value: 'stats', label: '분기 순위' }]} />
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
  const [showEditor, setShowEditor] = useState(false)
  const editorRef = useRef(null)
  const editorButtonRef = useRef(null)
  const editorId = useId()
  useEffect(() => {
    if (!embedded || !showEditor) return
    const frame = requestAnimationFrame(() => {
      editorRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [embedded, showEditor])
  const closeEditor = () => {
    setShowEditor(false)
    editorButtonRef.current?.focus({ preventScroll: true })
  }
  const todayStr = useToday(ttsToday)
  const saving = useIsMutating({ mutationKey: ['tts-answer'] }) > 0
  const offline = useSyncExternalStore(onlineManager.subscribe, () => !onlineManager.isOnline())
  const sunday    = addWeeks(startOfWeek(new Date(todayStr + 'T12:00:00'), { weekStartsOn: 0 }), offset)
  const weekStart = toApiDate(sunday)
  const weekKey   = ['tts-week', weekStart]
  const saveHistory = useMutationState({ filters: { mutationKey: ['tts-answer'] },
    select: mutation => ({ id: mutation.mutationId, status: mutation.state.status, variables: mutation.state.variables }) })
  const feedbackIndex = useMemo(() => ttsFeedbackIndex(saveHistory, weekStart), [saveHistory, weekStart])
  const feedback = feedbackIndex.overall
  const fieldFeedback = (id, locked = false) => offline ? { kind: 'error', text: '연결 확인 필요' }
    : readState.error || readState.paused ? { kind: 'error', text: '최신 기록 확인 필요' }
    : locked ? { kind: 'idle', text: '읽기 전용' } : feedbackIndex.questions.get(id) || { kind: 'idle', text: '탭하면 자동 저장' }

  const questionsQuery = useQuery({
    queryKey: ['tts-questions', weekStart],
    queryFn: () => ttsApi.getQuestions(weekStart).then(r => r.data),
  })

  const weekQuery = useQuery({
    queryKey: weekKey,
    enabled: !saving,
    queryFn: () => ttsApi.getWeek(weekStart).then(r => r.data),
    refetchInterval: 60_000,
  })

  const questions = questionsQuery.data || []
  const week = weekQuery.data
  const reads = [questionsQuery, weekQuery]
  const readState = ttsReadState(reads)
  const ready = readState.editable
  const editableDays = week?.editableDays || []
  const attendanceEditable = week?.attendanceEditable === true
  const quarterStart = `${todayStr.slice(0, 4)}-${String(Math.floor((Number(todayStr.slice(5,7)) - 1) / 3) * 3 + 1).padStart(2,'0')}-01`
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

  // Stable handlers keep unchanged cells memoized. Read the latest optimistic
  // cache on every tap rather than capturing an answer from the last render.
  const toggleDay = useCallback((q, day) => {
    const latest = queryClient.getQueryData(['tts-week', weekStart])
    const dayIndex = DAYS.indexOf(day)
    const date = toApiDate(addDays(new Date(weekStart + 'T12:00:00'), dayIndex + 1))
    if (!ready || offline || !isDaily(q) || dayIndex < 0 || !latest?.editableDays?.includes(day)
      || date > todayStr || date < quarterStart || latest.importedPeriod) return
    const answer = parseAnswer(q, latest.answers?.find(a => a.questionId === q.id)?.answerData)
    setSaveError('')
    saveAnswer({ weekStart, questionId: q.id, day, checked: !answer?.[day] })
  }, [queryClient, weekStart, ready, offline, todayStr, quarterStart, saveAnswer])
  const toggleAttend = useCallback(q => {
    const latest = queryClient.getQueryData(['tts-week', weekStart])
    if (!ready || offline || !latest?.attendanceEditable || latest.attendanceDate < quarterStart || latest.importedPeriod) return
    const answer = parseAnswer(q, latest.answers?.find(a => a.questionId === q.id)?.answerData)
    setSaveError('')
    saveAnswer({ weekStart, questionId: q.id, checked: answer !== true })
  }, [queryClient, weekStart, ready, offline, quarterStart, saveAnswer])
  const selectRow = useCallback(q => isLinked(q) ? navigate(LINK_PATH[q.linkType]) : toggleAttend(q), [navigate, toggleAttend])

  // 매일 항목은 한 카드의 표로, 참석·자동 반영 항목은 아래 목록으로 (색은 항목 순서대로)
  const withColor      = questions.map((q, i) => ({ q, color: PALETTE[i % PALETTE.length] }))
  const dayQuestions   = withColor.filter(({ q }) => isDaily(q))
  const otherQuestions = withColor.filter(({ q }) => !isDaily(q))
  const summaryItems = withColor.map(({ q, color }) => ({
    q, color, daily: isDaily(q),
    done: isLinked(q) ? (linked[q.id] ? 1 : 0)
      : q.type === 'ATTEND' ? (answers[q.id] === true ? 1 : 0)
      : DAYS.filter(d => answers[q.id]?.[d]).length,
    total: isDaily(q) ? DAYS.length : 1,
  }))

  const labels = weekLabels(sunday)

  const remainingToday = todayIdx >= 0
    ? questions.filter(q => q.type === 'DAYS' && !isLinked(q) && !answers[q.id]?.[DAYS[todayIdx]])
    : []
  const todayChecks = todayTtsChecks(questions, week, todayStr)
    .filter(({ day }) => day ? editableDays.includes(day) : attendanceEditable)

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
            <p className="text-xs text-gray-400 mt-1">{week.closedQuarter ? '마감된 분기로, 기록과 통계만 확인할 수 있어요.' : '수정이 필요하면 관리자에게 알려 주세요.'}</p>
          </Card>
        </div>
      ) : (
        <div className={`${embedded ? '' : 'px-4 '}flex flex-col gap-3`}>
          {embedded ? <section aria-label="오늘의 영성체크" className="brand-card brand-card-accent relative rounded-2xl border border-primary-200 p-4">
            <AttentionDot show={ready && todayChecks.length > 0 && (saving || todayChecks.some(c => !c.checked))} label="오늘 영성체크가 남았어요" />
            <div className="flex items-center justify-between gap-2 pr-2">
              <h2 className="flex items-center gap-2 text-base font-semibold"><span className="brand-heading-icon"><FeatureIcon path="/tts" size={20} /></span>오늘의 영성체크</h2>
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
            <div className="mt-2 min-h-4 text-right text-xs text-gray-500">
              <p role="status" aria-live="polite">{offline ? (saving ? '연결 대기 · 미저장' : '연결 확인 필요') : saving ? '저장 중…' : saveError ? '저장 실패 확인' : !ready ? '연결 확인 필요' : readState.refreshing ? '최신 기록 확인 중…' : todayChecks.length > 0 && todayChecks.every(c => c.checked) ? '오늘 체크 저장 완료' : '자동 저장'}</p>
            </div>
            <HomeTtsSummary score={score} maxScore={maxScore}
              range={`${format(sunday, 'M/d')} ~ ${format(addDays(sunday, 6), 'M/d')}`}
              items={summaryItems} answers={answers}
              onToggleDay={toggleDay} disabled={!ready || offline}
              days={DAYS.map((day, i) => ({ day, date: format(addDays(sunday, i + 1), 'M/d'), future: dayDate(i) > todayStr,
                locked: !editableDays.includes(day) || dayDate(i) < quarterStart, today: i === todayIdx }))} />
            <div className="mt-3 flex gap-2">
              <button ref={editorButtonRef} type="button" aria-expanded={showEditor} aria-controls={editorId}
                onClick={() => showEditor ? closeEditor() : setShowEditor(true)}
                className={`brand-action flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border px-2 text-xs ${showEditor ? 'border-secondary-300 bg-secondary-50 text-secondary-800' : 'border-primary-200'}`}>
                {showEditor ? '이번 주 기록 닫기' : '이번 주 기록 수정'}<ChevronDown size={14} aria-hidden="true" className={`transition-transform duration-200 ${showEditor ? 'rotate-180' : ''}`} />
              </button>
              <button type="button" onClick={() => navigate('/tts?tab=stats')} className="min-h-11 flex-1 rounded-xl border border-primary-200 px-2 text-xs">분기 순위</button>
            </div>
          </section> : <ScoreCard
            compact={embedded}
            saveStatus={offline ? (saving ? '연결 대기 · 미저장' : '연결 확인 필요') : saving ? '저장 중…' : saveError || feedback.kind === 'error' ? '저장 실패 확인' : readState.error || readState.paused ? '연결 확인 필요' : readState.refreshing ? '최신 기록 확인 중…' : feedback.text}
            range={`${format(sunday, 'M/d')} ~ ${format(addDays(sunday, 6), 'M/d')}`}
            score={score}
            maxScore={maxScore}
            items={summaryItems}
            message={ttsCompletionMessage({ items: summaryItems,
              todayLabel: offset === 0 && todayIdx >= 0 ? DAYS[todayIdx] : null,
              remainingToday, saving, failed: !!saveError || feedback.kind === 'error' || !ready || offline })}
          />}

          <Collapse open={!embedded || showEditor} id={editorId} ref={editorRef} role="region" tabIndex={-1} aria-label="이번 주 기록 수정" className="scroll-mt-20 space-y-3 focus:outline-none">
          {embedded && <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="brand-section-title font-semibold">이번 주 기록 수정</h2>
            <button type="button" onClick={closeEditor} className="min-h-11 px-3 text-xs font-semibold text-primary-700">접기</button>
          </div>}
          {week?.closedQuarter && <p role="status" className="rounded-xl bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">
            마감된 분기예요. 저장된 기록과 통계만 확인할 수 있어요.
          </p>}
          {dayQuestions.length > 0 && (
            <DayGrid
              items={dayQuestions}
              answers={answers}
              dayLabel={(i) => format(addDays(sunday, i + 1), 'd')}
              isFuture={(i) => dayDate(i) > todayStr}
              isLocked={(i) => !editableDays.includes(DAYS[i]) || dayDate(i) < quarterStart}
              todayIdx={todayIdx}
              onToggle={toggleDay}
              fieldFeedback={fieldFeedback}
              disabled={!ready || offline}
            />
          )}

          {otherQuestions.length > 0 && (
            <Card>
              <div className="mb-4">
                <h2 className="brand-section-title font-bold text-gray-900 text-base">예배 · 모임</h2>
              </div>
              {!attendanceEditable && !week?.closedQuarter && <p className="mb-3 text-sm leading-relaxed text-gray-700">이 주 토요일이 속한 분기가 시작되면 체크할 수 있어요.</p>}
              <div className="flex flex-col gap-2">
                {otherQuestions.map(({ q, color }) => isLinked(q) ? (
                  <CheckRow
                    key={q.id}
                    q={q}
                    color={color}
                    checked={!!linked[q.id]}
                    sub={`${LINK_LABEL[q.linkType]}에서 자동 반영 ›`}
                    onSelect={selectRow}
                  />
                ) : (
                  <CheckRow
                    key={q.id}
                    q={q}
                    color={color}
                    checked={answers[q.id] === true}
                    disabled={!ready || offline || !attendanceEditable || week?.attendanceDate < quarterStart}
                    sub={answers[q.id] === true ? '참여 완료' : '미체크'}
                    feedbackKind={fieldFeedback(q.id, !attendanceEditable).kind}
                    feedbackText={fieldFeedback(q.id, !attendanceEditable).text}
                    onSelect={selectRow}
                  />
                ))}
              </div>
            </Card>
          )}

          <Disclosure title="이용 안내" className="rounded-xl border border-gray-200 px-4">
            <div className="space-y-2 pb-3 text-sm leading-relaxed text-gray-700">
              <p>체크한 내용은 자동 저장돼요. 예배·모임은 참여를 마친 뒤 체크해 주세요.</p>
              <p>{quarterStart.slice(5).replace('-', '/')}부터 같은 분기의 지난 기록을 수정할 수 있어요. 다음 분기가 시작되면 마감돼요.</p>
              <p>주간 항목은 이 주 토요일({format(addDays(sunday, 6), 'M/d')})이 속한 분기로 집계돼요.</p>
            </div>
          </Disclosure>
          </Collapse>
        </div>
      )}
    </>
  )
}
function ScoreCard({ score, maxScore, items, message, saveStatus }) {
  const ratio = maxScore ? Math.min(score / maxScore, 1) : 0
  return (
    <Reveal className="brand-card brand-card-accent rounded-2xl border border-primary-100 bg-primary-50 p-4">
      <div className="flex justify-between gap-3 items-center">
        <h2 className="brand-section-title text-sm font-semibold text-primary-800">주간 점수</h2>
        <p className="shrink-0"><strong className="text-2xl font-bold tabular-nums"><AnimatedValue value={score} /></strong><span className="ml-1 text-sm text-gray-600">/ {maxScore}점</span></p>
      </div>
      <div className="h-1.5 rounded-full bg-primary-100 overflow-hidden mt-2">
        <ProgressFill className="bg-secondary-600" ratio={ratio} />
      </div>
      <p className="mt-2 min-h-5 text-sm font-medium leading-5 text-gray-700" role="status" aria-live="polite">{saveStatus}</p>
      {/* Keep two lines reserved while saving: the checklist must not jump under
          a finger when completion text temporarily disappears. */}
      <p className={`mt-1 min-h-10 text-sm leading-5 break-keep ${message?.done ? 'text-secondary-700' : 'text-primary-800'}`}>{message?.text || '\u00a0'}</p>
      {items.length === 0 && <p className="mt-3 text-sm text-gray-500">등록된 체크 항목이 없습니다.</p>}
    </Reveal>
  )
}

// Date and weekday share the tap target; the today label reserves equal space.
function DayGrid({ items, answers, dayLabel, isFuture, isLocked, todayIdx, onToggle, disabled, fieldFeedback }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="brand-section-title font-semibold text-base">매일의 말씀과 기도</h2>
      </div>
      <div className="flex flex-col gap-5">
        {items.map(({ q }) => (
          <div key={q.id}>
            <div className="flex items-baseline justify-between mb-3 gap-2">
              <p className="text-base font-bold text-gray-900">{q.title}</p>
              <span className="text-sm text-gray-600 shrink-0">하루 {pointsOf(q)}점</span>
            </div>
            <div className="tts-days">
              {DAYS.map((day, i) => {
                const done = !!answers[q.id]?.[day]
                const future = isFuture(i)
                const locked = isLocked(i)
                return (
                  <DayCell key={day} q={q} day={day} label={dayLabel(i)} today={i === todayIdx}
                    done={done} future={future} locked={locked} disabled={disabled} onToggle={onToggle} />
                )
              })}
            </div>
            <SaveFeedback feedback={fieldFeedback(q.id, DAYS.every((_, i) => isLocked(i)))} />
          </div>
        ))}
      </div>
    </Card>
  )
}

const DayCell = memo(function DayCell({ q, day, label, today, done, future, locked, disabled, onToggle }) {
  return <div className="min-w-0 text-center">
    <p className="mb-1 h-5 text-xs font-bold leading-5 text-primary-800">{today ? '오늘' : '\u00a0'}</p>
    <button disabled={future || locked || disabled} onClick={() => onToggle(q, day)}
      aria-label={q.title + ' ' + day + (future ? ' (아직 체크할 수 없음)' : locked ? ' (마감)' : '')} aria-pressed={done}
      className={'tts-day w-full flex flex-col gap-2 items-center justify-center border py-2 transition-colors ' + (done ? 'bg-primary-600 border-primary-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-700') + (future ? ' opacity-40' : '') + (today && !done ? ' ring-2 ring-primary-600' : '')}>
      <span className="text-sm font-semibold whitespace-nowrap">{day} {label}</span>
      <span className="flex h-5 items-center">{done ? <TtsCheckMark /> : <span aria-hidden="true">—</span>}</span>
    </button>
  </div>
})

// Selection and score update immediately; a short CSS check stroke avoids a JS
// animation observer for every checked day in Android WebView and iOS WKWebView.
function TtsCheckMark({ size = 18, className = '' }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" className={`tts-check-mark ${className}`}>
    <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

// 참석·자동 반영 항목 한 줄
function SaveFeedback({ feedback }) {
  return <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm leading-5 ${feedback.kind === 'error' ? 'text-red-700' : feedback.kind === 'success' ? 'text-secondary-700' : 'text-gray-600'}`}>{feedback.kind === 'idle' && feedback.text === '탭하면 자동 저장' ? '' : feedback.text}</p>
}

const CheckRow = memo(function CheckRow({ q, color, checked, sub, onSelect, disabled, feedbackKind, feedbackText }) {
  return (
    <div>
    <button
      onClick={() => onSelect(q)}
      disabled={disabled}
      aria-pressed={isLinked(q) ? undefined : checked}
      data-checked={checked}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left motion-tap ${checked ? color.soft : 'bg-gray-50'}`}
    >
      <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-lg flex-shrink-0 shadow-sm">{q.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-gray-900">{q.title}</p>
        <p className="text-sm font-normal text-gray-600">{sub}</p>
      </div>
      <span className={`text-sm font-semibold flex-shrink-0 ${checked ? color.text : 'text-gray-600'}`}>+{pointsOf(q)}</span>
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${checked ? color.fill : 'bg-white border-2 border-gray-200'}`}>
        {checked && <TtsCheckMark size={16} className="text-white" />}
      </span>
    </button>
    {feedbackKind && <div className="px-3"><SaveFeedback feedback={{ kind: feedbackKind, text: feedbackText }} /></div>}
    </div>
  )
})
