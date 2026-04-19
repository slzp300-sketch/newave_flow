import client from './client'

export const prayerVoteApi = {
  checkWindow:        ()           => client.get('/prayer-votes/window'),
  getMine:            (week)       => client.get('/prayer-votes/mine', { params: { week } }),
  save:               (data)       => client.post('/prayer-votes', data),
  getAbsentList:      (week)       => client.get('/prayer-votes/absent', { params: { week } }),
  toggleScripture:    (id, submitted) => client.patch(`/prayer-votes/${id}/scripture`, { submitted }),
}
