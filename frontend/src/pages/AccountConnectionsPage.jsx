import { useNavigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import KakaoConnection from '../components/common/KakaoConnection'
import AppleConnection from '../components/common/AppleConnection'
import useAuthStore from '../store/authStore'
import { nativePlatform } from '../native/platform'

export default function AccountConnectionsPage() {
  const navigate = useNavigate()
  const passwordLoginEnabled = useAuthStore(state => state.user?.passwordLoginEnabled !== false)
  return <div className="min-h-screen pb-8">
    <Header title="계정 연결 관리" showBack onBack={() => navigate('/profile')} />
    <div className="flex flex-col gap-4 px-4 py-5">
      <p className="text-sm leading-relaxed text-gray-600">연결한 로그인 방법으로 같은 계정과 기록을 이용합니다.</p>
      <KakaoConnection />
      <AppleConnection />
      {nativePlatform !== 'ios' && <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-600">Apple 계정 연결은 iPhone 앱에서 관리할 수 있습니다.</p>}
      {!passwordLoginEnabled && <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-600">Apple로 가입한 계정은 가입할 때 사용한 Apple 계정으로 로그인해 주세요.</p>}
    </div>
  </div>
}
