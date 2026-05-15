import client from './client'

export const tagsApi = {
  getAll:  ()              => client.get('/tags'),
  create:  (name)          => client.post('/tags', { name }),
  update:  (id, name)      => client.put(`/tags/${id}`, { name }),
  delete:  (id)            => client.delete(`/tags/${id}`),
  assign:  (tagId, userId) => client.post(`/tags/${tagId}/users/${userId}`),
  remove:  (tagId, userId) => client.delete(`/tags/${tagId}/users/${userId}`),
}
