import { Link, useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import PrivacyDocument from '../components/common/PrivacyDocument'
import useAuthStore from '../store/authStore'

export default function PrivacyPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const back = () => location.key === 'default' ? navigate(user ? '/profile' : '/login', { replace: true }) : navigate(-1)
  return <div className="min-h-screen bg-surface max-w-mobile mx-auto pb-10">
    <Header title="개인정보처리방침" showBack onBack={back} showNotification={false} />
    <PrivacyDocument />
    <nav className="flex flex-wrap justify-center gap-2 px-4 text-xs text-primary-700" aria-label="개인정보 이용 지원">
      <Link className="inline-flex min-h-11 items-center px-3" to="/support">고객지원</Link>
      <Link className="inline-flex min-h-11 items-center px-3" to="/account-deletion">계정 삭제 요청</Link>
    </nav>
  </div>
}
