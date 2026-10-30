import { useQuery, useQueries } from '@tanstack/react-query'
import { addDays, startOfWeek } from 'date-fns'
import useAuthStore from '../store/authStore'
import useToday from './useToday'
import { weeklyStatusApi } from '../api/weeklyStatus'
import { eventApi } from '../api/event'
import { prayerVoteApi } from '../api/prayerVote'
import { classesApi } from '../api/classes'
import client from '../api/client'
import { toApiDate } from '../utils/date'
import { eventCheckState, summarizeChecks } from '../utils/checkProgress'
import { knownRead, attendanceTaskState, minutesTaskState } from '../utils/attention'
import { ttsToday } from '../utils/ttsPeriod'
import { eventAttendanceState, eventToday } from '../utils/eventAttendance'

const checkState = (query, done) => knownRead(query) ? (done ? 'done' : 'pending') : 'unknown'

export default function useWeeklyTasks() {
  const { user, apiEnvironment } = useAuthStore()
  const today = useToday(ttsToday)
  const eventDate = useToday(eventToday)
  const date = new Date(today + 'T12:00:00')
  const sunday = toApiDate(startOfWeek(date, { weekStartsOn: 0 }))
  const monday = startOfWeek(date, { weekStartsOn: 1 })
  const weekMonday = toApiDate(monday)
  const satDate = toApiDate(addDays(monday, 5))
  const fresh = { staleTime: 60_000, refetchInterval: 60_000, enabled: !!user,
    refetchOnMount: 'always', refetchOnWindowFocus: 'always' }
  const prayer = useQuery({ ...fresh, queryKey: ['prayer-vote', weekMonday, user?.id],
    queryFn: () => prayerVoteApi.getMine(weekMonday).then(r => r.data) })
  const meeting = useQuery({ ...fresh, queryKey: ['meeting-attendance', satDate, user?.id],
    queryFn: () => client.get(`/meetings/attendance?date=${satDate}`).then(r => r.data) })
  const weekly = useQuery({ ...fresh, queryKey: ['weekly-status', sunday, user?.id],
    queryFn: () => weeklyStatusApi.getStatus().then(r => r.data) })
  const minutes = useQuery({ ...fresh, queryKey: ['meeting-minutes', apiEnvironment, user?.id],
    queryFn: ({ signal }) => client.get('/minutes', { signal }).then(r => r.data) })
  const classes = useQuery({ ...fresh, queryKey: ['my-classes', user?.id],
    queryFn: () => classesApi.getMyClasses().then(r => r.data) })
  const eventQuery = useQuery({ ...fresh, queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data) })
  const events = (eventQuery.data || []).filter(e => eventAttendanceState(e, eventDate) === 'open')
  const teacherEvents = events.filter(e => ['BOTH', 'TEACHER_ONLY'].includes(e.attendanceTarget))
  const studentEvents = events.filter(e => !e.attendanceTarget || ['BOTH', 'STUDENT_ONLY'].includes(e.attendanceTarget))
  const teacherQueries = useQueries({ queries: teacherEvents.map(e => ({ ...fresh,
    queryKey: ['event-teacher-attendance', e.id, user?.id],
    queryFn: () => eventApi.getMyTeacherAttendance(e.id).then(r => r.data),
  })) })
  const studentQueries = useQueries({ queries: studentEvents.map(e => ({ ...fresh,
    queryKey: ['event-attendance', e.id, user?.id],
    queryFn: () => eventApi.getMyClassAttendance(e.id).then(r => r.data),
  })) })
  const eventReads = [eventQuery, ...teacherQueries, ...studentQueries]
  const eventState = eventReads.every(knownRead) ? eventCheckState(eventQuery, events,
    new Map(teacherEvents.map((e, i) => [e.id, teacherQueries[i]])),
    new Map(studentEvents.map((e, i) => [e.id, studentQueries[i]]))) : 'unknown'
  const tasks = [
    { id: 'attendance', title: '우리 반 출석', desc: '담임·부담임 공동 출결보고', path: '/attendance', state: attendanceTaskState(weekly, classes) },
    { id: 'prayer', title: '기도모임 투표', desc: '이번 주 참석 여부', path: '/meeting/prayer', state: checkState(prayer, !!prayer.data) },
    { id: 'meeting', title: '교사회의 체크', desc: '이번 주 교사회의 참석', path: '/meeting/sat', state: checkState(meeting, !!meeting.data?.status) },
    { id: 'minutes', title: '회의록 및 영상', path: '/minutes',
      desc: weekly.data?.currentWeekMinutesExists ? '회의 내용과 영상 확인' : '회의록 등록 대기',
      state: minutesTaskState(minutes, today) },
    { id: 'event', title: '행사 출석', desc: eventState === 'none' ? '현재 제출할 행사 없음' : '내 출석과 우리 반 참석',
      path: events.length === 1 ? `/event-attendance/${events[0].id}` : '/event-attendance', state: eventState },
  ]
  const reads = [weekly, classes, prayer, meeting, minutes, ...eventReads]
  return { tasks, reads, summary: summarizeChecks(tasks),
    needsAction: path => tasks.some(t => t.state === 'pending' &&
      (t.path === path || (path === '/event-attendance' && t.id === 'event'))) }
}
