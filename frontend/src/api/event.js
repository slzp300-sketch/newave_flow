import client from './client'

export const eventApi = {
  getEvents:                (params)       => client.get('/events', { params }),
  getEvent:                 (id)           => client.get(`/events/${id}`),
  getAttendanceRequired:    ()             => client.get('/events/attendance-required'),
  getMyClassAttendance:     (id)           => client.get(`/events/${id}/student-attendance`),
  saveStudentAttendance:    (id, records)  => client.post(`/events/${id}/student-attendance/batch`, { records }),
  getAttendanceSummary:     (id)           => client.get(`/events/${id}/student-attendance/summary`),
}
