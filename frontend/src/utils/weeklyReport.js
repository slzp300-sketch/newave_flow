import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns'

// Match the supplied report template and the HWPX/PDF renderer's ISO week number.
export function reportWeekLabel(date) {
  const day = parseISO(date)
  return `${getISOWeekYear(day)}년 ${getISOWeek(day)}주차`
}

export function supplementFromEditor(editor) {
  return {
    members: editor.students.filter(s => s.studentId != null).map(s => ({
      studentId: s.studentId, category: s.category, graduated: s.graduated,
      gender: s.gender, school: s.school, address: s.address, phone: s.phone, introducer: s.introducer,
    })),
    visitors: editor.supplement.visitors.map(v => ({ ...v })),
    notes: editor.supplement.notes || '',
  }
}
export function statusFromEditor(editor) {
  return Object.fromEntries(editor.students.filter(s => s.studentId != null).map(s => [s.id, s.status]))
}
export const reportCategories = { REGULAR: '재적', FAMILY: '새가족', FIRST: '금주 새 인원', RETURN: '장기결석 후 재방문' }
