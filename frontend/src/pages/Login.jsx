import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import useAuthStore from '../store/authStore'
import Button from '../components/common/Button'
import Brand from '../components/common/Brand'
import EmailInput from '../components/common/EmailInput'
import KakaoButton from '../components/common/KakaoButton'
import AppleButton from '../components/common/AppleButton'
import { beginKakao } from '../auth/kakao'
import { appleAvailability, beginApple, clearApplePending, isAppleCancellation } from '../auth/apple'
import { flushAuthStorage, nativePlatform } from '../native/platform'
import { loginEnvironment } from '../auth/reviewEnvironment'
import { appleSessionIdentity } from '../auth/authIdentity'

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
  const [appleLoading, setAppleLoading] = useState(false)
  const [appleRegistration, setAppleRegistration] = useState(false)
  const { data: appleEnabled } = useQuery({ queryKey: ['apple-availability'], queryFn: appleAvailability, enabled: nativePlatform === 'ios', retry: false, staleTime: 60000 })
  const { data: kakaoConfig } = useQuery({ queryKey: ['kakao-config'], queryFn: () => authApi.kakaoConfig().then(r => r.data), retry: false, staleTime: 60000 })
  const handleKakao = async () => {
    setError(''); setKakaoLoading(true)
    try { await beginKakao() }
    catch (err) { setError(err.response?.data?.message || err.message || '카카오 로그인을 시작하지 못했습니다.') }
    finally { setKakaoLoading(false) }
  }
  const handleApple = async () => {
    setError(''); setAppleLoading(true)
    try {
      const result = await beginApple()
      if (result.status === 'REGISTRATION_REQUIRED') { setAppleRegistration(true); return }
      const identity = appleSessionIdentity(result.appleSubject)
      queryClient.clear()
      setAuth(result.session.user, result.session.accessToken, result.session.refreshToken, 'production', identity)
      await flushAuthStorage()
      navigate('/', { replace: true })
    } catch (err) {
      if (!isAppleCancellation(err)) setError(err.response?.data?.message || err.message || 'Apple 로그인을 완료하지 못했습니다.')
    } finally { setAppleLoading(false) }
  }
  if (appleRegistration) return <div className="safe-page-top min-h-screen max-w-mobile mx-auto bg-white px-6 pb-10" style={{ '--safe-page-space': '2.5rem' }}>
    <h1 className="text-xl font-semibold">계정 연결 또는 가입 신청</h1>
    <p className="mt-4 text-sm leading-relaxed text-gray-600">Apple 인증을 완료했어요. 기존 회원은 이메일로 로그인한 뒤 ‘내 정보 → 계정 연결 관리 → Apple 계정 연결’을 이용해 주세요.</p>
    <p className="mt-3 text-xs leading-relaxed text-gray-500">이메일이 같더라도 기존 계정과 자동으로 연결하지 않습니다. 반 배정과 기록을 이어가려면 기존 계정에서 연결해 주세요.</p>
    <button className="mt-6 min-h-12 w-full rounded-xl border border-gray-200 px-4 text-sm font-semibold" onClick={() => { clearApplePending(); setAppleRegistration(false) }}>기존 이메일 계정으로 로그인</button>
    <Link to="/signup?apple=1" className="brand-action mt-4 flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold">처음이에요 · 가입 신청</Link>
    <p className="mt-3 text-xs leading-relaxed text-gray-500">새로 가입하면 관리자의 승인 후 이용할 수 있어요.</p>
  </div>
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(form.email, form.password)
      queryClient.clear()
      setAuth(data.user, data.accessToken, data.refreshToken, data.apiEnvironment)
      await flushAuthStorage()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? '로그인 또는 기기 저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="safe-page-top min-h-screen bg-white max-w-mobile mx-auto">
      <div className={`login-hero motion-login ${appleEnabled ? 'h-[180px]' : 'h-[254px]'} flex flex-col items-center justify-center text-white`}>
        <Brand emblem light />
        <p className="text-sm font-medium tracking-[.12em] mt-6">시대를 바꿀 새로운 파도</p>
      </div>
      <div className="motion-enter px-6 pt-7 pb-8" style={{ animationDelay: '100ms' }}>
        <h1 className="sr-only">뉴웨이브 로그인</h1>
        <p className="text-sm text-gray-500 mb-6">뉴웨이브 청소년부 교사 공간</p>
        {appleEnabled && error && <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {appleEnabled && <div className="mb-5">
          <AppleButton onClick={handleApple} loading={appleLoading} disabled={loading || kakaoLoading} />
          {kakaoConfig?.enabled && <KakaoButton onClick={handleKakao} loading={kakaoLoading} disabled={loading || appleLoading} className="mt-3" />}
          <p className="mt-3 text-center text-xs leading-relaxed text-gray-500">기존 회원은 이메일 로그인 후 내 정보에서 먼저 연결해 주세요.</p>
          <div className="mt-4 flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />이메일로 로그인<span className="h-px flex-1 bg-gray-200" /></div>
        </div>}
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
          {loginEnvironment(form.email) === 'review' && <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">가상 심사 환경으로 로그인합니다. 실제 회원·학생 기록과 분리되어 있습니다.</p>}
          {!appleEnabled && error && <div role="alert" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
          <Button type="submit" size="lg" loading={loading} disabled={kakaoLoading || appleLoading} className="mt-1">로그인</Button>
        </form>
        {kakaoConfig?.enabled && !appleEnabled && <div className="mt-5">
          <div className="mb-4 flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />또는<span className="h-px flex-1 bg-gray-200" /></div>
          <KakaoButton onClick={handleKakao} loading={kakaoLoading} disabled={loading || appleLoading} />
          <p className="mt-2 text-center text-xs leading-relaxed text-gray-500">기존 회원은 이메일 로그인 후 내 정보에서 먼저 연결해 주세요.</p>
        </div>}
        <nav aria-label="회원가입 및 계정 찾기" className="mt-4 flex flex-wrap items-center justify-center gap-x-1 border-t border-gray-200 pt-3 text-xs text-gray-500">
          <Link to="/signup" className="inline-flex min-h-11 items-center px-2 py-2 font-semibold text-primary-700">회원가입</Link>
          <span aria-hidden="true" className="text-gray-300">·</span>
          <Link to="/find-account?tab=id" className="inline-flex min-h-11 items-center px-2 py-2">아이디 찾기</Link>
          <span aria-hidden="true" className="text-gray-300">·</span>
          <Link to="/find-account?tab=pw" className="inline-flex min-h-11 items-center px-2 py-2">비밀번호 찾기</Link>
        </nav>
        <nav aria-label="이용 지원" className="mt-1 flex flex-wrap justify-center gap-x-4 text-[11px] text-gray-500">
          <Link className="inline-flex min-h-11 items-center px-2 py-2" to="/privacy">개인정보처리방침</Link>
          <Link className="inline-flex min-h-11 items-center px-2 py-2" to="/support">고객지원</Link>
          <Link className="inline-flex min-h-11 items-center px-2 py-2" to="/account-deletion">계정 삭제 요청</Link>
        </nav>
        <p className="text-center mt-5 text-xs tracking-[.2em] text-gray-400">NEWAVE YOUTH MINISTRY</p>
      </div>
    </div>
  )
}
