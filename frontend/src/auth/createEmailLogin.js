import { selectedLoginEnvironment } from './reviewEnvironment.js'

export function createEmailLogin(client) {
  return async (email, password, selected = 'production') => {
    const apiEnvironment = selectedLoginEnvironment(email, selected)
    const response = await client.post('/auth/login', { email, password }, { apiEnvironment, skipAuth: true })
    return { ...response, data: { ...response.data, apiEnvironment } }
  }
}
