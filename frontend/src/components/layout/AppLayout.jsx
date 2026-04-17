import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <main className="flex-1 pb-20 max-w-mobile mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
