import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import useAuthStore from '../store/authStore'
import Button from '../components/common/Button'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [form, setForm]       = useState({ email: '', password: '' })
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(form.email, form.password)
      setAuth(data.user, data.accessToken, data.refreshToken)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 flex flex-col items-center justify-center px-6">

      {/* 로고 영역 */}
      <div className="mb-10 text-center animate-[fadeIn_0.5s_ease]">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur">
          <span className="text-3xl">⛪</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Newave Flow</h1>
        <p className="text-primary-200 mt-1 text-sm">교육부 교사 관리 시스템</p>
      </div>

      {/* 로그인 카드 */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 animate-[slideUp_0.4s_ease]">
        <h2 className="text-xl font-bold text-gray-900 mb-6">로그인</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="teacher@church.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="비밀번호를 입력하세요"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base pr-12 transition"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} className="mt-2">
            로그인
          </Button>
        </form>
      </div>

      <p className="text-primary-300 text-xs mt-6">
        계정 문의: 담당 임원에게 연락해주세요
      </p>
    </div>
  )
}
