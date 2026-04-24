import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import BottomNav from './BottomNav'
import usePullToRefresh from '../../hooks/usePullToRefresh'

export default function AppLayout() {
  const { pathname } = useLocation()
  const { isRefreshing, pullDistance } = usePullToRefresh()

  // 당긴 거리 비율 (0 ~ 1)
  const pullProgress = Math.min(pullDistance / 70, 1)

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <ScrollRestoration />
      
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
            rotate: isRefreshing ? 360 : pullDistance * 2,
            scale: pullProgress >= 1 ? [1, 1.1, 1] : 1
          }}
          transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: 'spring', damping: 15 }}
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
            className="absolute top-12 text-[10px] font-black text-primary-600 tracking-widest uppercase"
          >
            Updating
          </motion.div>
        )}
      </div>

      <main 
        className="flex-1 pb-20 max-w-mobile mx-auto w-full transition-transform duration-150"
        style={{ transform: `translateY(${pullDistance * 0.4}px)` }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
