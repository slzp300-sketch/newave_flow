import { useEffect } from 'react'
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import BottomNav from './BottomNav'
import usePullToRefresh from '../../hooks/usePullToRefresh'
import useAuthStore from '../../store/authStore'
import { useMotionPreference } from '../common/Motion'

export default function AppLayout() {
  const { pathname } = useLocation()
  const reduced = useMotionPreference()
  const { isRefreshing, pullDistance } = usePullToRefresh()
  const { user, apiEnvironment } = useAuthStore()
  const largeFontMode = user?.largeFont ?? false

  useEffect(() => {
    const root = document.documentElement
    root.style.fontSize = largeFontMode ? '120%' : ''
    root.style.transition = reduced ? '' : 'font-size 0.3s ease'
    root.classList.toggle('large-font', largeFontMode)
    return () => {
      root.style.fontSize = ''
      root.style.transition = ''
      root.classList.remove('large-font')
    }
  }, [largeFontMode, reduced])

  // 당긴 거리 비율 (0 ~ 1)
  const pullProgress = Math.min(pullDistance / 70, 1)

  return (
    <div className="min-h-screen bg-surface flex flex-col overflow-x-clip">
      <ScrollRestoration />
      {apiEnvironment === 'review' && <div role="status" className="mx-auto w-full max-w-mobile bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">가상 심사 환경 · 실제 회원·학생 자료와 분리됨</div>}
      
      {/* Pull to Refresh Animated Indicator */}
      <div 
        className="fixed top-0 left-0 w-full flex justify-center pointer-events-none z-[60]"
        style={{ 
          height: pullDistance > 0 ? pullDistance + 40 : 0,
          opacity: pullProgress,
          transform: `translateY(${Math.max(pullDistance - 20, 0)}px)`
        }}
      >
        <motion.div 
          animate={{ 
            rotate: reduced ? 0 : isRefreshing ? 360 : pullDistance * 2,
            scale: !reduced && pullProgress >= 1 ? [1, 1.1, 1] : 1
          }}
          transition={reduced ? { duration: 0 } : isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: 'spring', damping: 15 }}
          className={`
            w-10 h-10 rounded-full shadow-lg flex items-center justify-center border
            ${isRefreshing ? 'bg-primary-500 text-white border-primary-600' : 'bg-white text-primary-500 border-primary-100'}
          `}
        >
          <RefreshCw size={20} strokeWidth={3} />
        </motion.div>
        
        {isRefreshing && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-12 text-xs font-bold text-primary-600 tracking-widest uppercase"
          >
            새로고침 중
          </motion.div>
        )}
      </div>

      <main
        className="flex-1 pb-[calc(80px+env(safe-area-inset-bottom))] max-w-mobile mx-auto w-full transition-transform duration-150"
        style={pullDistance > 0 ? { transform: `translateY(${pullDistance * 0.4}px)` } : undefined}
      >
        {/* Opacity only: a transform here would displace fixed submit bars and dialogs. */}
        <div key={pathname} className="motion-page"><Outlet /></div>
      </main>
      <BottomNav />
    </div>
  )
}
