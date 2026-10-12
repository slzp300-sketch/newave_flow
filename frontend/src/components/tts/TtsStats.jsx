import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { addDays, addWeeks, format, startOfWeek } from 'date-fns'
import { ttsApi } from '../../api/tts'
import useAuthStore from '../../store/authStore'
import Card from '../common/Card'
import QueryNotice from '../common/QueryNotice'
import { ProgressFill } from '../common/Motion'
import { ttsReadState } from '../../utils/ttsQuery'
import { ttsYear, ttsYears, defaultQuarter, quartersForYear, quarterDateLabel, quarterPeople } from '../../utils/ttsPeriod'
import { elapsedWeeks, scoreSummary, rankedPeople, filterPeople } from '../../utils/ttsStats'
import { weekLabelsByNum, formatUpdatedAt } from '../../utils/date'

const DAYS = ['월', '화', '수', '목', '금', '토']
const scoreText = value => value == null ? '기록 없음' : `${value}점`
const weekRange = (year, week) => {
  const sunday = addWeeks(startOfWeek(new Date(year, 0, 1), { weekStartsOn: 0 }), week - 1)
  return `${format(sunday, 'M/d')}~${format(addDays(sunday, 6), 'M/d')}`
}

export default function TtsStats() {
  const { user } = useAuthStore()
  const [year, setYear] = useState(ttsYear)
  const [quarter, setQuarter] = useState(() => defaultQuarter(ttsYear()))
  const [view, setView] = useState('weekly')
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [focusKey, setFocusKey] = useState(null)
  const range = quartersForYear(year).find(x => x.q === quarter)
  const stats = useQuery({ queryKey: ['tts-stats', year], queryFn: () => ttsApi.getStats(year).then(r => r.data) })
  const people = useMemo(() => quarterPeople(stats.data?.people || [], year, quarter), [stats.data, year, quarter])
  const weeks = elapsedWeeks(year, range, stats.data?.currentWeek)
  const week = weeks.includes(selectedWeek) ? selectedWeek : weeks[0]
  const openWeek = (w, personKey = null) => { setSelectedWeek(w); setFocusKey(personKey); setView('weekly') }
  const resetPeriod = () => { setSelectedWeek(null); setFocusKey(null) }

  return <div className="px-4 py-4 flex flex-col gap-4">
    <div className="flex items-center gap-2">
      <select aria-label="통계 연도" value={year} onChange={e => {
        const next = Number(e.target.value); setYear(next); setQuarter(defaultQuarter(next)); resetPeriod()
      }} className="rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm font-semibold">
        {ttsYears().map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      <div className="flex flex-1 gap-1">{quartersForYear(year).map(q => <button key={q.q}
        aria-pressed={quarter === q.q} onClick={() => { setQuarter(q.q); resetPeriod() }}
        className={`flex-1 min-h-11 rounded-xl text-sm font-medium ${quarter === q.q ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{q.q}분기</button>)}</div>
    </div>
    <p className="text-xs text-gray-500">{quarterDateLabel(year, quarter)}</p>
    <div className="grid grid-cols-3 rounded-xl bg-gray-100 p-1 gap-1">
      {[['weekly', '주간 상세'], ['quarter', '분기 순위'], ['mine', '내 추이']].map(([key, label]) => <button key={key}
        aria-pressed={view === key} onClick={() => setView(key)}
        className={`motion-tap min-h-11 rounded-lg text-sm font-semibold ${view === key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>{label}</button>)}
    </div>
    {!ttsReadState([stats]).hasData ? <QueryNotice queries={[stats]} label="TTS 통계 기록" /> : <>
      {stats.isError && <QueryNotice queries={[stats]} label="최신 TTS 통계 기록" />}
      {weeks.length === 0 ? <Empty>아직 시작하지 않은 분기입니다.</Empty> : view === 'weekly' ? <WeeklyDetail key={`${year}-${quarter}`}
        year={year} week={week} weeks={weeks} onWeek={w => { setSelectedWeek(w); setFocusKey(null) }} myId={user?.id} focusKey={focusKey} />
        : view === 'quarter' ? <QuarterSummary key={`${year}-${quarter}`} people={people} year={year} weeks={weeks} myId={user?.id} onWeek={openWeek} />
        : <PersonalTrend people={people} year={year} weeks={weeks} myId={user?.id} onWeek={openWeek} />}
    </>}
  </div>
}

function Empty({ children }) { return <Card className="py-10 text-center text-sm text-gray-500">{children}</Card> }
function Metrics({ people, value }) {
  const summary = scoreSummary(people, value)
  return <div className="grid grid-cols-3 gap-2">
    {[[scoreText(summary.average), '기록 평균'], [`${summary.participating}/${people.length}명`, '점수 있는 인원'], [scoreText(summary.highest), '최고 점수']].map(([number, label]) =>
      <div key={label} className="rounded-2xl bg-primary-50 border border-primary-100 py-4 px-1 text-center">
        <p className="text-lg font-semibold tabular-nums text-primary-900">{number}</p><p className="mt-1 text-xs text-gray-600">{label}</p>
      </div>)}
    <p className="col-span-3 text-xs text-gray-500 leading-relaxed">현재 필터 기준 · 기록 {summary.recorded}명 · 평균은 0점 기록을 포함하고 ‘기록 없음’은 제외합니다.</p>
  </div>
}

function Filters({ people, filters, onChange }) {
  const grades = [...new Set(people.map(p => p.grade).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
  return <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3"><Search size={16} className="text-gray-400" />
      <input aria-label="교사 이름 검색" placeholder="이름으로 찾기" value={filters.search}
        onChange={e => onChange({ ...filters, search: e.target.value })} className="w-full min-w-0 bg-transparent py-3 text-sm outline-none" />
    </label>
    <div className="flex gap-2">
      <select aria-label="소속 필터" value={filters.grade} onChange={e => onChange({ ...filters, grade: e.target.value })} className="min-w-0 flex-1 rounded-xl bg-white border border-gray-200 p-3 text-sm">
        <option value="">전체 소속</option>{grades.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <select aria-label="통계 정렬" value={filters.sort} onChange={e => onChange({ ...filters, sort: e.target.value })} className="rounded-xl bg-white border border-gray-200 p-3 text-sm">
        <option value="score">점수순</option><option value="name">이름순</option>
      </select>
    </div>
  </div>
}

function WeeklyDetail({ year, week, weeks, onWeek, myId, focusKey }) {
  const [filters, setFilters] = useState({ grade: '', search: '', sort: 'score' })
  const query = useQuery({ queryKey: ['tts-week-stats', year, week],
    queryFn: () => ttsApi.getWeekStats(year, week).then(r => r.data), refetchInterval: 60_000 })
  const state = ttsReadState([query])
  const people = filterPeople(rankedPeople(query.data?.people || []), filters)
  const index = weeks.indexOf(week)
  return <>
    <div className="flex gap-2 items-center">
      <button aria-label="통계 이전 주" disabled={index === weeks.length - 1} onClick={() => onWeek(weeks[index + 1])} className="p-3 bg-white border border-gray-200 rounded-xl disabled:opacity-30"><ChevronLeft size={18} /></button>
      <select aria-label="상세 조회 주차" value={week} onChange={e => onWeek(Number(e.target.value))} className="flex-1 min-w-0 rounded-xl bg-white border border-gray-200 px-2 py-3 text-sm font-semibold">
        {weeks.map(w => <option key={w} value={w}>{weekLabelsByNum(year, w).monthWeek} · {weekRange(year, w)}</option>)}
      </select>
      <button aria-label="통계 다음 주" disabled={index === 0} onClick={() => onWeek(weeks[index - 1])} className="p-3 bg-white border border-gray-200 rounded-xl disabled:opacity-30"><ChevronRight size={18} /></button>
    </div>
    {!state.hasData ? <QueryNotice queries={[query]} label="주간 상세 내역" /> : <>
      {query.isError && <QueryNotice queries={[query]} label="최신 주간 상세 내역" />}
      <Metrics people={people} />
      <Filters people={query.data.people} filters={filters} onChange={setFilters} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">이름을 누르면 항목별 내역이 펼쳐져요.</p>
        <button onClick={() => query.refetch()} disabled={query.isFetching} aria-label="주간 통계 새로고침" className="p-2 text-primary-700 disabled:opacity-40"><RefreshCw size={16} /></button>
      </div>
      {query.data.importedPeriod && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">시트에서 확정한 주간 총점입니다. 요일·항목별 내역은 원본에 없어 제공하지 않습니다.</p>}
      <div className="flex flex-col gap-2">{people.map(p => <PersonDetail key={`${week}-${p.key}-${focusKey || ''}`} person={p} myId={myId}
        imported={query.data.importedPeriod} maxScore={query.data.maxScore} defaultOpen={p.key === focusKey} />)}</div>
      {!people.length && <Empty>조건에 맞는 교사가 없습니다.</Empty>}
      <p className="text-xs text-gray-400 text-center" role="status">{query.isFetching ? '최신 기록 확인 중…' : query.isError ? '이전에 확인한 기록을 표시하고 있어요.' : `${format(new Date(query.dataUpdatedAt), 'HH:mm')} 확인 · 1분마다 갱신`}</p>
    </>}
  </>
}

function PersonDetail({ person: p, myId, imported, maxScore, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const detailId = useId()
  return <article className={`rounded-2xl border overflow-hidden ${p.teacherId === myId ? 'border-primary-200 bg-primary-50/40' : 'border-gray-200 bg-white'}`}>
    <button className="w-full p-4 text-left" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen(!open)}>
      <div className="flex gap-3 items-center">
        <span className="w-5 text-center text-xs text-gray-400 font-semibold">{p.rank ?? '—'}</span>
        <div className="flex-1 min-w-0"><p className="text-sm font-semibold break-words">{p.name}{p.teacherId === myId && <span className="ml-1.5 text-xs text-primary-600">나</span>}</p><p className="text-xs text-gray-500 mt-0.5">{p.grade}</p></div>
        <span className="text-sm font-semibold text-primary-700 tabular-nums">{scoreText(p.score)}</span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {!imported && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 pl-8 text-xs text-gray-500">{p.items.map(item =>
        <span key={item.questionId}>{item.title.replace(/\s*\(.+\)$/, '')} <strong className="font-medium text-gray-700">{item.type === 'DAYS' && !item.linked ? `${item.days.length}/6` : item.checked ? '✓' : '—'}</strong></span>)}</div>}
    </button>
    {open && <div id={detailId} className="motion-fade border-t border-gray-100 px-4 pb-4 pt-3">
      {imported ? <p className="text-xs text-gray-500 leading-relaxed">{p.score == null ? '원본 시트의 점수 칸이 비어 있습니다.' : `시트 확정 총점 ${p.score}점`} · 세부 체크 내역 없음</p> : <>
        {p.score == null && <p className="text-xs text-gray-500 mb-3">아직 저장된 체크나 자동 반영된 참석 기록이 없습니다.</p>}
        <div className="flex flex-col gap-4">{p.items.map(item => <div key={item.questionId}>
          <div className="flex items-start gap-2 justify-between"><p className="text-sm font-medium break-keep">{item.title}<span className="ml-1 text-xs text-gray-400">{item.linked ? '자동 반영' : !item.active ? '이전 항목' : ''}</span></p><p className="text-xs text-primary-700 whitespace-nowrap">{item.score} / {item.points * (item.type === 'DAYS' && !item.linked ? 6 : 1)}점</p></div>
          {item.type === 'DAYS' && !item.linked ? <div className="grid grid-cols-6 gap-1 mt-2">{DAYS.map(day => {
            const checked = item.days.includes(day)
            return <span key={day} aria-label={`${item.title} ${day} ${checked ? '체크됨' : '체크 안 됨'}`} className={`text-center rounded-lg py-2 text-xs ${checked ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{day}<span className="block mt-1" aria-hidden="true">{checked ? '✓' : '—'}</span></span>
          })}</div> : <p className={`mt-1 text-xs ${item.checked ? 'text-primary-700' : 'text-gray-500'}`}>{item.checked ? '✓ 참석 체크됨' : '— 참석 체크 없음'}</p>}
        </div>)}</div>
        {!p.items.length && <p className="text-xs text-gray-500">등록된 체크 항목이 없습니다.</p>}
        <p className="border-t border-gray-100 pt-3 mt-4 text-xs text-gray-500 leading-relaxed">해당 주 배점 기준 · {maxScore}점 만점{p.updatedAt ? ` · 직접 체크 수정 ${formatUpdatedAt(p.updatedAt)}` : ''}</p>
      </>}
    </div>}
  </article>
}

function QuarterSummary({ people, year, weeks, myId, onWeek }) {
  const [filters, setFilters] = useState({ grade: '', search: '', sort: 'score' })
  const total = p => Object.keys(p.weekly).length ? p.total : null
  const filtered = filterPeople(rankedPeople(people, total), filters)
  return <>
    <Metrics people={filtered} value={total} />
    <Filters people={people} filters={filters} onChange={setFilters} />
    <p className="text-xs text-gray-500">이름을 펼친 뒤 주차를 누르면 그 주의 세부 내역을 볼 수 있어요.</p>
    {filtered.map(p => <details key={p.key} className={`rounded-2xl border p-4 ${p.teacherId === myId ? 'border-primary-200 bg-primary-50/40' : 'border-gray-200 bg-white'}`}>
      <summary className="cursor-pointer text-sm font-semibold"><span className="text-gray-400 mr-2">{p.rank ?? '—'}</span>{p.name}{p.teacherId === myId ? ' · 나' : ''}<span className="float-right text-primary-700">{scoreText(total(p))}</span></summary>
      <p className="mt-2 text-xs text-gray-500">{p.grade} · {p.weeks}주 점수 있음 · 기록 {Object.keys(p.weekly).length}주{Object.keys(p.weekly).length ? ` · 기록 주 평균 ${Math.round(p.total / Object.keys(p.weekly).length)}점` : ''}</p>
      <div className="flex flex-col mt-3 border-t border-gray-100">{weeks.map(w => <WeekScore key={w} year={year} week={w} person={p} onClick={() => onWeek(w, p.key)} />)}</div>
    </details>)}
    {!filtered.length && <Empty>조건에 맞는 교사가 없습니다.</Empty>}
    <Card><h3 className="text-sm font-semibold mb-3">주차별 요약</h3><div className="space-y-2">{weeks.map(w => {
      const summary = scoreSummary(filtered, p => p.weekly[w])
      return <button key={w} onClick={() => onWeek(w)} className="w-full flex justify-between gap-2 text-left rounded-xl bg-gray-50 px-3 py-3 text-xs">
        <span>{weekLabelsByNum(year, w).monthWeek}<span className="block text-gray-400 mt-1">{weekRange(year, w)}</span></span>
        <span className="text-right">평균 {scoreText(summary.average)}<span className="block text-gray-500 mt-1">참여 {summary.participating}명 · 최고 {scoreText(summary.highest)} ›</span></span>
      </button>
    })}</div></Card>
  </>
}

function WeekScore({ year, week, person, onClick }) {
  const score = person.weekly[week]
  return <button onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left text-xs border-b border-gray-100 last:border-0">
    <span className="flex-1">{weekLabelsByNum(year, week).monthWeek}<span className="block text-gray-400 mt-1">{weekRange(year, week)}{person.sheetWeeks?.includes(week) ? ' · 시트' : ''}</span></span>
    <span className="font-semibold text-primary-700">{scoreText(score)}</span><ChevronRight size={14} className="text-gray-400" />
  </button>
}

function PersonalTrend({ people, year, weeks, myId, onWeek }) {
  const me = people.find(p => p.teacherId === myId)
  if (!me) return <Empty>내 기록이 아직 없습니다.</Empty>
  const count = Object.keys(me.weekly).length
  const max = Math.max(1, ...Object.values(me.weekly))
  return <>
    <Card className="!bg-primary-50 !border-primary-100"><p className="text-sm text-primary-800">나의 {year}년 분기 기록</p>
      <p className="mt-3 text-3xl font-semibold text-primary-900">{scoreText(count ? me.total : null)}</p>
      <p className="mt-2 text-xs text-gray-600">기록 {count}주 · 점수 있는 주 {me.weeks}주{count ? ` · 주 평균 ${Math.round(me.total / count)}점` : ''}</p>
    </Card>
    <Card><h3 className="text-sm font-semibold">주차별 점수와 체크 내역</h3><p className="text-xs text-gray-500 mt-1 mb-3">주차를 누르면 내 요일·항목별 체크로 이어집니다.</p>
      {weeks.map(w => <div key={w}><WeekScore year={year} week={w} person={me} onClick={() => onWeek(w, me.key)} />
        <div className="h-1 rounded-full overflow-hidden bg-gray-100"><ProgressFill ratio={(me.weekly[w] ?? 0) / max} className="bg-primary-500" /></div>
      </div>)}
    </Card>
  </>
}
