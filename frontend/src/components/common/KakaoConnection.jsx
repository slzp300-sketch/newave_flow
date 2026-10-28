import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { beginKakao } from '../../auth/kakao'
import Card from './Card'
import KakaoButton from './KakaoButton'
import useAuthStore from '../../store/authStore'

export default function KakaoConnection() {
  const passwordLoginEnabled = useAuthStore(state => state.user?.passwordLoginEnabled !== false)
  const [params] = useSearchParams()
  const { data } = useQuery({ queryKey: ['kakao-connection'], queryFn: () => authApi.kakaoConnection().then(r => r.data), retry: false })
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  if (!passwordLoginEnabled || !data || (!data.enabled && !data.connected)) return null
  const connect = async () => {
    setLoading(true); setError('')
    try { await beginKakao('LINK', password); setPassword('') }
    catch (err) { setError(err.response?.data?.message || err.message || '카카오 연결을 시작하지 못했습니다.') }
    finally { setLoading(false) }
  }
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-bold leading-snug text-gray-900">카카오 계정</h2>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${data.connected ? 'bg-secondary-50 text-secondary-800' : 'bg-gray-100 text-gray-600'}`}>
        {data.connected && <CheckCircle2 size={16} aria-hidden="true" className="shrink-0" />}
        {data.connected ? '연결됨' : '연결 안 됨'}
      </span>
    </div>
    {data.connected ? <p role="status" className="mt-3 text-sm leading-relaxed text-gray-600">{params.get('kakao') === 'linked' ? '카카오 계정을 연결했어요. ' : ''}기존 기록으로 카카오 로그인을 이용할 수 있어요.</p> : <>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">현재 계정에 카카오 로그인을 추가할 수 있어요.</p>
      <label htmlFor="kakao-link-password" className="mt-5 block text-sm font-semibold text-gray-700">본인 확인 · 현재 비밀번호</label>
      <input id="kakao-link-password" type="password" autoComplete="current-password" value={password} maxLength={200} onChange={e => setPassword(e.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-primary-300" />
      {error && <p role="alert" className="mt-3 text-sm leading-relaxed text-red-700">{error}</p>}
      <KakaoButton className="mt-4 !text-base" onClick={connect} loading={loading} disabled={!password}>카카오 계정 연결</KakaoButton>
    </>}
  </Card>
}
