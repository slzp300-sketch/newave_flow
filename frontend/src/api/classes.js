import client from './client'

export const classesApi = {
  getMyClasses:  ()   => client.get('/classes'),
  getStudents:   (id) => client.get(`/classes/${id}/students`),
  getRoster:     ()   => client.get('/classes/roster'),
}