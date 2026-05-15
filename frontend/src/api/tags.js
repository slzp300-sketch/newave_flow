import client from './client'

export const tagsApi = {
  getAll:    ()                            => client.get('/tags'),
  create:    (name, category, color)       => client.post('/tags', { name, category, color }),
  update:    (id, name, category, color)   => client.put(`/tags/${id}`, { name, category, color }),
  delete:    (id)                          => client.delete(`/tags/${id}`),
  deleteAll: ()                            => client.delete('/tags/all'),
  assign:    (tagId, userId)               => client.post(`/tags/${tagId}/users/${userId}`),
  remove:    (tagId, userId)               => client.delete(`/tags/${tagId}/users/${userId}`),
}
