export function scopedDraft(draft, key, saved) {
  return draft?.key === key ? draft.values : saved
}

export function studentEventForm(students, draft, defaultStatus = 'PRESENT') {
  const form = { statusMap: {}, reasonMap: {}, partialFromDateMap: {}, partialNoteMap: {}, editing: draft?.editing || false }
  for (const s of students) {
    form.statusMap[s.studentId] = draft?.statusMap[s.studentId] ?? s.status ?? defaultStatus
    form.reasonMap[s.studentId] = draft?.reasonMap[s.studentId] ?? s.absenceReason ?? ''
    form.partialFromDateMap[s.studentId] = draft?.partialFromDateMap[s.studentId] ?? s.partialFromDate ?? ''
    form.partialNoteMap[s.studentId] = draft?.partialNoteMap[s.studentId] ?? s.partialNote ?? ''
  }
  return form
}

export function teacherEventForm(record) {
  return { pending: record?.status || null, partialFromDate: record?.partialFromDate || '',
    partialNote: record?.partialNote || '', absenceReason: record?.absenceReason || '', editing: false }
}

// Apply only an acknowledged write, keeping names and other roster metadata intact.
export async function confirmAttendance(queryClient, queryKey, records) {
  await queryClient.cancelQueries({ queryKey, exact: true })
  queryClient.setQueryData(queryKey, old => Array.isArray(records)
    ? records.map(record => ({ ...(old || []).find(s => s.studentId === record.studentId), ...record }))
    : { ...old, ...records })
  void queryClient.invalidateQueries({ queryKey, exact: true })
}
