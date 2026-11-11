import client from './client'

export const adminUsersApi = {
  getPending: config => client.get('/admin/users/pending', config),
  getSuspended: config => client.get('/admin/users/suspended', config),
  getStatusHistory: id => client.get(`/admin/users/${id}/status-history`),
  restore: (id, reason, expectedAuthVersion) => client.patch(`/admin/users/${id}/restore`, { reason, expectedAuthVersion }),
  approve: (id, classGroupId, config) => client.patch(`/admin/users/${id}/approve`, { classGroupId }, config),
  approveMany: (userIds, config) => client.patch('/admin/users/approve', { userIds }, config),
}
