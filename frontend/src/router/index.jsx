import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import AppLayout from '../components/layout/AppLayout'

import Login                 from '../pages/Login'
import Home                  from '../pages/Home'
import AttendancePage        from '../pages/AttendancePage'
import ReportPage            from '../pages/ReportPage'
import AdminDashboard        from '../pages/AdminDashboard'
import CalendarPage          from '../pages/CalendarPage'
import MeetingAttendancePage from '../pages/MeetingAttendancePage'
import EventPage             from '../pages/EventPage'
import StudentDetailPage     from '../pages/StudentDetailPage'
import TTSPage               from '../pages/TTSPage'

function RequireAuth() {
  const { user } = useAuthStore()
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireRole({ roles }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/',           element: <Home /> },
          { path: '/attendance', element: <AttendancePage /> },
          { path: '/report',     element: <ReportPage /> },
          { path: '/calendar',   element: <CalendarPage /> },
          { path: '/checklist',  element: <TTSPage /> },
          { path: '/tts',        element: <TTSPage /> },
          { path: '/meeting',    element: <MeetingAttendancePage /> },
          { path: '/events',     element: <EventPage /> },
          { path: '/students/:id', element: <StudentDetailPage /> },
          {
            element: <RequireRole roles={['PASTOR', 'EXECUTIVE']} />,
            children: [
              { path: '/admin', element: <AdminDashboard /> },
            ],
          },
        ],
      },
    ],
  },
])

export default router