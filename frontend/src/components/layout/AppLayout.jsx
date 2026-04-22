import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom'
import { useEffect } from 'react'
import BottomNav from './BottomNav'

export default function AppLayout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <ScrollRestoration />
      <main className="flex-1 pb-20 max-w-mobile mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
