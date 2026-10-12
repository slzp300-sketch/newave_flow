import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut, Bell } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../../store/authStore'
import { notificationApi } from '../../api/notifications'
import { authApi } from '../../api/auth'
import Brand from '../common/Brand'

export default function Header({ title, showBack = false, onBack, showLogout = false, showNotification = true, right }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, clearAuth } = useAuthStore()

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: () => notificationApi.getUnreadCount().then(r => r.data),
    enabled: !!user && showNotification,
  })

  const handleLogout = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      try { await authApi.logout() } catch {
        alert('서버에 연결하지 못해 이 기기에서만 로그아웃합니다. 다른 기기의 로그인은 유지될 수 있습니다.')
      }
      queryClient.clear()
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 min-h-14 flex items-center gap-2">
      {showBack && (
        <button
          onClick={onBack ?? (() => navigate(-1))}
          className="icon-button -ml-2 shrink-0"
          aria-label="이전 화면"
        >
          <ChevronLeft size={22} className="text-gray-900" />
        </button>
      )}
      <h1 className="flex-1 min-w-0 text-lg font-semibold text-gray-900 tracking-tight">{title === 'Newave Flow' ? <Brand /> : title}</h1>
      
      <div className="flex items-center gap-1 shrink-0">
        {right}
        {user && showNotification && (
          <button
            onClick={() => navigate('/notifications')}
            className="relative icon-button"
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 읽지 않음` : '알림'}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary-600 border-2 border-white rounded-full"></span>
            )}
          </button>
        )}
        {showLogout && (
          <button
            onClick={handleLogout}
            className="icon-button hover:text-red-600"
            title="로그아웃"
          >
            <LogOut size={20} />
          </button>
        )}
      </div>
    </header>
  )
}
