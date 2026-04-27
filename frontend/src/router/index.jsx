import axios from 'axios'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { queryClient } from '../queryClient'
import AppLayout from '../components/layout/AppLayout'
import client from '../api/client'

import Signup                from '../pages/Signup'
import Login                 from '../pages/Login'
import Home                  from '../pages/Home'
import AttendancePage        from '../pages/AttendancePage'
import AdminDashboard        from '../pages/AdminDashboard'
import CalendarPage          from '../pages/CalendarPage'
import CalendarAdminPage     from '../pages/CalendarAdminPage'
import MeetingAttendancePage from '../pages/MeetingAttendancePage'
import PrayerMeetingPage    from '../pages/PrayerMeetingPage'
import SatMeetingPage       from '../pages/SatMeetingPage'
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
import AdminMeetingAttendancePage from '../pages/AdminMeetingAttendancePage'
import ClassManagePage                  from '../pages/ClassManagePage'
import DeactivationRequestsAdminPage   from '../pages/DeactivationRequestsAdminPage'
import TtsAdminPage                    from '../pages/TtsAdminPage'
import AdminTeacherManagePage         from '../pages/AdminTeacherManagePage'
import AdminClassManagePage           from '../pages/AdminClassManagePage'
import AdminStudentManagePage         from '../pages/AdminStudentManagePage'
import AdminPendingUsersPage          from '../pages/AdminPendingUsersPage'
import AdminStudentAttendancePage    from '../pages/AdminStudentAttendancePage'
import ExecutiveManagePage          from '../pages/ExecutiveManagePage'
import ManualPreviewPage             from '../pages/ManualPreviewPage'
import ProfilePage                   from '../pages/ProfilePage'
import NotificationPage              from '../pages/NotificationPage'

const API = import.meta.env.PROD
  ? 'https://newaveflow-production.up.railway.app/api'
  : '/api'

// JWT payload의 exp(초 단위)를 보고 만료됐거나 bufferMs 이내에 만료되는지 확인
function isTokenExpiredOrExpiring(token, bufferMs = 5 * 60 * 1000) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(base64))
    return !exp || Date.now() > exp * 1000 - bufferMs
  } catch {
    return true
  }
}

// 세션 내 워밍업 완료 여부 (페이지 리로드 시 초기화됨)
let sessionWarmedUp = false

function ConnectingScreen({ slow }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        {slow ? (
          <>
            <p className="text-sm font-bold text-gray-700">서버를 시작하고 있습니다</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              처음 접속 시 최대 1분 정도 걸릴 수 있습니다
            </p>
          </>
        ) : (
          <p className="text-sm font-bold text-gray-500">서버에 연결 중...</p>
        )}
      </div>
    </div>
  )
}

function RequireAuth() {
  const { user, isHydrated, accessToken } = useAuthStore()
  const [warming, setWarming] = useState(() => !!(user && accessToken && !sessionWarmedUp))
  const [slowStart, setSlowStart] = useState(false)

  useEffect(() => {
    if (!warming) return

    let mounted = true

    // 5초 후 "서버 시작 중" 메시지로 전환
    const slowTimer = setTimeout(() => {
      if (mounted) setSlowStart(true)
    }, 5000)

    // 70초 후 강제 진행 (타임아웃)
    const forceTimer = setTimeout(() => {
      if (mounted) {
        sessionWarmedUp = true
        setWarming(false)
      }
    }, 70000)

    const tryWarmup = async () => {
      // 1단계: 백엔드 헬스체크 — 응답할 때까지 3초 간격 재시도
      while (mounted) {
        try {
          await client.get('/health')
          break
        } catch {
          if (!mounted) return
          await new Promise(r => setTimeout(r, 3000))
        }
      }

      if (!mounted) return

      // 2단계: 토큰 만료 선제 확인
      // /health는 인증 불필요라 토큰 만료를 감지 못함. 만료됐거나 5분 내 만료 예정이면
      // 페이지 렌더 전에 미리 갱신하여 데이터 로딩 실패를 방지한다.
      const { accessToken: tok, refreshToken: rtok, setAuth, clearAuth } = useAuthStore.getState()
      if (tok && isTokenExpiredOrExpiring(tok)) {
        try {
          const { data } = await axios.post(`${API}/auth/refresh`, { refreshToken: rtok })
          setAuth(data.user, data.accessToken, data.refreshToken)
          queryClient.clear()
        } catch {
          // 리프레시 토큰도 만료된 경우 — auth 초기화 후 렌더 시 /login으로 이동
          clearAuth()
        }
      }

      if (mounted) {
        sessionWarmedUp = true
        setWarming(false)
      }
    }

    tryWarmup()

    return () => {
      mounted = false
      clearTimeout(slowTimer)
      clearTimeout(forceTimer)
    }
  }, [warming])

  if (!isHydrated || warming) return <ConnectingScreen slow={slowStart} />

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
  { path: '/signup', element: <Signup /> },
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
          { path: '/meeting',         element: <MeetingAttendancePage /> },
          { path: '/meeting/prayer',  element: <PrayerMeetingPage /> },
          { path: '/meeting/sat',     element: <SatMeetingPage /> },
          { path: '/minutes',    element: <MeetingMinutesPage /> },
          { path: '/events',     element: <CalendarPage /> },
          { path: '/students/:id',  element: <StudentDetailPage /> },
          { path: '/evangelism',         element: <EvangelismPage /> },
          { path: '/roster',             element: <RosterPage /> },
          { path: '/event-attendance',     element: <EventAttendanceListPage /> },
          { path: '/event-attendance/:id', element: <EventAttendancePage /> },
          { path: '/class-manage',         element: <ClassManagePage /> },
          { path: '/notifications',        element: <NotificationPage /> },
          { path: '/profile',              element: <ProfilePage /> },
          {
            element: <RequireRole roles={['ADMIN', 'PASTOR', 'EXECUTIVE']} />,
            children: [
              { path: '/admin',             element: <AdminDashboard /> },
              { path: '/admin/teachers',    element: <AdminTeacherManagePage /> },
              { path: '/admin/calendar',    element: <CalendarAdminPage /> },
              { path: '/admin/evangelism',  element: <EvangelismAdminPage /> },
              { path: '/admin/minutes',     element: <MeetingMinutesAdminPage /> },
              { path: '/admin/meeting-attendance', element: <AdminMeetingAttendancePage /> },
              { path: '/admin/prayer',           element: <PrayerAbsentAdminPage /> },
              { path: '/admin/event-attendance', element: <EventAttendanceAdminPage /> },
              { path: '/admin/deactivation-requests', element: <DeactivationRequestsAdminPage /> },
              { path: '/admin/tts',              element: <TtsAdminPage /> },
              { path: '/admin/student-attendance', element: <AdminStudentAttendancePage /> },
              { path: '/executive',              element: <ExecutiveManagePage /> },
              { path: '/admin/class-assignment', element: <AdminClassManagePage /> },
                { path: '/admin/students',               element: <AdminStudentManagePage /> },
                { path: '/admin/pending-users',          element: <AdminPendingUsersPage /> },
                { path: '/admin/manual-preview/:type',    element: <ManualPreviewPage /> },
             ],
          },
        ],
      },
    ],
  },
])

export default router
