import client from './client'

export const reportsApi = {
  save:       (data)   => client.post('/reports', data),
  submit:     (id)     => client.put(`/reports/${id}/submit`),
  getSummary: (date)   => client.get('/reports/summary', { params: { date } }),
  getList:    (params) => client.get('/reports', { params }),
  getByClassAndDate: (classId, date) => client.get('/reports/status', { params: { classId, date } }),
}
