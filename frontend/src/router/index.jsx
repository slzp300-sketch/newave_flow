import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import AppLayout from '../components/layout/AppLayout'

import Login                 from '../pages/Login'
import Home                  from '../pages/Home'
import AttendancePage        from '../pages/AttendancePage'
import AdminDashboard        from '../pages/AdminDashboard'
import CalendarPage          from '../pages/CalendarPage'
import CalendarAdminPage     from '../pages/CalendarAdminPage'
import MeetingAttendancePage from '../pages/MeetingAttendancePage'
import EventPage             from '../pages/EventPage'
import StudentDetailPage     from '../pages/StudentDetailPage'
import TTSPage               from '../pages/TTSPage'
import EvangelismPage        from '../pages/EvangelismPage'
import EvangelismAdminPage   from '../pages/EvangelismAdminPage'
import MeetingMinutesPage    from '../pages/MeetingMinutesPage'
import MeetingMinutesAdminPage from '../pages/MeetingMinutesAdminPage'
import PrayerAbsentAdminPage  from '../pages/PrayerAbsentAdminPage'
import WeeklyCheckPage          from '../pages/WeeklyCheckPage'
import RosterPage               from '../pages/RosterPage'
import EventAttendanceListPage  from '../pages/EventAttendanceListPage'
import EventAttendancePage      from '../pages/EventAttendancePage'
import EventAttendanceAdminPage from '../pages/EventAttendanceAdminPage'

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
          { path: '/calendar',   element: <CalendarPage /> },
          { path: '/checklist',  element: <WeeklyCheckPage /> },
          { path: '/tts',        element: <TTSPage /> },
          { path: '/meeting',    element: <MeetingAttendancePage /> },
          { path: '/minutes',    element: <MeetingMinutesPage /> },
          { path: '/events',     element: <CalendarPage /> },
          { path: '/students/:id',  element: <StudentDetailPage /> },
          { path: '/evangelism',         element: <EvangelismPage /> },
          { path: '/roster',             element: <RosterPage /> },
          { path: '/event-attendance',   element: <EventAttendanceListPage /> },
          { path: '/event-attendance/:id', element: <EventAttendancePage /> },
          {
            element: <RequireRole roles={['PASTOR', 'EXECUTIVE']} />,
            children: [
              { path: '/admin',             element: <AdminDashboard /> },
              { path: '/admin/calendar',    element: <CalendarAdminPage /> },
              { path: '/admin/evangelism',  element: <EvangelismAdminPage /> },
              { path: '/admin/minutes',     element: <MeetingMinutesAdminPage /> },
              { path: '/admin/prayer',           element: <PrayerAbsentAdminPage /> },
              { path: '/admin/event-attendance', element: <EventAttendanceAdminPage /> },
            ],
          },
        ],
      },
    ],
  },
])

export default router