const commonLabels = { scripture:'성경 본문', sermon:'설교 제목', preacher:'설교자', author:'담당자', director:'교육부총괄', pastor:'담임목사', offering:'헌금' }
export function reportIssueTarget(issue, date) {
  const kind = issue.action || issue.area
  if (kind === 'common') return { kind, field: issue.field || Object.keys(commonLabels).find(key => issue.message.startsWith(commonLabels[key])) }
  if (kind === 'new-family' || (kind === 'class' && issue.targetId < 0)) return { kind:'new-family', path:`/new-family?date=${encodeURIComponent(date)}` }
  if (kind === 'assignment' || kind === 'roster') return { kind:'external', path:'/admin/class-assignment' }
  if (kind === 'students') return { kind:'external', path:'/admin/students' }
  if (kind === 'teachers') return { kind:'external', path:'/admin/teachers' }
  if (['class','teacher'].includes(kind) && issue.targetId != null) return { kind, id:issue.targetId, field:issue.field, subjectId:issue.subjectId }
  return null
}

// Report links always open the same Sunday, including across month/year boundaries.
export function reportWeekOffset(requested, current) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requested || '')) return 0
  const date = new Date(`${requested}T12:00:00Z`), now = new Date(`${current}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== requested || date.getUTCDay() !== 0 || date > now) return 0
  return Math.round((date - now) / 604800000)
}
