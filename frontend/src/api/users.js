import client from './client'

export const usersApi = {
  getAll: () => client.get('/users'),
  updateRole: (id, role) => client.put(`/users/${id}/role`, { role }),
  changePassword: (currentPassword, newPassword) =>
    client.put('/users/me/password', { currentPassword, newPassword }),
  updateSettings: (settings) =>
    client.put('/users/me/settings', settings),
  getMyProfile: () =>
    client.get('/users/me/profile'),
  updateProfile: ({ name, phone, birthDate, profileImage, churchPosition }) =>
    client.put('/users/me/profile', { name, phone, birthDate, profileImage, churchPosition }),
  getTeacherRoster: () =>
    client.get('/users/teachers/roster'),
}
