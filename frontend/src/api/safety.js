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
  summary: () => client.get('/safety/admin/summary').then(r => r.data),
  assign: (id, payload) => client.patch(`/safety/admin/reports/${id}/assignment`, payload).then(r => r.data),
  target: id => client.get(`/safety/admin/reports/${id}/target`).then(r => r.data),
  photos: (page, status) => client.get('/safety/admin/photos', { params: { page, status: status || undefined } }).then(r => r.data),
  photoImage: id => client.get(`/safety/admin/photos/${id}/image`).then(r => r.data),
  reviewPhoto: (id, payload) => client.patch(`/safety/admin/photos/${id}`, payload).then(r => r.data),
  photoStatus: (targetType, targetId) => client.get('/safety/photos/status', { params: { targetType, targetId } }).then(r => r.status === 204 ? null : r.data),
  removePhoto: (targetType, targetId) => client.delete('/safety/photos', { params: { targetType, targetId } }),
}
