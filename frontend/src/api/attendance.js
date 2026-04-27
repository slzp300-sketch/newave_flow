import client from './client'

export const attendanceApi = {
  getByClass: (classId, date) =>
    client.get('/attendance', { params: { classId, date } }),

  saveBatch: (classGroupId, attendanceDate, records) =>
    client.post('/attendance/batch', { classGroupId, attendanceDate, records }),

  getSummary: (date) =>
    client.get('/attendance/summary', { params: { date } }),

  getHistoryByStudent: (studentId) => client.get(`/attendance/student/${studentId}`),

  submit: (classId, date) =>
    client.post('/attendance/submit', null, { params: { classId, date } }),

  checkWindow: () => client.get('/attendance/window'),

  getAdminWeekly: (date) =>
    client.get('/attendance/admin/weekly', { params: { date } }),

  getAdminAbsent: (date) =>
    client.get('/attendance/admin/absent', { params: { date } }),
}
