import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../../store/authStore'

export default function Header({ title, showBack = false, onBack, showLogout = false, right }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clearAuth } = useAuthStore()

  const handleLogout = () => {
    // 헤더에서의 로그아웃은 즉시 처리가 아닌 마이페이지로 이동하거나 간소화된 흐름을 가질 수 있습니다.
    // 여기서는 사용자 요청대로 동작 개선을 위해 QueryClient 초기화를 추가합니다.
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
