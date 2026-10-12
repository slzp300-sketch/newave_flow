export function eventAttendanceCounts(records, total = records.length) {
  const present = records.filter(record => record.status === 'PRESENT').length
  const partial = records.filter(record => record.status === 'PARTIAL').length
  const absent = records.filter(record => record.status === 'ABSENT').length
  return { total, present, partial, absent, unsubmitted: Math.max(0, total - present - partial - absent) }
}
