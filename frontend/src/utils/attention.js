import { addDays, format, startOfWeek } from 'date-fns'

export const TTS_DAYS = ['월', '화', '수', '목', '금', '토']

// Home tracks this week's actionable gaps, not future days or linked attendance.
// Weekly manual questions have no occurrence date; their server-provided Saturday
// attribution is the conservative due date, rather than guessing from the title.
export function weeklyTtsChecks(questions, week, today) {
  if (!week || week.importedPeriod || week.closedQuarter) return []
  const sunday = startOfWeek(new Date(today + 'T12:00:00'), { weekStartsOn: 0 })
  const start = format(sunday, 'yyyy-MM-dd')
  if (week.weekStart && week.weekStart !== start) return []
  const quarterStart = `${today.slice(0, 4)}-${String(Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`
  const eligibleDays = TTS_DAYS.filter((day, i) => {
    const date = format(addDays(sunday, i + 1), 'yyyy-MM-dd')
    return date <= today && date >= quarterStart && week.editableDays?.includes(day)
  })
  return questions.filter(q => q.active !== false && (!q.linkType || q.linkType === 'NONE')).flatMap(q => {
    let value
    try { value = JSON.parse(week.answers?.find(a => a.questionId === q.id)?.answerData || 'null') } catch { value = null }
    if (q.type === 'DAYS') return eligibleDays.map(day => ({ q, day, checked: value?.[day] === true }))
    if (q.type === 'ATTEND' && week.attendanceEditable === true && week.attendanceDate
      && week.attendanceDate >= quarterStart && week.attendanceDate <= today) {
      return [{ q, day: null, checked: value === true }]
    }
    return []
  })
}

export function minutesTaskState(minutes, today) {
  if (!knownRead(minutes) || !Array.isArray(minutes.data)) return 'unknown'
  const relevant = minutes.data.filter(m => m.isActive === true && m.attendanceStatus === 'ABSENT'
    && m.meetingDate && m.meetingDate <= today)
  if (!relevant.length) return 'none'
  return relevant.every(m => m.confirmed === true) ? 'done' : 'pending'
}

export function hasRotationThisWeek(schedules, today) {
  const start = startOfWeek(new Date(today + 'T12:00:00'), { weekStartsOn: 1 })
  const from = format(start, 'yyyy-MM-dd')
  const to = format(addDays(start, 6), 'yyyy-MM-dd')
  return schedules.some(s => ['SCHEDULED', 'ACTIVE'].includes(s.status)
    && s.scheduledDate >= from && s.scheduledDate <= to)
}

// Home reminders follow today's editable fields, never future days or linked records.
export function todayTtsChecks(questions, week, today) {
  if (!week || week.importedPeriod) return []
  const index = new Date(today + 'T12:00:00').getDay()
  if (week.closedQuarter || (index === 0 && week.attendanceEditable === false)
    || (index > 0 && Array.isArray(week.editableDays) && !week.editableDays.includes(TTS_DAYS[index - 1]))) return []
  return questions.filter(q => (!q.linkType || q.linkType === 'NONE') &&
    (index === 0 ? q.type === 'ATTEND' : q.type === 'DAYS')).map(q => {
    const raw = week.answers?.find(a => a.questionId === q.id)?.answerData
    let value
    try { value = JSON.parse(raw || 'null') } catch { value = null }
    const day = index === 0 ? null : TTS_DAYS[index - 1]
    return { q, day, checked: day ? value?.[day] === true : value === true }
  })
}

export function attendanceTaskState(weekly, classes) {
  if (!knownRead(weekly) || !knownRead(classes)) return 'unknown'
  if (!classes.data.length) return 'none'
  return weekly.data?.attendanceSubmittedThisWeek ? 'done' : 'pending'
}

export function knownRead(query) {
  return !!query?.isSuccess && !query.isError && !query.isPlaceholderData &&
    query.fetchStatus !== 'paused' && query.data !== undefined
}

// Only a small fingerprint is persisted; no names or descriptions in the read ledger.
export function eventFingerprint(event) {
  const fields = ['title', 'description', 'eventDate', 'endDate', 'startTime', 'endTime',
    'eventType', 'color', 'attendanceRequired', 'attendanceDeadline', 'attendanceTarget'].map(k => event[k] ?? null)
  if (event.attendanceStartDate) fields.push(event.attendanceStartDate)
  const text = JSON.stringify(fields)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(36)
}

export function parseSeenEvents(raw) {
  try {
    const value = JSON.parse(raw || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

export const eventSeenKey = userId => `newave:event-seen:v1:${userId}`
export const isUnseenEvent = (event, seen, today) => !!event?.id && !!event.readVersion &&
  (event.endDate || event.eventDate) >= today && seen[event.id] !== event.readVersion

export const legacyReadMatches = (event, legacy) => !!event?.id && !!event.readVersion &&
  legacy[event.id] === eventFingerprint(event)

export function mergeSeenEvents(seen, events) {
  const next = { ...seen }
  events.forEach(event => { if (event?.id) next[event.id] = eventFingerprint(event) })
  return next
}
