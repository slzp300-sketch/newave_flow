import { useLayoutEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { parentPath } from '../../utils/navigation'
import { ChevronLeft, LogOut, Bell, Flag } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../../store/authStore'
import { notificationApi } from '../../api/notifications'
import { authApi } from '../../api/auth'
import FitLabel from '../common/FitLabel'
import Brand from '../common/Brand'
import FeatureIcon from '../common/FeatureIcon'
import ReviewEnvironmentNotice from '../common/ReviewEnvironmentNotice'

export default function Header({ title, showBack = false, onBack, showLogout = false, showNotification = true, right }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user, clearAuth } = useAuthStore()
  const headerRef = useRef(null)
  useLayoutEffect(() => {
    const element = headerRef.current
    const root = document.documentElement
    const measure = () => root.style.setProperty('--app-header-height', `${element.getBoundingClientRect().height}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => { observer.disconnect(); root.style.removeProperty('--app-header-height') }
  }, [])

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
    <header ref={headerRef} className="app-header sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="app-header-row px-4 flex items-center gap-2">
      {showBack && (
        <button
          onClick={onBack ?? (() => location.key === 'default' ? navigate(parentPath(location.pathname), { replace: true }) : navigate(-1))}
          className="icon-button -ml-2 shrink-0"
          aria-label="이전 화면"
        >
          <ChevronLeft size={22} className="text-gray-900" />
        </button>
      )}
      <h1 className="flex flex-1 min-w-0 items-center gap-2 py-2 text-lg font-semibold text-gray-900 tracking-tight">
        {title === 'Newave Flow' ? <Brand /> : <>
          <span aria-hidden="true" className="brand-heading-icon"><FeatureIcon path={location.pathname} size={20} /></span>
          <FitLabel maxLines={1}>{title}</FitLabel>
        </>}
      </h1>
      
      <div className="flex items-center gap-1 shrink-0">
        {right}
        {user && !location.pathname.startsWith('/safety/') && location.pathname !== '/community-guidelines' && (
          <button onClick={() => navigate('/safety/report', { state: { subject: title } })}
            className="icon-button" aria-label="콘텐츠·사용자 신고" title="콘텐츠·사용자 신고"><Flag size={19} /></button>
        )}
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
      </div>
      <ReviewEnvironmentNotice />
    </header>
  )
}
