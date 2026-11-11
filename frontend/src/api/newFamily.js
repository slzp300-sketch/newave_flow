import client from './client'
const data = promise => promise.then(r => r.data)
export const newFamilyApi = {
  capability: () => data(client.get('/new-family/capability')),
  handoff: id => data(client.get(`/new-family/students/${id}/handoff`)),
  roster: () => data(client.get('/new-family/people')),
  create: body => data(client.post('/new-family/people', body)),
  edit: (id, body) => data(client.put(`/new-family/people/${id}`, body)),
  enroll: (id, body) => data(client.put(`/new-family/people/${id}/enrollment`, body)),
  course: (id, body) => data(client.put(`/new-family/people/${id}/course`, body)),
  decide: (id, body) => data(client.put(`/new-family/people/${id}/decision`, body)),
  request: (id, revision) => data(client.post(`/new-family/people/${id}/assignment-request`, { revision })),
  assign: (id, body) => data(client.put(`/new-family/people/${id}/assignment`, body)),
  classes: () => data(client.get('/new-family/classes')),
  team: () => data(client.get('/new-family/team')),
  setTeam: (id, member) => data(client.put(`/new-family/team/${id}`, { member })),
  week: date => data(client.get(`/new-family/weeks/${date}`)),
  attendance: (date, sourceHash, checks) => data(client.put(`/new-family/weeks/${date}/attendance`, { sourceHash, checks })),
  link: (date, body) => data(client.put(`/new-family/weeks/${date}/references`, body)),
  submit: (date, sourceHash) => data(client.post(`/new-family/weeks/${date}/submission`, { sourceHash })),
}
