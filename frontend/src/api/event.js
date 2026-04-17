import client from './client'

export const eventApi = {
  getEvents: (params) => client.get('/events', { params }),
  getEvent: (id) => client.get(`/events/${id}`),
  saveAttendance: (id, data) => client.post(`/events/${id}/attendance`, data),
}
