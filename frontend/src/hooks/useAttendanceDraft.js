import { useState } from 'react'
import { scopedDraft, studentEventForm, teacherEventForm } from '../utils/attendanceDraft'

function useDraft(key, saved, normalize = value => value) {
  const [draft, setDraft] = useState(null)
  const values = normalize(scopedDraft(draft, key, saved))
  const setField = field => value => setDraft(previous => {
    const current = normalize(scopedDraft(previous, key, saved))
    return { key, values: { ...current, editing: true,
      [field]: typeof value === 'function' ? value(current[field]) : value } }
  })
  const reset = savedKey => setDraft(previous => previous?.key === savedKey ? null : previous)
  return { values, setField, reset, key }
}

export function useStudentAttendanceDraft(key, students) {
  const draft = useDraft(key, studentEventForm(students), value => studentEventForm(students, value))
  return { ...draft.values, reset: draft.reset, key,
    setStatusMap: draft.setField('statusMap'), setReasonMap: draft.setField('reasonMap'),
    setPartialFromDateMap: draft.setField('partialFromDateMap'), setPartialNoteMap: draft.setField('partialNoteMap'),
    setEditing: draft.setField('editing'), submitted: students.length > 0 && students.every(s => !!s.status) }
}

export function useTeacherAttendanceDraft(key, record) {
  const draft = useDraft(key, teacherEventForm(record))
  return { ...draft.values, reset: draft.reset, key,
    setPending: draft.setField('pending'), setPartialFromDate: draft.setField('partialFromDate'),
    setPartialNote: draft.setField('partialNote'), setAbsenceReason: draft.setField('absenceReason'),
    setEditing: draft.setField('editing'), submitted: !!record?.status }
}
