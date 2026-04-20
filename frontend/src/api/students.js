import client from './client'

export const studentsApi = {
  getById:             (id)           => client.get(`/students/${id}`),
  getMyClass:          ()             => client.get('/students/my-class'),
  update:              (id, data)     => client.put(`/students/${id}`, data),
  deactivate:          (id)           => client.patch(`/students/${id}/deactivate`),
  activate:            (id)           => client.patch(`/students/${id}/activate`),
  requestDeactivation: (id, reason)   => client.post(`/students/${id}/deactivation-request`, { reason }),
  saveMemo:            (id, data)    => client.put(`/students/${id}/memo`, data),
}

export const deactivationApi = {
  getPending: ()   => client.get('/admin/deactivation-requests'),
  approve:    (id) => client.patch(`/admin/deactivation-requests/${id}/approve`),
  reject:     (id) => client.patch(`/admin/deactivation-requests/${id}/reject`),
}
