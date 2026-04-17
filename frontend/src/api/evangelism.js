import client from './client'

export const usersApi = {
  getTeachers: () => client.get('/users/teachers'),
}

export const evangelismApi = {
  getGroups:             ()               => client.get('/evangelism/groups'),
  createGroup:           (data)           => client.post('/evangelism/groups', data),
  updateGroup:           (id, data)       => client.put(`/evangelism/groups/${id}`, data),
  updateGroupMembers:    (id, data)       => client.put(`/evangelism/groups/${id}/members`, data),
  deleteGroup:           (id)             => client.delete(`/evangelism/groups/${id}`),

  getSchedules:          (upcomingOnly)   => client.get('/evangelism/schedules', { params: { upcomingOnly } }),
  createSchedule:        (data)           => client.post('/evangelism/schedules', data),
  updateSchedule:        (id, data)       => client.put(`/evangelism/schedules/${id}`, data),
  deleteSchedule:        (id)             => client.delete(`/evangelism/schedules/${id}`),
  cancelSchedule:        (id)             => client.post(`/evangelism/schedules/${id}/cancel`),

  getMyStatus:           ()               => client.get('/evangelism/status/mine'),
  getMySchedules:        ()               => client.get('/evangelism/schedules/mine'),
}
