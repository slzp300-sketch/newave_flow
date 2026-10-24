import useAuthStore from '../../store/authStore'
import { Link } from 'react-router-dom'

export default function ReviewEnvironmentNotice() {
  const environment = useAuthStore(state => state.apiEnvironment)
  if (environment !== 'review') return null
  return <div role="status" className="w-full bg-amber-50 px-4 py-2 text-center text-xs leading-5 text-amber-900">가상 자료 계정 · 실제 회원·학생 자료와 분리됨 <Link className="underline font-semibold" to="/app-guide">기능·계정 안내</Link></div>
}
