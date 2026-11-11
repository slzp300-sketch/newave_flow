export function reportSubmissionStatus(source) {
  if (['MISSING', 'CHANGED', 'SUBMITTED'].includes(source?.submissionStatus)) return source.submissionStatus
  if (!source?.submitted) return 'MISSING'
  return source.changed ? 'CHANGED' : 'SUBMITTED'
}

export function reportSubmissionLabel(source) {
  return { MISSING: '미제출', CHANGED: '재제출 필요', SUBMITTED: '제출 완료' }[reportSubmissionStatus(source)]
}

export const isReportSubmitted = source => reportSubmissionStatus(source) === 'SUBMITTED'
