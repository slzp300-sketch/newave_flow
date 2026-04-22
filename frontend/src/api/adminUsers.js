import client from './client'

export const adminUsersApi = {
  getPending: () => client.get('/admin/users/pending'),
  approve: (id, classGroupId) => client.patch(`/admin/users/${id}/approve`, { classGroupId }),
}
