import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom'
import { useEffect } from 'react'
import BottomNav from './BottomNav'
import usePullToRefresh from '../../hooks/usePullToRefresh'

export default function AppLayout() {
  const { pathname } = useLocation()
  const isRefreshing = usePullToRefresh()

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <ScrollRestoration />
      
      {/* Pull to Refresh Indicator */}
      {isRefreshing && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-bounce">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-primary-100 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-primary-600">업데이트 중...</span>
          </div>
        </div>
      )}

      <main className="flex-1 pb-20 max-w-mobile mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
