import './SupportingReadability.css'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { completeKakao, clearKakaoPending } from '../auth/kakao'
import { flushAuthStorage } from '../native/platform'
import useAuthStore from '../store/authStore'
import Header from '../components/layout/Header'

export default function KakaoCallbackPage() {
  const { hash } = useLocation()
  const [initialHash] = useState(hash)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('카카오 계정을 확인하고 있어요.')
  useEffect(() => {
    if (!hash) {
      if (!initialHash) { setStatus('error'); setMessage('로그인 화면에서 카카오 인증을 다시 시작해 주세요.') }
      return
    }
    let disposed = false
    completeKakao(hash).then(async result => {
      if (disposed) return
      if (result.status === 'SIGNED_IN') {
        queryClient.clear()
        useAuthStore.getState().setAuth(result.session.user, result.session.accessToken, result.session.refreshToken)
        await flushAuthStorage()
        navigate('/', { replace: true })
      } else if (result.status === 'LINKED') {
        void queryClient.invalidateQueries({ queryKey: ['kakao-connection'] })
        navigate('/profile/connections?kakao=linked', { replace: true })
      } else {
        setStatus(result.status === 'REGISTRATION_REQUIRED' ? 'register' : 'error')
        setMessage(result.message || '아직 Newave Flow 계정에 연결되지 않은 카카오 계정이에요.')
        navigate('/auth/kakao/callback', { replace: true })
      }
    }).catch(error => {
      if (disposed) return
      setStatus('error'); setMessage(error.response?.data?.message || error.message || '카카오 로그인에 실패했습니다.')
      navigate('/auth/kakao/callback', { replace: true })
    })
    return () => { disposed = true }
  }, [hash, navigate, queryClient])
  return <div className="supporting-readable readable-content min-h-screen max-w-mobile mx-auto bg-white">
    <Header title="카카오 계정 확인" showBack onBack={() => navigate('/login', { replace: true })} showNotification={false} />
    <div className="px-6 py-8">
      <h2 className="text-xl font-semibold">{status === 'register' ? '계정 연결 또는 가입 신청' : status === 'error' ? '다시 확인해 주세요' : '카카오 인증 중'}</h2>
      <p role="status" className="mt-4 text-sm leading-relaxed text-gray-600">{message}</p>
      {status === 'register' && <>
        <div className="mt-6 rounded-2xl border border-primary-200 p-4">
          <h3 className="font-semibold">이미 가입한 교사인가요?</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">이메일로 로그인한 뒤 ‘내 정보 → 계정 연결 관리 → 카카오 계정 연결’을 이용해 주세요. 기존 출석과 TTS 기록이 그대로 이어집니다.</p>
          <button className="mt-4 min-h-11 w-full rounded-xl px-3 text-sm font-semibold" onClick={async () => { await clearKakaoPending(); navigate('/login', { replace: true }) }}>기존 이메일 계정으로 로그인</button>
        </div>
        <Link to="/signup?kakao=1" className="brand-action mt-4 flex min-h-12 items-center justify-center rounded-xl border border-primary-200 px-4 text-sm font-semibold">처음이에요 · 가입 신청</Link>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">새로 가입하면 관리자의 승인 후 이용할 수 있어요.</p>
      </>}
      {status === 'error' && <Link to="/login" replace className="brand-action mt-6 flex min-h-12 items-center justify-center rounded-xl px-4 text-sm">로그인 화면으로</Link>}
    </div>
  </div>
}
