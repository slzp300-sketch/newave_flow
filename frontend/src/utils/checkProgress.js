// A missing or failed response is not proof of completion (or non-completion).
export function knownQuery(query) {
  return !!query?.isSuccess && !query.isPlaceholderData && query.data !== undefined
}

export function eventCheckState(eventsQuery, events, teacherQueries, studentQueries) {
  if (!knownQuery(eventsQuery)) return 'unknown'
  if (!events.length) return 'none'
  const states = events.map(event => {
    const teacher = event.attendanceTarget === 'BOTH' || event.attendanceTarget === 'TEACHER_ONLY'
    const student = !event.attendanceTarget || event.attendanceTarget === 'BOTH' || event.attendanceTarget === 'STUDENT_ONLY'
    const tq = teacherQueries.get(event.id)
    const sq = studentQueries.get(event.id)
    if ((teacher && !knownQuery(tq)) || (student && !knownQuery(sq))) return 'unknown'
    const complete = (!teacher || !!tq.data?.status) && (!student || sq.data.every(s => !!s.status))
    return complete ? 'done' : 'pending'
  })
  if (states.includes('unknown')) return 'unknown'
  return states.every(s => s === 'done') ? 'done' : 'pending'
}

export function summarizeChecks(tasks) {
  const required = tasks.filter(t => t.state !== 'none')
  const done = required.filter(t => t.state === 'done').length
  const unknown = required.filter(t => t.state === 'unknown').length
  return { total: required.length, done, unknown, pending: required.length - done - unknown,
    allDone: required.length > 0 && done === required.length }
}
