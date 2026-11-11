import client from './client'
const data = promise => promise.then(response => response.data)
export const officersApi = {
  me: () => data(client.get('/officers/me')),
  organization: year => data(client.get('/officers/organization', { params: { year } })),
  assign: (year, position, revision, userId) => data(client.put(`/officers/organization/${year}/${position}`, { revision, userId })),
  activate: (year, revision) => data(client.put(`/officers/organization/${year}/activate`, { revision })),
}
