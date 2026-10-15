export const REPORT_REASONS = { INAPPROPRIATE_CONTENT: '부적절한 내용', HARASSMENT: '괴롭힘·위협·사칭', PRIVACY: '개인정보·사진 침해', OTHER: '기타 문제' }
export const REPORT_STATUS = { OPEN: '접수됨', REVIEWING: '검토 중', RESOLVED: '조치 완료', DISMISSED: '위반 없음' }
export const REPORT_ACTIONS = { NONE: '조치 선택 안 함', HIDE_MINUTE: '회의록 비공개', HIDE_REPORT_NOTES: '보고 메모 숨김', HIDE_PHOTO: '사진 숨김', REDACT_EVENT: '일정 글 숨김', SUSPEND_USER: '사용자 이용 제한', REVIEWED: '직접 확인한 보호 조치 기록' }
export const CONTENT_LABELS = { MEETING_MINUTE: '회의록', DAILY_REPORT: '출결보고', EVENT: '일정', USER_PROFILE_PHOTO: '교사 프로필 사진', STUDENT_PHOTO: '학생 사진', OTHER: '콘텐츠' }
export const PHOTO_STATUS = { PENDING: '검토 대기', APPROVED: '게시 승인', REJECTED: '게시 거절', HIDDEN: '숨김 처리' }
export const PROTECTION_ACTIONS = { MEETING_MINUTE: 'HIDE_MINUTE', DAILY_REPORT: 'HIDE_REPORT_NOTES', EVENT: 'REDACT_EVENT', USER_PROFILE_PHOTO: 'HIDE_PHOTO', STUDENT_PHOTO: 'HIDE_PHOTO' }

export function reportTarget(search) {
  const params = new URLSearchParams(search)
  const rawId = params.get('targetId')
  const id = rawId && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : null
  if (!Number.isSafeInteger(id)) return { targetType: 'CONTENT', contentType: 'OTHER', targetId: null }
  if (params.get('targetType') === 'USER') return { targetType: 'USER', contentType: null, targetId: id }
  if (params.get('targetType') === 'CONTENT' && Object.hasOwn(PROTECTION_ACTIONS, params.get('contentType')))
    return { targetType: 'CONTENT', contentType: params.get('contentType'), targetId: id }
  return { targetType: 'CONTENT', contentType: 'OTHER', targetId: null }
}

// Keep a request number on an uncertain response, but never reuse it for edited contents.
export function reportSubmission(previous, payload, newId) {
  const fingerprint = JSON.stringify(payload)
  return { fingerprint, id: previous?.fingerprint === fingerprint ? previous.id : newId() }
}
