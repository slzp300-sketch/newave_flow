import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import useAuthStore from '../store/authStore'
import Button from '../components/common/Button'
import EmailInput from '../components/common/EmailInput'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

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
      queryClient.clear()
      setAuth(data.user, data.accessToken, data.refreshToken)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-white max-w-mobile mx-auto">
      <div className="login-hero motion-login text-white">
        <img src="/brand/newave-blue-artwork.png" alt="NEWAVE" width="566" height="317" className="login-artwork" fetchpriority="high" />
        <p className="flex items-center justify-center gap-2 px-4 py-4 text-xs font-medium tracking-[.12em]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary-300" />시대를 바꿀 새로운 파도
        </p>
      </div>
      <div className="motion-enter px-6 pt-7 pb-8" style={{ animationDelay: '100ms' }}>
        <h1 className="text-2xl leading-snug font-semibold tracking-tight">새로운 한 주를<br />함께 시작해요</h1>
        <p className="text-sm text-gray-500 mt-2 mb-6">뉴웨이브 청소년부 교사 공간</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">아이디</label>
            <EmailInput onChange={email => setForm(f => ({ ...f, email }))} />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium mb-2">비밀번호</label>
            <div className="relative">
              <input id="login-password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="비밀번호를 입력하세요" required className="input-field pr-12" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={showPw}
                className="absolute right-1 top-1/2 -translate-y-1/2 icon-button">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <div role="alert" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
          <Button type="submit" size="lg" loading={loading} className="mt-1">로그인</Button>
        </form>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mt-3">
          <button onClick={() => navigate('/find-account?tab=id')} className="min-h-11">아이디 찾기</button>
          <span aria-hidden="true" className="text-gray-300">·</span>
          <button onClick={() => navigate('/find-account?tab=pw')} className="min-h-11">비밀번호 찾기</button>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
          처음 오셨나요? <button onClick={() => navigate('/signup')} className="min-h-11 ml-2 font-semibold text-primary-700">회원가입</button>
        </div>
        <p className="text-center mt-5 text-xs tracking-[.2em] text-gray-400">NEWAVE YOUTH MINISTRY</p>
      </div>
    </div>
  )
}
