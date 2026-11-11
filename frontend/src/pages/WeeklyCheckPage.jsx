import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useIsMutating } from '@tanstack/react-query'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import Header from '../components/layout/Header'
import FeatureIcon from '../components/common/FeatureIcon'
import SegmentedControl from '../components/common/SegmentedControl'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import QueryNotice from '../components/common/QueryNotice'
import { ProgressFill, Reveal } from '../components/common/Motion'
import useWeeklyTasks from '../hooks/useWeeklyTasks'
import useTtsAttention from '../hooks/useTtsAttention'
import useToday from '../hooks/useToday'
import AttentionDot from '../components/common/AttentionDot'
import { ttsApi } from '../api/tts'
import { toApiDate, getCurrentWeekRange, getWeekStartByOffset } from '../utils/date'
import { knownQuery } from '../utils/checkProgress'

const STATE_LABEL = { done: '완료', pending: '미완료', unknown: '확인 필요', none: '대상 없음' }

export default function WeeklyCheckPage() {
  const [filter, setFilter] = useState('all')
  const { tasks, reads, summary } = useWeeklyTasks()
  const ttsAttention = useTtsAttention()
  useToday()
  const sunday = toApiDate(getWeekStartByOffset(0, 0))
  const savingTts = useIsMutating({ mutationKey: ['tts-answer'] }) > 0
  const tts = useQuery({ queryKey: ['tts-week', sunday], enabled: !savingTts,
    queryFn: () => ttsApi.getWeek(sunday).then(r => r.data), staleTime: 60_000 })
  const failedReads = reads.filter(q => q.isError)
  const visibleTasks = tasks.filter(t => filter === 'all' || (filter === 'done' ? t.state === 'done' : ['pending', 'unknown'].includes(t.state)))

  return (
    <div className="min-h-screen pb-10">
      <Header title="주간 체크" />
      <div className="space-y-5 px-4 py-5">
        <Reveal>
          <section className="brand-card ui-stat-panel">
            <p className="text-xs text-gray-500">{getCurrentWeekRange()}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <div><h2 className="text-sm font-semibold tracking-tight">{summary.allDone ? '이번 주 제출 완료' : '이번 주 제출 현황'}</h2>
                <p className="ui-stat-note min-h-5" role="status">{reads.some(q => q.isFetching) ? '확인 중…' : summary.unknown ? `확인 필요 ${summary.unknown}개` : ''}</p></div>
              <p className="shrink-0 ui-stat-value text-primary-800">{summary.done}<span className="text-sm font-medium text-gray-400"> / {summary.total}</span></p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="주간 제출 완료" aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.done}>
              <ProgressFill ratio={summary.total ? summary.done / summary.total : 0} className="bg-primary-600" />
            </div>
          </section>
        </Reveal>
        {!!failedReads.length && <QueryNotice queries={failedReads} label="주간 체크 기록" />}
        <section>
          <SegmentedControl label="체크 상태 필터" value={filter} onChange={setFilter}
            options={[{ value: 'all', label: '전체' }, { value: 'pending', label: '할 일' }, { value: 'done', label: '완료' }]} />
          <div className="ui-list mt-3">
            {visibleTasks.map(task => <Link key={task.id} to={task.path} className="brand-action ui-list-row motion-tap relative">
              <AttentionDot show={task.state === 'pending'} label="아직 제출하지 않았어요" />
              <span className="brand-action-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><FeatureIcon path={task.path} /></span>
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{task.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${task.state === 'done' ? 'bg-secondary-50 text-secondary-700' : task.state === 'unknown' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{STATE_LABEL[task.state]}</span>
              </span><span className="mt-1.5 block text-xs leading-relaxed text-gray-500">{task.desc}</span></span>
              {task.state === 'done' ? <CheckCircle2 size={18} className="shrink-0 text-secondary-600" /> : <ChevronRight size={17} className="shrink-0 text-gray-400" />}
            </Link>)}
            {!visibleTasks.length && <p role="status" className="p-6 text-center text-sm text-gray-500">{filter === 'done' ? '아직 완료된 항목이 없어요.' : '남은 제출 항목이 없어요.'}</p>}
          </div>
        </section>
        <section>
          <h2 className="ui-section-title mb-3 px-1">매일 이어가는 TTS</h2>
          <Link to="/tts" className="brand-action ui-list ui-list-row motion-tap relative">
            <AttentionDot show={ttsAttention.pending} label="오늘 영성체크가 남았어요" />
            <span className="brand-action-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><FeatureIcon path="/tts" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{savingTts ? 'TTS 저장 중' : knownQuery(tts) ? `이번 주 ${tts.data?.score ?? 0}점` : 'TTS 기록 확인'}</span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">하루씩 기록해요 · 제출 완료 개수에 포함되지 않아요</span></span>
            <ChevronRight size={17} className="shrink-0 text-gray-400" />
          </Link>
          <QueryRefreshNotice queries={[tts]} label="TTS 기록" />
        </section>
      </div>
    </div>
  )
}
