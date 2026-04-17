import client from './client'

export const authApi = {
  login:  (email, password) => client.post('/auth/login', { email, password }),
  logout: ()                => client.post('/auth/logout'),
  me:     ()                => client.get('/users/me'),
}
