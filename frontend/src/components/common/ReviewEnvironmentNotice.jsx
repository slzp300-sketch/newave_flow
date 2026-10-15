import useAuthStore from '../../store/authStore'

export default function ReviewEnvironmentNotice() {
  const environment = useAuthStore(state => state.apiEnvironment)
  if (environment !== 'review') return null
  return <div role="status" className="w-full bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">가상 심사 환경 · 실제 회원·학생 자료와 분리됨</div>
}
