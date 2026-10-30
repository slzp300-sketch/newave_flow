import { gradeKey } from './gradeColors.js'
import { matchesAdminSearch } from './adminSearch.js'

const GRADES = ['유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3']
export const weeklyTtsPeople = rows => rows.map(row => ({ ...row,
  key: row.key ?? (row.teacherId != null ? `u${row.teacherId}` : null),
  gradeGroup: gradeKey(row.grade) || row.grade?.trim() || '미분류',
}))
export function weeklyTtsCounts(rows) {
  const total = rows.length, participating = rows.filter(row => row.isSubmitted === true).length
  return { total, participating, missing: total - participating, rate: total ? Math.round(participating / total * 1000) / 10 : null }
}
export function weeklyTtsGroups(rows) {
  const groups = new Map()
  for (const row of rows) {
    if (!groups.has(row.gradeGroup)) groups.set(row.gradeGroup, [])
    groups.get(row.gradeGroup).push(row)
  }
  const rank = grade => GRADES.includes(grade) ? GRADES.indexOf(grade) : grade === '미분류' ? 99 : 98
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'ko'))
    .map(([grade, people]) => ({ grade, people, ...weeklyTtsCounts(people) }))
}
export function filterWeeklyTts(rows, { grade = null, status = 'all', search = '' } = {}) {
  return rows.filter(row => (!grade || row.gradeGroup === grade)
    && (status === 'all' || (status === 'participating' ? row.isSubmitted === true : row.isSubmitted !== true))
    && matchesAdminSearch(search, row.teacherName, row.grade, row.gradeGroup))
    .sort((a, b) => (a.teacherName || '').localeCompare(b.teacherName || '', 'ko') || String(a.key).localeCompare(String(b.key)))
}

export function ttsQuestionError(question) {
  if (!question.title?.trim()) return '항목 이름을 입력해 주세요.'
  const points = Number(question.points)
  if (question.points === '' || question.points == null || !Number.isInteger(points) || points < 0 || points > 10000) return '배점은 0~10000 사이의 정수로 입력해 주세요.'
  return null
}
export const ttsQuestionPayload = rows => rows.map(q => ({
  ...(q.id != null ? { id: q.id } : {}), title: q.title.trim(), emoji: q.emoji || '', type: q.type,
  points: Number(q.points), displayOrder: q.displayOrder, active: !!q.active,
  linkType: q.type === 'DAYS' ? 'NONE' : q.linkType || 'NONE',
}))
