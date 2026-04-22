import client from './client'

export const authApi = {
  login:  (email, password) => client.post('/auth/login', { email, password }),
  register: (data)          => client.post('/auth/register', data),
  logout: ()                => client.post('/auth/logout'),
  me:     ()                => client.get('/users/me'),
}
