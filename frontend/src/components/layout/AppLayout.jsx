import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import BottomNav from './BottomNav'

export default function AppLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <main className="flex-1 pb-20 max-w-mobile mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
