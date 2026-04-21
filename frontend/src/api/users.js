import client from './client'

export const usersApi = {
  getAll: () => client.get('/users'),
  updateRole: (id, role) => client.put(`/users/${id}/role`, { role }),
}
