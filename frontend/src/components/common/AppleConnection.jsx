import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appleApi } from '../../api/apple'
import { appleAvailability, beginApple, isAppleCancellation } from '../../auth/apple'
import { nativePlatform } from '../../native/platform'
import AppleButton from './AppleButton'
import Card from './Card'

export default function AppleConnection() {
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
    <h2 className="brand-section-title text-sm font-semibold">Apple 계정 연결</h2>
    {data.connected ? <p role="status" className="mt-3 text-sm text-secondary-800">Apple 계정이 연결되어 있어요. 기존 기록으로 Apple 로그인을 이용할 수 있어요.</p> : <>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">현재 계정에 Apple 로그인을 추가해요. 반 배정과 출석·TTS 기록이 그대로 유지됩니다.</p>
      <label htmlFor="apple-link-password" className="mt-4 block text-xs font-semibold">본인 확인 · 현재 비밀번호</label>
      <input id="apple-link-password" type="password" autoComplete="current-password" value={password} maxLength={200} onChange={e => setPassword(e.target.value)} className="input-field mt-2" />
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <AppleButton className="mt-3" onClick={connect} loading={loading} disabled={!password} />
    </>}
  </Card>
}
