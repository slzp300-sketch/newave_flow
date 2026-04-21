import client from './client'

export const classesApi = {
  getMyClasses:  ()   => client.get('/classes'),
  getStudents:   (id) => client.get(`/classes/${id}/students`),
  getRoster:     ()   => client.get('/classes/roster'),
  assignTeacher: (classId, userId, isPrimary) => 
    client.post(`/classes/${classId}/assign-teacher/${userId}?isPrimary=${isPrimary}`),
  removeTeacher: (classId, userId) => 
    client.delete(`/classes/${classId}/remove-teacher/${userId}`),
}