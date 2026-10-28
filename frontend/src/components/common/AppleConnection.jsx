import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appleApi } from '../../api/apple'
import { appleAvailability, beginApple, isAppleCancellation } from '../../auth/apple'
import { nativePlatform } from '../../native/platform'
import AppleButton from './AppleButton'
import Card from './Card'
import useAuthStore from '../../store/authStore'
import AuthServiceStatus from './AuthServiceStatus'

export default function AppleConnection() {
  const passwordLoginEnabled = useAuthStore(state => state.user?.passwordLoginEnabled !== false)
  const { apiEnvironment, user } = useAuthStore()
  const queryClient = useQueryClient()
  const availability = useQuery({ queryKey: ['apple-availability', apiEnvironment, user?.id], queryFn: () => appleAvailability(), enabled: nativePlatform === 'ios' && apiEnvironment !== 'review', retry: false, staleTime: 60000 })
  const connection = useQuery({ queryKey: ['apple-connection', apiEnvironment, user?.id], queryFn: () => appleApi.connection().then(r => r.data), enabled: nativePlatform === 'ios' && apiEnvironment !== 'review' && availability.data === true, retry: false })
  const data = connection.data
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  if (nativePlatform !== 'ios') return null
  if (apiEnvironment === 'review' || availability.data !== true || availability.isError || !data || connection.isError) {
    const query = availability.data === true && !availability.isError ? connection : availability
    return <Card><h2 className="brand-section-title text-base font-semibold">Apple 계정 연결</h2>
      <AuthServiceStatus provider="Apple" environment={apiEnvironment} query={query} onRetry={() => query.refetch()} />
    </Card>
  }
  const connect = async () => {
    setLoading(true); setError('')
    try {
      await beginApple('LINK', password)
      setPassword('')
      await queryClient.invalidateQueries({ queryKey: ['apple-connection'] })
    } catch (err) {
      if (!isAppleCancellation(err)) setError(err.response?.data?.message || err.message || 'Apple 계정을 연결하지 못했습니다.')
    } finally { setLoading(false) }
  }
  return <Card>
    <h2 className="brand-section-title text-base font-semibold">Apple 계정 연결</h2>
    {data.connected ? <p role="status" className="mt-3 text-sm text-secondary-800">Apple 계정이 연결되어 있어요. 기존 기록으로 Apple 로그인을 이용할 수 있어요.</p>
      : !passwordLoginEnabled ? <p className="mt-3 text-sm leading-relaxed text-gray-600">Apple로 가입한 계정입니다. 다시 로그인할 때 같은 Apple 계정으로 인증해 주세요.</p> : <>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">현재 계정에 Apple 로그인을 추가해요. 반 배정과 출석·TTS 기록이 그대로 유지됩니다.</p>
      <label htmlFor="apple-link-password" className="mt-4 block text-sm font-semibold">본인 확인 · 현재 비밀번호</label>
      <input id="apple-link-password" type="password" autoComplete="current-password" value={password} maxLength={200} onChange={e => setPassword(e.target.value)} className="input-field mt-2 min-h-12 min-w-0 !text-base" />
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <AppleButton className="mt-3" onClick={connect} loading={loading} disabled={!password} />
    </>}
  </Card>
}
