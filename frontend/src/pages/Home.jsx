import { useSyncExternalStore } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { onlineManager, useQuery } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import SegmentedControl from '../components/common/SegmentedControl'
import MenuGrid from '../components/common/MenuGrid'
import ManagementMenu from '../components/common/ManagementMenu'
import { Reveal } from '../components/common/Motion'
import useAuthStore from '../store/authStore'
import useWeeklyTasks from '../hooks/useWeeklyTasks'
import useWeeklyEvents from '../hooks/useWeeklyEvents'
import useTtsAttention from '../hooks/useTtsAttention'
import useToday from '../hooks/useToday'
import { ttsToday } from '../utils/ttsPeriod'
import { knownRead, hasRotationThisWeek } from '../utils/attention'
import useManagementMenuGroups from '../hooks/useManagementMenuGroups'
import { evangelismApi } from '../api/evangelism'
import { PERSONAL_GROUPS } from '../utils/menuGroups'

const ROLES = { TEACHER: '교사', EXECUTIVE: '임원', PASTOR: '목사', ADMIN: '관리자' }
export default function Home() {
  const user = useAuthStore(s => s.user)
  const managementGroups = useManagementMenuGroups()
  const [params, setParams] = useSearchParams()
  const hasManagement = managementGroups.length > 0
  const view = hasManagement && params.get('view') === 'management' ? 'management' : 'personal'
  const changeView = next => {
    const updated = new URLSearchParams(params)
    if (next === 'management') updated.set('view', next)
    else updated.delete('view')
    setParams(updated, { replace: true })
  }
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
  return <div className="home-page min-h-screen bg-gray-50/50 pb-6">
    <Header title="Newave Flow" />
    <div className="px-4 py-4 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-lg font-bold text-gray-900">{user?.name}님 <span className="text-sm font-normal text-gray-600">{ROLES[user?.role]}</span></h2>
        <span className="text-sm text-gray-600 tabular-nums">{today.slice(5).replace('-', '.')}</span>
      </div>
      {hasManagement && <div className="home-scope" data-home-scope={view}>
        <SegmentedControl label="홈 메뉴" value={view} onChange={changeView}
          options={[{ value: 'personal', label: '나의 활동' }, { value: 'management', label: '관리' }]} />
      </div>}
      {view === 'personal' && <>
      {(!online || failed) && <div role="status" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
        <p>{!online ? '오프라인 · 제출 상태를 확인할 수 없어요.' : '일부 제출 상태를 불러오지 못했어요.'}</p>
        {online && <button type="button" className="mt-1 min-h-11 text-sm font-semibold" onClick={() => {
          reads.filter(q => q.isError || q.fetchStatus === 'paused').forEach(q => { void q.refetch() })
          if (schedule.readError) schedule.retryReads()
        }}>다시 확인</button>}
      </div>}
      {PERSONAL_GROUPS.map((group, index) => <Reveal key={group.title} delay={index * .03}>
        <section className="home-personal-section" data-feature-tone={group.tone} aria-label={group.title}>
          <h2 className="home-group-title">{group.title}</h2>
          <MenuGrid items={group.items} states={states} />
        </section>
      </Reveal>)}
      </>}
      {view === 'management' && <ManagementMenu groups={managementGroups}
        action={['ADMIN', 'PASTOR'].includes(user?.role) && <Link to="/admin" className="home-overview-link motion-tap">관리 현황<span aria-hidden="true">›</span></Link>} />}

    </div>
  </div>
}
