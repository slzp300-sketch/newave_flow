import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut, Bell } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../../store/authStore'
import { notificationApi } from '../../api/notifications'

export default function Header({ title, showBack = false, onBack, showLogout = false, showNotification = true, right }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, clearAuth } = useAuthStore()

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: () => notificationApi.getUnreadCount().then(r => r.data),
    enabled: !!user && showNotification,
    refetchInterval: 30000 // 30초마다 갱신
  })

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      queryClient.clear()
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="sticky top-0 z-50 glass-effect px-4 py-4 flex items-center gap-3">
      {showBack && (
        <button
          onClick={onBack ?? (() => navigate(-1))}
          className="p-1.5 -ml-1.5 rounded-xl active:scale-95 transition-transform"
        >
          <ChevronLeft size={22} className="text-gray-900" />
        </button>
      )}
      <h1 className="flex-1 text-[19px] font-black text-gray-900 tracking-tight text-glow">{title}</h1>
      
      <div className="flex items-center gap-2">
        {right}
        {user && showNotification && (
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-1.5 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-all"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            )}
          </button>
        )}
        {showLogout && (
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all"
            title="로그아웃"
          >
            <LogOut size={20} />
          </button>
        )}
      </div>
    </header>
  )
}
