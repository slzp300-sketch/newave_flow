export const eventRangeKey = (from, to) => ['events', from, to]

const rules = [
  [/^\/(admin\/)?students|^\/classes|^\/admin\/classes|deactivation-requests/, ['student', 'students', 'my-class-students', 'admin-students', 'roster', 'admin-roster', 'teachers', 'teacher-roster', 'my-classes', 'attendance', 'admin-attendance', 'admin-weekly-attendance', 'admin-absent', 'report-', 'weekly-status', 'deactivation-']],
  [/^\/events/, ['event', 'events', 'weekly-events', 'attendance-required-events', 'attendance-summary', 'teacher-attendance-summary']],
  [/^\/attendance|^\/reports/, ['attendance', 'admin-attendance', 'admin-weekly-attendance', 'admin-absent', 'report-', 'student-history', 'weekly-status']],
  [/^\/evangelism/, ['evangelism-']],
  [/^\/meeting|^\/prayer|^\/minutes/, ['meeting-', 'prayer-', 'admin-meeting-', 'admin-minute', 'minutes', 'tts-', 'weekly-status']],
  [/^\/(admin\/)?users/, ['users-management', 'pending-users', 'teachers', 'teacher-roster', 'all-users-pool', 'admin-teachers', 'my-profile', 'my-classes', 'report-', 'roster']],
  [/^\/admin\/tts/, ['tts-']],
  [/^\/tags/, ['tags', 'teacher-roster']],
]

export function invalidateAfterWrite(queryClient, url) {
  const prefixes = rules.filter(([pattern]) => pattern.test(url || '')).flatMap(([, keys]) => keys)
  if (!prefixes.length) return Promise.resolve()
  return queryClient.invalidateQueries({ predicate: q => prefixes.some(prefix => String(q.queryKey[0]).startsWith(prefix)) })
}
