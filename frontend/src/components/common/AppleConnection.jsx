import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appleApi } from '../../api/apple'
import { appleAvailability, beginApple, isAppleCancellation } from '../../auth/apple'
import { nativePlatform } from '../../native/platform'
import AppleButton from './AppleButton'
import Card from './Card'
import useAuthStore from '../../store/authStore'

export default function AppleConnection() {
  const passwordLoginEnabled = useAuthStore(state => state.user?.passwordLoginEnabled !== false)
  const queryClient = useQueryClient()
  const { data: available } = useQuery({ queryKey: ['apple-availability'], queryFn: appleAvailability, enabled: nativePlatform === 'ios', retry: false, staleTime: 60000 })
  const { data } = useQuery({ queryKey: ['apple-connection'], queryFn: () => appleApi.connection().then(r => r.data), enabled: nativePlatform === 'ios' && available === true, retry: false })
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  if (!available || !data) return null
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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-bold leading-snug text-gray-900">Apple 계정</h2>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${data.connected ? 'bg-secondary-50 text-secondary-800' : 'bg-gray-100 text-gray-600'}`}>
        {data.connected && <CheckCircle2 size={16} aria-hidden="true" className="shrink-0" />}
        {data.connected ? '연결됨' : '연결 안 됨'}
      </span>
    </div>
    {data.connected ? <p role="status" className="mt-3 text-sm leading-relaxed text-gray-600">기존 기록으로 Apple 로그인을 이용할 수 있어요.</p>
      : !passwordLoginEnabled ? <p className="mt-3 text-sm leading-relaxed text-gray-600">Apple로 가입한 계정입니다. 다시 로그인할 때 같은 Apple 계정으로 인증해 주세요.</p> : <>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">현재 계정에 Apple 로그인을 추가할 수 있어요.</p>
      <label htmlFor="apple-link-password" className="mt-5 block text-sm font-semibold text-gray-700">본인 확인 · 현재 비밀번호</label>
      <input id="apple-link-password" type="password" autoComplete="current-password" value={password} maxLength={200} onChange={e => setPassword(e.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-primary-300" />
      {error && <p role="alert" className="mt-3 text-sm leading-relaxed text-red-700">{error}</p>}
      <AppleButton className="mt-4" onClick={connect} loading={loading} disabled={!password} />
    </>}
  </Card>
}
