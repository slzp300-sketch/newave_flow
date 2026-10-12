import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueries, useIsMutating } from '@tanstack/react-query'
import { Users, FileText, Calendar, CheckSquare, CalendarCheck, ChevronRight, CheckCircle2 } from 'lucide-react'
import Header from '../components/layout/Header'
import SegmentedControl from '../components/common/SegmentedControl'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import QueryNotice from '../components/common/QueryNotice'
import { ProgressFill, Reveal } from '../components/common/Motion'
import useAuthStore from '../store/authStore'
import { weeklyStatusApi } from '../api/weeklyStatus'
import { eventApi } from '../api/event'
import { prayerVoteApi } from '../api/prayerVote'
import { ttsApi } from '../api/tts'
import client from '../api/client'
import { toApiDate, getCurrentWeekRange, getWeekStartByOffset } from '../utils/date'
import { eventCheckState, knownQuery, summarizeChecks } from '../utils/checkProgress'
import { addDays, startOfWeek } from 'date-fns'

const checkState = (query, done) => knownQuery(query) ? (done ? 'done' : 'pending') : 'unknown'
const STATE_LABEL = { done: '완료', pending: '미완료', unknown: '확인 필요', none: '대상 없음' }

export default function WeeklyCheckPage() {
  const { user } = useAuthStore()
  const [filter, setFilter] = useState('all')
  const savingTts = useIsMutating({ mutationKey: ['tts-answer'] }) > 0
  const sunday = toApiDate(getWeekStartByOffset(0, 0))
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekMonday = toApiDate(monday)
  const satDate = toApiDate(addDays(monday, 5))
  const tts = useQuery({ queryKey: ['tts-week', sunday], enabled: !savingTts,
    queryFn: () => ttsApi.getWeek(sunday).then(r => r.data), staleTime: 60_000 })
  const prayer = useQuery({ queryKey: ['prayer-vote', weekMonday, user?.id], enabled: !!user,
    queryFn: () => prayerVoteApi.getMine(weekMonday).then(r => r.data), staleTime: 120_000 })
  const meeting = useQuery({ queryKey: ['meeting-attendance', satDate, user?.id], enabled: !!user,
    queryFn: () => client.get(`/meetings/attendance?date=${satDate}`).then(r => r.data), staleTime: 120_000 })
  const weekly = useQuery({ queryKey: ['weekly-status'],
    queryFn: () => weeklyStatusApi.getStatus().then(r => r.data), staleTime: 120_000 })
  const eventQuery = useQuery({ queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data), staleTime: 300_000 })
  const events = (eventQuery.data || []).filter(e => !e.attendanceDeadline || e.attendanceDeadline >= toApiDate())
  const teacherEvents = events.filter(e => ['BOTH', 'TEACHER_ONLY'].includes(e.attendanceTarget))
  const studentEvents = events.filter(e => !e.attendanceTarget || ['BOTH', 'STUDENT_ONLY'].includes(e.attendanceTarget))
  const teacherQueries = useQueries({ queries: teacherEvents.map(e => ({
    queryKey: ['event-teacher-attendance', e.id, user?.id], enabled: !!user,
    queryFn: () => eventApi.getMyTeacherAttendance(e.id).then(r => r.data), staleTime: 120_000,
  })) })
  const studentQueries = useQueries({ queries: studentEvents.map(e => ({
    queryKey: ['event-attendance', e.id, user?.id], enabled: !!user,
    queryFn: () => eventApi.getMyClassAttendance(e.id).then(r => r.data), staleTime: 120_000,
  })) })
  const eventState = eventCheckState(eventQuery, events,
    new Map(teacherEvents.map((e, i) => [e.id, teacherQueries[i]])),
    new Map(studentEvents.map((e, i) => [e.id, studentQueries[i]])))
  const tasks = [
    { id: 'attendance', icon: Users, title: '우리 반 출석', desc: '담임·부담임이 함께 제출하는 주일 출석', path: '/attendance',
      state: checkState(weekly, weekly.data?.attendanceSubmittedThisWeek) },
    { id: 'prayer', icon: Users, title: '기도모임 투표', desc: '온라인 기도모임 참석 여부를 알려주세요', path: '/meeting/prayer',
      state: checkState(prayer, !!prayer.data) },
    { id: 'meeting', icon: CalendarCheck, title: '교사회의 체크', desc: '토요일 교사회의 참석 기록', path: '/meeting/sat',
      state: checkState(meeting, !!meeting.data?.status) },
    ...(meeting.data?.status === 'ABSENT' ? [{ id: 'minutes', icon: FileText, title: '회의록 및 영상', path: '/minutes',
      desc: weekly.data?.currentWeekMinutesExists ? '회의 내용과 영상을 확인해 주세요' : '이번 주 회의록 등록을 기다리고 있어요',
      state: checkState(weekly, weekly.data?.currentWeekMinutesConfirmed) }] : []),
    { id: 'event', icon: Calendar, title: '행사 출석',
      desc: eventState === 'none' ? '현재 제출할 행사가 없어요' : `내 출석과 우리 반 출석 확인${events.length ? ` · ${events.length}개 행사` : ''}`,
      path: events.length === 1 ? `/event-attendance/${events[0].id}` : '/event-attendance', state: eventState },
  ]
  const summary = summarizeChecks(tasks)
  const reads = [weekly, prayer, meeting, eventQuery, ...teacherQueries, ...studentQueries]
  const failedReads = reads.filter(q => q.isError)
  const visibleTasks = tasks.filter(t => filter === 'all' || (filter === 'done' ? t.state === 'done' : ['pending', 'unknown'].includes(t.state)))

  return (
    <div className="min-h-screen pb-10">
      <Header title="주간 체크" />
      <div className="space-y-5 px-4 py-5">
        <Reveal>
          <section className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">{getCurrentWeekRange()}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div><h2 className="text-xl font-semibold tracking-tight">{summary.allDone ? '이번 주 제출 완료' : '이번 주 제출 현황'}</h2>
                <p className="mt-2 text-sm text-gray-500" role="status">{reads.some(q => q.isFetching) ? '최신 제출 상태를 확인하고 있어요' : summary.unknown ? `${summary.unknown}개 항목은 상태 확인이 필요해요` : summary.allDone ? '제출한 기록도 다시 확인할 수 있어요' : `제출할 항목 ${summary.pending}개가 남았어요`}</p></div>
              <p className="shrink-0 text-2xl font-semibold tabular-nums text-primary-800">{summary.done}<span className="text-sm font-medium text-gray-400"> / {summary.total}</span></p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="주간 제출 완료" aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.done}>
              <ProgressFill ratio={summary.total ? summary.done / summary.total : 0} className="bg-primary-600" />
            </div>
          </section>
        </Reveal>
        {!!failedReads.length && <QueryNotice queries={failedReads} label="주간 체크 기록" />}
        <section>
          <SegmentedControl label="체크 상태 필터" value={filter} onChange={setFilter}
            options={[{ value: 'all', label: '전체' }, { value: 'pending', label: '할 일' }, { value: 'done', label: '완료' }]} />
          <div className="ui-list mt-3">
            {visibleTasks.map(task => <Link key={task.id} to={task.path} className="ui-list-row motion-tap">
              <span className="ui-list-icon"><task.icon size={20} /></span>
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{task.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${task.state === 'done' ? 'bg-emerald-50 text-emerald-700' : task.state === 'unknown' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{STATE_LABEL[task.state]}</span>
              </span><span className="mt-1.5 block text-xs leading-relaxed text-gray-500">{task.desc}</span></span>
              {task.state === 'done' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : <ChevronRight size={17} className="shrink-0 text-gray-400" />}
            </Link>)}
            {!visibleTasks.length && <p role="status" className="p-6 text-center text-sm text-gray-500">{filter === 'done' ? '아직 완료된 항목이 없어요.' : '남은 제출 항목이 없어요.'}</p>}
          </div>
        </section>
        <section>
          <h2 className="ui-section-title mb-3 px-1">매일 이어가는 TTS</h2>
          <Link to="/tts" className="ui-list ui-list-row motion-tap">
            <span className="ui-list-icon"><CheckSquare size={21} /></span>
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
