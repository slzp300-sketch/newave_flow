import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { login, logout } from '../api/auth'
import useAuthStore from '../store/authStore'

export function useLogin() {
  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken)
      navigate('/', { replace: true })
    },
  })
}

export function useLogout() {
  const { clearAuth } = useAuthStore()
  const navigate      = useNavigate()

  return () => {
    logout().catch(() => {})
    clearAuth()
    navigate('/login', { replace: true })
  }
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user)
}