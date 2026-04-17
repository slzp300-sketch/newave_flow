import client from './client'

export const meetingApi = {
  getAttendance: (date) => client.get('/meetings/attendance', { params: { date } }),
  saveAttendance: (data) => client.post('/meetings/attendance', data),
}
