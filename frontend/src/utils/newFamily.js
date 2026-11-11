export const FAMILY_GRADES = ['중1', '중2', '중3', '고1', '고2', '고3']
export const FAMILY_CATEGORIES = { FIRST: '금주 새 인원', FAMILY: '새가족', FOLLOWUP: '등록 미정 재방문' }
export function familyCategory(person, date) {
  const first = new Date(`${person.firstVisit}T12:00:00Z`)
  first.setUTCDate(first.getUTCDate() - first.getUTCDay())
  if (first.toISOString().slice(0, 10) === date) return 'FIRST'
  return person.enrolledOn && person.enrolledOn <= date ? 'FAMILY' : 'FOLLOWUP'
}
export function familyStage(person, today) {
  if (person.classId) return person.effectiveDate > today ? '반 배정 예정' : '반 배정 완료'
  if (person.assignmentRequested) return '관리자 배정 대기'
  if (person.decision === 'READY') return '등반 가능'
  if (person.decision === 'HOLD') return '계속 참여'
  return person.enrolledOn ? '새가족 과정' : '등록 결정 전'
}
export function familyCounts(people, checks, date) {
  const result = { FIRST: 0, FAMILY: 0, FOLLOWUP: 0, unknown: 0, total: 0 }
  for (const person of people) {
    const status = checks[person.id] || 'UNKNOWN'
    if (status === 'UNKNOWN') result.unknown++
    if (status === 'PRESENT' || status === 'LATE') { result[familyCategory(person, date)]++; result.total++ }
  }
  return result
}
