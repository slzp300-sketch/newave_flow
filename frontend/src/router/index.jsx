import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { queryClient } from '../queryClient'
import AppLayout from '../components/layout/AppLayout'
import client, { refreshSession } from '../api/client'

const Signup = lazy(() => import('../pages/Signup'))
const Login = lazy(() => import('../pages/Login'))
const FindAccountPage = lazy(() => import('../pages/FindAccountPage'))
const Home = lazy(() => import('../pages/Home'))
const AttendancePage = lazy(() => import('../pages/AttendancePage'))
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'))
const CalendarPage = lazy(() => import('../pages/CalendarPage'))
const CalendarAdminPage = lazy(() => import('../pages/CalendarAdminPage'))
const PrayerMeetingPage = lazy(() => import('../pages/PrayerMeetingPage'))
const SatMeetingPage = lazy(() => import('../pages/SatMeetingPage'))
const StudentDetailPage = lazy(() => import('../pages/StudentDetailPage'))
const TTSPage = lazy(() => import('../pages/TTSPage'))
const EvangelismPage = lazy(() => import('../pages/EvangelismPage'))
const EvangelismAdminPage = lazy(() => import('../pages/EvangelismAdminPage'))
const MeetingMinutesPage = lazy(() => import('../pages/MeetingMinutesPage'))
const MeetingMinutesAdminPage = lazy(() => import('../pages/MeetingMinutesAdminPage'))
const PrayerAbsentAdminPage = lazy(() => import('../pages/PrayerAbsentAdminPage'))
const WeeklyCheckPage = lazy(() => import('../pages/WeeklyCheckPage'))
const RosterPage = lazy(() => import('../pages/RosterPage'))
const EventAttendanceListPage = lazy(() => import('../pages/EventAttendanceListPage'))
const EventAttendancePage = lazy(() => import('../pages/EventAttendancePage'))
const EventAttendanceAdminPage = lazy(() => import('../pages/EventAttendanceAdminPage'))
const AdminMeetingAttendancePage = lazy(() => import('../pages/AdminMeetingAttendancePage'))
const ClassManagePage = lazy(() => import('../pages/ClassManagePage'))
const DeactivationRequestsAdminPage = lazy(() => import('../pages/DeactivationRequestsAdminPage'))
const TtsAdminPage = lazy(() => import('../pages/TtsAdminPage'))
const MenuPage = lazy(() => import('../pages/MenuPage'))
const AdminTeacherManagePage = lazy(() => import('../pages/AdminTeacherManagePage'))
const AdminClassManagePage = lazy(() => import('../pages/AdminClassManagePage'))
const AdminStudentManagePage = lazy(() => import('../pages/AdminStudentManagePage'))
const AdminPendingUsersPage = lazy(() => import('../pages/AdminPendingUsersPage'))
const AdminStudentAttendancePage = lazy(() => import('../pages/AdminStudentAttendancePage'))
const ManualPreviewPage = lazy(() => import('../pages/ManualPreviewPage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))
const NotificationPage = lazy(() => import('../pages/NotificationPage'))

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

// 세션 내 서버 워밍업 완료 여부 (페이지 리로드 시 초기화됨)
// ※ 토큰 갱신과 분리: 워밍업은 서버 헬스체크만 담당
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

  // 서버 워밍업이 필요한 경우: 로그인 상태인데 아직 워밍업 안 된 경우
  const needsWarmup = !!(user && accessToken && !sessionWarmedUp)

  // 토큰 갱신이 필요한 경우: 워밍업 완료됐지만 토큰이 만료됐거나 5분 내 만료 예정
  // sessionWarmedUp과 무관하게 항상 체크 (SPA 내 페이지 이동 시에도 동작)
  const needsTokenRefresh = !!(user && accessToken && !needsWarmup && isTokenExpiredOrExpiring(accessToken))

  const [warming, setWarming] = useState(() => needsWarmup)
  const [refreshing, setRefreshing] = useState(() => needsTokenRefresh)
  const [slowStart, setSlowStart] = useState(false)
  useEffect(() => { if (needsTokenRefresh) setRefreshing(true) }, [needsTokenRefresh])

  // ─── 서버 워밍업 (백엔드 첫 기동 시) ───
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
      const { accessToken: tok } = useAuthStore.getState()
      if (tok && isTokenExpiredOrExpiring(tok)) {
        try {
          await refreshSession()

          queryClient.clear()
        } catch {
          // 리프레시 토큰도 만료된 경우 — auth 초기화 후 렌더 시 /login으로 이동
          // refreshSession clears authentication only for rejected credentials.
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

  // ─── 토큰 선제 갱신 (워밍업 완료 후, 오래된 세션에서 페이지 이동 시) ───
  useEffect(() => {
    if (!refreshing) return

    let mounted = true

    const tryRefresh = async () => {
      const { accessToken: tok } = useAuthStore.getState()
      if (tok && isTokenExpiredOrExpiring(tok)) {
        try {
          await refreshSession()

          queryClient.clear()
        } catch {
          // refreshSession clears authentication only for rejected credentials.
        }
      }
      if (mounted) setRefreshing(false)
    }

    tryRefresh()
    return () => { mounted = false }
  }, [refreshing])

  if (!isHydrated || warming || refreshing) return <ConnectingScreen slow={slowStart} />

  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireRole({ roles }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}

const router = createBrowserRouter([{ element: <Suspense fallback={<ConnectingScreen />}><Outlet /></Suspense>, children: [
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/find-account', element: <FindAccountPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/',           element: <Home /> },
          { path: '/menu',       element: <MenuPage /> },
          { path: '/attendance', element: <AttendancePage /> },
          { path: '/calendar',   element: <CalendarPage /> },
          { path: '/checklist',  element: <WeeklyCheckPage /> },
          { path: '/tts',        element: <TTSPage /> },
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
] }])

export default router
