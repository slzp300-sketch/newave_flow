import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import useAuthStore from '../store/authStore'
import Button from '../components/common/Button'
import Brand from '../components/common/Brand'
import EmailInput from '../components/common/EmailInput'
import KakaoButton from '../components/common/KakaoButton'
import { beginKakao } from '../auth/kakao'
import { flushAuthStorage } from '../native/platform'

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
  const [kakaoLoading, setKakaoLoading] = useState(false)
  const { data: kakaoConfig } = useQuery({ queryKey: ['kakao-config'], queryFn: () => authApi.kakaoConfig().then(r => r.data), retry: false, staleTime: 60000 })
  const handleKakao = async () => {
    setError(''); setKakaoLoading(true)
    try { await beginKakao() }
    catch (err) { setError(err.response?.data?.message || err.message || '카카오 로그인을 시작하지 못했습니다.') }
    finally { setKakaoLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(form.email, form.password)
      queryClient.clear()
      setAuth(data.user, data.accessToken, data.refreshToken)
      await flushAuthStorage()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? '로그인 또는 기기 저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-white max-w-mobile mx-auto">
      <div className="login-hero motion-login h-[254px] flex flex-col items-center justify-center text-white">
        <Brand emblem light />
        <p className="text-sm font-medium tracking-[.12em] mt-6">시대를 바꿀 새로운 파도</p>
      </div>
      <div className="motion-enter px-6 pt-7 pb-8" style={{ animationDelay: '100ms' }}>
        <h1 className="sr-only">뉴웨이브 로그인</h1>
        <p className="text-sm text-gray-500 mb-6">뉴웨이브 청소년부 교사 공간</p>
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
        {kakaoConfig?.enabled && <div className="mt-5">
          <div className="mb-4 flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />또는<span className="h-px flex-1 bg-gray-200" /></div>
          <KakaoButton onClick={handleKakao} loading={kakaoLoading} disabled={loading} />
          <p className="mt-2 text-center text-xs leading-relaxed text-gray-500">기존 회원은 이메일 로그인 후 내 정보에서 먼저 연결해 주세요.</p>
        </div>}
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500 mt-4">
          <button onClick={() => navigate('/find-account?tab=id')} className="min-h-11 rounded-xl px-4 py-3">아이디 찾기</button>
          <span aria-hidden="true" className="text-gray-300">·</span>
          <button onClick={() => navigate('/find-account?tab=pw')} className="min-h-11 rounded-xl px-4 py-3">비밀번호 찾기</button>
        </div>
        <div className="mt-5 pt-5 border-t border-gray-200 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
          <span>처음 오셨나요?</span> <button onClick={() => navigate('/signup')} className="min-h-11 rounded-xl px-5 py-3 font-semibold text-primary-700">회원가입</button>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          <button className="min-h-11 px-4 py-3 rounded-xl" onClick={() => navigate('/support')}>고객지원</button>
          <button className="min-h-11 px-4 py-3 rounded-xl" onClick={() => navigate('/account-deletion')}>계정 삭제 요청</button>
        </div>
        <p className="text-center mt-5 text-xs tracking-[.2em] text-gray-400">NEWAVE YOUTH MINISTRY</p>
      </div>
    </div>
  )
}
