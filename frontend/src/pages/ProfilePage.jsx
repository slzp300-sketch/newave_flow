import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, User, Mail, Phone, Shield, ChevronRight } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { authApi } from '../api/auth'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'

const ROLE_MAP = {
  PASTOR:    { label: '목사님',  variant: 'info',    bg: 'bg-blue-100    text-blue-700' },
  EXECUTIVE: { label: '임원',    variant: 'warning', bg: 'bg-amber-100   text-amber-700' },
  TEACHER:   { label: '교사',    variant: 'success', bg: 'bg-emerald-100 text-emerald-700' },
}

export default function ProfilePage() {
  const navigate       = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const roleCfg = ROLE_MAP[user?.role] ?? ROLE_MAP.TEACHER

  const handleLogout = async () => {
    setLoading(true)
    try { await authApi.logout() } catch {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header title="내 정보" />

      {/* 프로필 카드 */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-6 pt-8 pb-14">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white/40">
            <span className="text-white text-3xl font-black">
              {user?.name?.[0] ?? '?'}
            </span>
          </div>
          <div className="text-center">
            <h2 className="text-white text-xl font-black">{user?.name}</h2>
            <span className={`inline-block mt-1.5 text-xs font-bold px-3 py-1 rounded-full ${roleCfg.bg}`}>
              {roleCfg.label}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 flex flex-col gap-3 pb-10">
        {/* 계정 정보 */}
        <Card className="flex flex-col gap-0 overflow-hidden !p-0">
          <p className="text-xs font-bold text-gray-400 px-4 pt-4 pb-2 uppercase tracking-widest">계정 정보</p>

          <InfoRow icon={User}   label="이름"  value={user?.name} />
          <InfoRow icon={Mail}   label="이메일" value={user?.email} divider />
          <InfoRow icon={Shield} label="권한"  value={roleCfg.label} divider />
        </Card>

        {/* 앱 정보 */}
        <Card className="!p-0 overflow-hidden">
          <p className="text-xs font-bold text-gray-400 px-4 pt-4 pb-2 uppercase tracking-widest">앱 정보</p>
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-50">
            <span className="text-sm text-gray-700">버전</span>
            <span className="text-sm text-gray-400">v0.1.0</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-50">
            <span className="text-sm text-gray-700">Newave Flow</span>
            <span className="text-sm text-gray-400">교회 교육부 관리 시스템</span>
          </div>
        </Card>

        {/* 로그아웃 */}
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            className="w-full flex items-center justify-center gap-2.5 bg-white border border-red-200 text-red-500 font-bold py-4 rounded-2xl active:bg-red-50 transition-colors"
          >
            <LogOut size={18} />
            로그아웃
          </button>
        ) : (
          <Card className="flex flex-col gap-3 border border-red-100 bg-red-50">
            <p className="text-center font-semibold text-gray-800 text-sm">
              정말 로그아웃 하시겠어요?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 font-semibold text-sm active:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:bg-red-600 disabled:opacity-60"
              >
                {loading ? '처리 중...' : '로그아웃'}
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, divider = false }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${divider ? 'border-t border-gray-50' : ''}`}>
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{value ?? '-'}</p>
      </div>
    </div>
  )
}