import { useState } from 'react'
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
    <h2 className="brand-section-title text-sm font-semibold">카카오 계정 연결</h2>
    {data.connected ? <p role="status" className="mt-3 text-sm text-secondary-800">{params.get('kakao') === 'linked' ? '카카오 계정을 연결했어요. ' : '카카오 계정 연결됨 · '}기존 기록으로 카카오 로그인을 이용할 수 있어요.</p> : <>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">현재 계정에 카카오 로그인을 추가해요. 반 배정과 출석·TTS 기록이 그대로 유지됩니다.</p>
      <label htmlFor="kakao-link-password" className="mt-4 block text-xs font-semibold">본인 확인 · 현재 비밀번호</label>
      <input id="kakao-link-password" type="password" autoComplete="current-password" value={password} maxLength={200} onChange={e => setPassword(e.target.value)} className="input-field mt-2" />
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <KakaoButton className="mt-3" onClick={connect} loading={loading} disabled={!password}>카카오 계정 연결</KakaoButton>
    </>}
  </Card>
}
