export const TTS_DAYS = ['월', '화', '수', '목', '금', '토']

// Home reminders follow today's editable fields, never future days or linked records.
export function todayTtsChecks(questions, week, today) {
  if (!week || week.importedPeriod) return []
  const index = new Date(today + 'T12:00:00').getDay()
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
  const text = JSON.stringify(['title', 'description', 'eventDate', 'endDate', 'startTime', 'endTime',
    'eventType', 'color', 'attendanceRequired', 'attendanceDeadline', 'attendanceTarget'].map(k => event[k] ?? null))
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
