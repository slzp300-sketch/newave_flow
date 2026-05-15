import client from './client'

export const tagsApi = {
  getAll:  ()                        => client.get('/tags'),
  create:  (name, category)          => client.post('/tags', { name, category }),
  update:  (id, name, category)      => client.put(`/tags/${id}`, { name, category }),
  delete:  (id)                      => client.delete(`/tags/${id}`),
  assign:  (tagId, userId)           => client.post(`/tags/${tagId}/users/${userId}`),
  remove:  (tagId, userId)           => client.delete(`/tags/${tagId}/users/${userId}`),
}
