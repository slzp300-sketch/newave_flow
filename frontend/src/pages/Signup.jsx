import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { authApi } from '../api/auth'
import Button from '../components/common/Button'
import Header from '../components/layout/Header'
import EmailInput from '../components/common/EmailInput'
import { readKakaoPending, registerWithKakao } from '../auth/kakao'
import { readApplePending, registerWithApple } from '../auth/apple'

export default function Signup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isKakao = params.get('kakao') === '1'
  const isApple = params.get('apple') === '1' && !isKakao
  const isSocial = isKakao || isApple
  const socialName = isApple ? 'Apple' : '카카오'
  const [kakaoReady, setKakaoReady] = useState(false)
  const [appleReady, setAppleReady] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const [form, setForm]         = useState({ name: '', email: '', password: '', phone: '' })
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  useEffect(() => {
    if (!isKakao) return
    let disposed = false
    readKakaoPending().then(pending => {
      if (disposed) return
      if (pending?.registrationTicket) setKakaoReady(true)
      else setError('카카오 인증 시간이 지났어요. 로그인 화면에서 다시 시작해 주세요.')
    }).catch(() => { if (!disposed) setError('카카오 인증을 확인하지 못했어요. 다시 로그인해 주세요.') })
    return () => { disposed = true }
  }, [isKakao])
  useEffect(() => {
    if (!isApple) return
    const ready = readApplePending()
    setAppleReady(ready)
    if (!ready) setError('Apple 인증 시간이 지났어요. 로그인 화면에서 다시 시작해 주세요.')
  }, [isApple])

  const [nameStatus, setNameStatus]   = useState('idle') // idle, loading, available, duplicate
  const [emailStatus, setEmailStatus] = useState('idle')

  const [phone1, setPhone1] = useState('')
  const [phone2, setPhone2] = useState('')
  const phone2Ref = useRef(null)

  // 이름 중복 체크 (디바운스)
  useEffect(() => {
    if (!form.name.trim()) {
      setNameStatus('idle')
      return
    }
    setNameStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const res = await authApi.checkName(form.name)
        setNameStatus(res.data.available ? 'available' : 'duplicate')
      } catch (err) {
        setNameStatus('idle')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [form.name])

  // 이메일 중복 체크 (디바운스)
  useEffect(() => {
    if (!form.email.trim()) {
      setEmailStatus('idle')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      setEmailStatus('idle')
      return
    }

    setEmailStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const res = await authApi.checkEmail(form.email)
        setEmailStatus(res.data.available ? 'available' : 'duplicate')
      } catch (err) {
        setEmailStatus('idle')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [form.email])

  const pwMatch = confirmPw === '' ? null : form.password === confirmPw

  const isSubmitDisabled = loading || (isKakao && !kakaoReady) || (isApple && !appleReady) ||
                           nameStatus === 'duplicate' || 
                           emailStatus === 'duplicate' || 
                           nameStatus === 'loading' || 
                           emailStatus === 'loading' ||
                           !form.password ||
                           pwMatch === false

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = { ...form }
    const rawPhone = phone1 + phone2
    if (rawPhone) {
      if (rawPhone.length !== 8) {
        setError('전화번호 앞뒤 4자리를 모두 입력해주세요.')
        setLoading(false)
        return
      }
      payload.phone = `010-${phone1}-${phone2}`
    } else {
      payload.phone = ''
    }

    try {
      if (isKakao) await registerWithKakao(payload)
      else if (isApple) await registerWithApple(payload)
      else await authApi.register(payload)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message ?? '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-secondary-100 text-secondary-700 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">가입 신청 완료</h2>
        <p className="text-gray-500 text-center text-sm mb-8">
          관리자의 승인 후 정상적인 이용이 가능합니다.<br/>잠시만 기다려주세요!
        </p>
        <Button onClick={() => navigate('/login')} className="w-full max-w-xs">
          로그인 화면으로
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="회원가입" showBack />
      
      <div className="px-6 pt-6 pb-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">환영합니다!</h2>
        <p className="text-gray-500 text-sm mb-8">{isSocial ? `${socialName} 인증을 완료했어요. 가입 신청 후 관리자 승인을 기다려 주세요.` : '새로운 웨이브에 합류하세요'}</p>
        {isSocial && <p className="mb-5 rounded-xl border border-secondary-200 bg-secondary-50 p-3 text-sm leading-relaxed text-secondary-800">이메일로도 로그인할 수 있도록 이메일과 비밀번호를 함께 설정해 주세요. 이미 가입했다면 새로 신청하지 말고 기존 계정에서 {socialName} 계정을 연결해 주세요.</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="실명을 입력하세요"
              required
              className={`w-full px-4 py-3 rounded-xl bg-white border focus:outline-none focus:ring-2 text-sm font-medium transition ${
                nameStatus === 'duplicate' ? 'border-red-300 focus:ring-red-500' : 
                nameStatus === 'available' ? 'border-secondary-300 focus:ring-secondary-500' : 'border-gray-200 focus:ring-primary-500'
              }`}
            />
            {nameStatus === 'duplicate' && <p className="text-red-500 text-xs font-bold mt-1.5 px-1">이미 가입된 이름입니다.</p>}
            {nameStatus === 'available' && <p className="text-secondary-700 text-xs font-bold mt-1.5 px-1">사용 가능한 이름입니다.</p>}
            {nameStatus === 'loading' && <p className="text-gray-400 text-xs font-bold mt-1.5 px-1">확인 중...</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">이메일 (아이디)</label>
            <EmailInput
              onChange={(email) => setForm(f => ({ ...f, email }))}
              status={emailStatus}
            />
            {emailStatus === 'duplicate' && <p className="text-red-500 text-xs font-bold mt-1.5 px-1">이미 사용 중인 이메일입니다.</p>}
            {emailStatus === 'available' && <p className="text-secondary-700 text-xs font-bold mt-1.5 px-1">사용 가능한 이메일입니다.</p>}
            {emailStatus === 'loading' && <p className="text-gray-400 text-xs font-bold mt-1.5 px-1">확인 중...</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="비밀번호 설정"
                minLength={isSocial ? 8 : undefined}
                maxLength={200}
                required
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium pr-12 transition"
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

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">비밀번호 확인</label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="비밀번호를 한 번 더 입력하세요"
                required
                className={`w-full px-4 py-3 rounded-xl bg-white border focus:outline-none focus:ring-2 text-sm font-medium pr-12 transition ${
                  pwMatch === false ? 'border-red-300 focus:ring-red-400' :
                  pwMatch === true  ? 'border-secondary-300 focus:ring-secondary-400' :
                                      'border-gray-200 focus:ring-primary-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
              >
                {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {pwMatch === false && (
              <p className="flex items-center gap-1 text-red-500 text-xs font-bold mt-1.5 px-1">
                <XCircle size={12} /> 비밀번호가 일치하지 않습니다.
              </p>
            )}
            {pwMatch === true && (
              <p className="flex items-center gap-1 text-secondary-700 text-xs font-bold mt-1.5 px-1">
                <CheckCircle2 size={12} /> 비밀번호가 일치합니다.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">전화번호</label>
            <div className="flex items-center gap-2">
              <div className="flex-[3] px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 select-none text-center">
                010
              </div>
              <span className="text-gray-400 font-bold shrink-0">-</span>
              <input
                type="tel"
                maxLength={4}
                value={phone1}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                  setPhone1(val)
                  if (val.length === 4) phone2Ref.current?.focus()
                }}
                className="flex-[4] min-w-0 px-4 py-3 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium transition tracking-widest"
              />
              <span className="text-gray-400 font-bold shrink-0">-</span>
              <input
                ref={phone2Ref}
                type="tel"
                maxLength={4}
                value={phone2}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                  setPhone2(val)
                }}
                className="flex-[4] min-w-0 px-4 py-3 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium transition tracking-widest"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-[13px] font-bold px-4 py-3 rounded-xl mt-2">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} disabled={isSubmitDisabled} className="mt-4 shadow-glow">
            가입 신청하기
          </Button>
          <Link to="/privacy" className="flex min-h-11 items-center justify-center text-xs text-gray-500 underline">개인정보처리방침 보기</Link>
        </form>
      </div>
    </div>
  )
}
