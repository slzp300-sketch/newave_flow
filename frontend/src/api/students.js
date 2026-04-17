import client from './client'

export const studentsApi = {
  getById: (id) => client.get(`/students/${id}`),
}
