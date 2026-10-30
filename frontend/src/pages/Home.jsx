import FitLabel from '../components/common/FitLabel'
import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { onlineManager, useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import Header from '../components/layout/Header'
import FeatureIcon from '../components/common/FeatureIcon'
import AttentionDot from '../components/common/AttentionDot'
import { Reveal } from '../components/common/Motion'
import useAuthStore from '../store/authStore'
import useWeeklyTasks from '../hooks/useWeeklyTasks'
import useWeeklyEvents from '../hooks/useWeeklyEvents'
import useTtsAttention from '../hooks/useTtsAttention'
import useToday from '../hooks/useToday'
import { ttsToday } from '../utils/ttsPeriod'
import { knownRead, hasRotationThisWeek } from '../utils/attention'
import { MENU_GROUPS } from '../utils/menuGroups'
import NewFamilyEntry from '../components/NewFamilyEntry'
import { evangelismApi } from '../api/evangelism'

const PERSONAL_GROUPS = [
  { title: '체크·참여', items: [
    { to: '/tts', title: 'TTS', task: 'tts', pending: '미체크' },
    { to: '/attendance', title: '주일 출석', task: 'attendance', pending: '미제출' },
    { to: '/event-attendance', title: '행사 출석', task: 'event', pending: '미제출' },
    { to: '/meeting/prayer', title: '기도모임', task: 'prayer', pending: '미응답' },
    { to: '/meeting/sat', title: '교사회의', task: 'meeting', pending: '미응답' },
  ] },
  { title: '기록·일정', items: [
    { to: '/minutes', title: '회의록·영상', task: 'minutes', pending: '미확인' },
    { to: '/evangelism', title: '전도 로테이션', task: 'rotation' },
    { to: '/calendar', title: '행사일정', task: 'schedule' },
  ] },
  { title: '학생·반', items: [
    { to: '/roster', title: '교적부' }, { to: '/class-manage', title: '반 관리' },
  ] },
]
const ROLES = { TEACHER: '교사', EXECUTIVE: '임원', PASTOR: '목사', ADMIN: '관리자' }
const STATE_LABELS = { unknown: '확인 필요', loading: '확인 중', saving: '저장 중', done: '완료', none: '' }

function MenuGrid({ items, states = {} }) {
  return <div className="home-menu-grid">
    {items.map(item => {
      const state = states[item.task] || 'none'
      const label = state === 'pending' ? item.pending : state === 'assigned' ? '이번 주 담당'
        : state === 'new' ? '새 일정' : STATE_LABELS[state]
      return <Link key={item.to} to={item.to} className="home-menu-card brand-action motion-tap relative"
        data-menu-state={state}>
        <AttentionDot show={state === 'pending'} label="" />
        <span className="brand-action-icon flex h-11 w-11 items-center justify-center rounded-xl">
          <FeatureIcon path={item.to} size={25} />
        </span>
        <span className="w-full min-w-0 text-base font-bold"><FitLabel>{item.title}</FitLabel></span>
        {label && <span className="home-menu-status text-sm font-semibold leading-5">{label}</span>}
      </Link>
    })}
  </div>
}

export default function Home() {
  const user = useAuthStore(s => s.user)
  const today = useToday(ttsToday)
  const online = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline())
  const weekly = useWeeklyTasks()
  const tts = useTtsAttention()
  const schedule = useWeeklyEvents()
  const rotation = useQuery({ queryKey: ['evangelism-schedules-mine', user?.id, today],
    queryFn: () => evangelismApi.getMySchedules().then(r => r.data), enabled: !!user,
    staleTime: 60_000, refetchInterval: 60_000, refetchOnMount: 'always', refetchOnWindowFocus: 'always' })
  const states = Object.fromEntries(weekly.tasks.map(t => [t.id, t.state]))
  states.tts = tts.state
  states.rotation = !knownRead(rotation) ? 'unknown' : hasRotationThisWeek(rotation.data, today) ? 'assigned' : 'none'
  states.schedule = !knownRead(schedule.query) || !schedule.readsKnown ? 'unknown' : schedule.hasNew ? 'new' : 'none'
  const reads = [...weekly.reads, ...tts.reads, schedule.query, schedule.readQuery, rotation]
  const failed = reads.some(q => q.isError || q.fetchStatus === 'paused') || !!schedule.readError
  const loading = reads.some(q => q.isPending)
  // Unavailable state must never become a false red reminder or completion mark.
  for (const key of Object.keys(states)) {
    if (!online) states[key] = 'unknown'
    else if (states[key] === 'unknown' && loading && !failed) states[key] = 'loading'
  }
  const canManage = ['ADMIN', 'PASTOR', 'EXECUTIVE'].includes(user?.role)
  return <div className="min-h-screen bg-gray-50/50 pb-6">
    <Header title="Newave Flow" />
    <div className="px-4 py-4 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-lg font-bold text-gray-900">{user?.name}님 <span className="text-sm font-normal text-gray-600">{ROLES[user?.role]}</span></h2>
        <span className="text-sm text-gray-600 tabular-nums">{today.slice(5).replace('-', '.')}</span>
      </div>
      {(!online || failed) && <div role="status" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
        <p>{!online ? '오프라인 · 제출 상태를 확인할 수 없어요.' : '일부 제출 상태를 불러오지 못했어요.'}</p>
        {online && <button type="button" className="mt-1 min-h-11 text-sm font-semibold" onClick={() => {
          reads.filter(q => q.isError || q.fetchStatus === 'paused').forEach(q => { void q.refetch() })
          if (schedule.readError) schedule.retryReads()
        }}>다시 확인</button>}
      </div>}
      <NewFamilyEntry />
      {PERSONAL_GROUPS.map((group, index) => <Reveal key={group.title} delay={index * .03}>
        <section aria-label={group.title}>
          <h2 className="ui-section-title mb-3 px-1">{group.title}</h2>
          <MenuGrid items={group.items} states={states} />
        </section>
      </Reveal>)}
      {canManage && <section aria-label="관리 메뉴" className="space-y-5 border-t border-gray-200 pt-5">
        <Link to="/admin" className="brand-action flex min-h-12 items-center justify-between rounded-xl px-3 font-semibold">
          관리 현황·메뉴 검색<ChevronRight size={18} aria-hidden="true" />
        </Link>
        {MENU_GROUPS.map(group => <section key={group.title} aria-label={`관리 · ${group.title}`}>
          <h3 className="ui-section-title mb-3 px-1">{group.title}</h3>
          <MenuGrid items={group.items} />
        </section>)}
      </section>}
    </div>
  </div>
}
