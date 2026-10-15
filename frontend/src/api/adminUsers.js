import client from './client'

export const adminUsersApi = {
  getPending: () => client.get('/admin/users/pending'),
  getSuspended: () => client.get('/admin/users/suspended'),
  getStatusHistory: id => client.get(`/admin/users/${id}/status-history`),
  restore: (id, reason, expectedAuthVersion) => client.patch(`/admin/users/${id}/restore`, { reason, expectedAuthVersion }),
  approve: (id, classGroupId) => client.patch(`/admin/users/${id}/approve`, { classGroupId }),
}
