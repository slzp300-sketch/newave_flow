import client from './client'

export const prayerVoteApi = {
  checkWindow:        ()           => client.get('/prayer-votes/window'),
  getMine:            (week)       => client.get('/prayer-votes/mine', { params: { week } }),
  save:               (data)       => client.post('/prayer-votes', data),
  getParticipation:  (week)       => client.get('/prayer-votes/participation', { params: { week } }),
}
