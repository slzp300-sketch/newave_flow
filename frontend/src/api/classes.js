import client from './client'

export const classesApi = {
  getMyClasses:  ()   => client.get('/classes'),
  getStudents:   (id, date) => client.get(`/classes/${id}/students`, { params: { date } }),
  getRoster:     config => client.get('/classes/roster', config),
  assignTeacher: (classId, userId, isPrimary, config) =>
    client.post(`/classes/${classId}/assign-teacher/${userId}?isPrimary=${isPrimary}`, undefined, config),
  removeTeacher: (classId, userId) =>
    client.delete(`/classes/${classId}/remove-teacher/${userId}`),
  updateTeachers: (classId, assignments) =>
    client.put(`/classes/${classId}/teachers`, { assignments }),
}
