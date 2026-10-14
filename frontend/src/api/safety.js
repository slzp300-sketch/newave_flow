import client from './client'

export const safetyApi = {
  policy: () => client.get('/safety/policy').then(r => r.data),
  agreement: () => client.get('/safety/agreement').then(r => r.data),
  accept: version => client.post('/safety/agreement', { version, accepted: true }).then(r => r.data),
  users: () => client.get('/safety/users').then(r => r.data),
  report: payload => client.post('/safety/reports', payload).then(r => r.data),
  mine: page => client.get('/safety/reports', { params: { page } }).then(r => r.data),
  queue: (page, status) => client.get('/safety/admin/reports', { params: { page, status: status || undefined } }).then(r => r.data),
  resolve: (id, payload) => client.patch(`/safety/admin/reports/${id}`, payload).then(r => r.data),
}
