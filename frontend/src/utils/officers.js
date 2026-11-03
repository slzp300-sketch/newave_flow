export const OFFICER_GROUPS = ['목사', '부장', '부감', '운영 임원', '팀장', '학년부장']
export const OFFICER_GRADES = ['중1', '중2', '중3', '고1', '고2', '고3']
export function organizationCounts(offices = []) {
  const assigned = offices.filter(o => o.userId != null)
  return { assigned: assigned.length, vacant: offices.length - assigned.length, people: new Set(assigned.map(o => o.userId)).size }
}
export function officerDuties(access) {
  if (!access) return []
  const items = []
  if (access.canPraise) items.push({ to: '/praise', title: '찬양팀', detail: '명단·편성·콘티' })
  if (access.canReport) items.push({ to: '/admin/weekly-report', title: '주간보고서', detail: '취합·보완·파일 받기' })
  if (access.canNewFamily) items.push({ to: '/new-family', title: '새가족팀 관리', detail: '출결·과정·등반' })
  for (const grade of access.grades || []) items.push({ to: `/admin/attendance?grade=${encodeURIComponent(grade)}`, title: `${grade} 학년 현황`, detail: '출석·반별 제출' })
  if (access.offices?.some(o => ['DIRECTOR', 'DEPUTY_MALE', 'DEPUTY_FEMALE', 'GENERAL', 'VICE_GENERAL'].includes(o.code)))
    items.push({ to: '/admin/calendar', title: '부서 일정 관리', detail: '일정·행사 준비' })
  return items
}
