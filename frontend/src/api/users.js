import client from './client'

export const usersApi = {
  getAll: () => client.get('/users'),
  updateRole: (id, role) => client.put(`/users/${id}/role`, { role }),
  changePassword: (currentPassword, newPassword) =>
    client.put('/users/me/password', { currentPassword, newPassword }),
}
