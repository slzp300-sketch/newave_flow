import { useState } from 'react'
import client from '../api/client'

export default function AdminPasswordReset({ user }) {
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState(null)
  const [error, setError] = useState('')
  const reset = async () => {
    if (!window.confirm(`${user.name} 선생님 본인에게 재설정 요청을 확인하셨나요? 기존 로그인은 모두 종료됩니다.`)) return
    setBusy(true); setError(''); setPassword(null)
    try {
      const { data } = await client.post(`/admin/users/${user.id}/reset-password`, { identityVerified: true })
      setPassword(data.tempPassword)
    } catch (err) {
      setError(err.response?.data?.message || '발급 결과를 확인하지 못했습니다. 다시 발급하기 전에 계정 상태를 확인해주세요.')
    } finally { setBusy(false) }
  }
  return <div className="border-t pt-4 space-y-2 text-sm">
    <button type="button" disabled={busy} onClick={reset} className="text-primary-700 font-bold disabled:opacity-50">
      {busy ? '발급 중…' : '본인 확인 후 임시 비밀번호 발급'}
    </button>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {password && <div className="rounded-xl bg-gray-50 p-3 space-y-2">
      <p>본인에게 직접 전달해주세요. 창을 닫으면 다시 표시되지 않습니다.</p>
      <p className="font-mono break-all select-all">{password}</p>
      <button type="button" onClick={() => setPassword(null)} className="underline">전달 완료 · 숨기기</button>
    </div>}
  </div>
}
