import client from './client'

export const notificationApi = {
  getAll: () => client.get('/notifications'),
  getUnreadCount: () => client.get('/notifications/unread-count'),
  markAsRead: (id) => client.patch(`/notifications/${id}/read`),
  markAllAsRead: () => client.patch('/notifications/read-all'),
  getPreferences: config => client.get('/notifications/preferences', config),
  setPreferences: (data, config) => client.put('/notifications/preferences', data, config),
  registerDevice: (id, data, config) => client.put(`/notifications/devices/${id}`, data, config),
  deleteDevice: (id, config) => client.delete(`/notifications/devices/${id}`, config),
}
