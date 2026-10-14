import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { safetyApi } from '../api/safety'
import useAuthStore from '../store/authStore'
import { authApi } from '../api/auth'

export function agreementKey(user, environment) { return ['community-agreement', environment, user?.id] }

export default function CommunityPolicyPage({ required = false }) {
  const { user, apiEnvironment, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const policy = useQuery({ queryKey: ['community-policy', apiEnvironment], queryFn: safetyApi.policy })
  const agreement = useQuery({ queryKey: agreementKey(user, apiEnvironment), queryFn: safetyApi.agreement, enabled: !!user })
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const accept = async () => {
    if (!checked || !policy.data) return
    setBusy(true); setError('')
    try {
      const saved = await safetyApi.accept(policy.data.version)
      qc.setQueryData(agreementKey(user, apiEnvironment), saved)
      if (!required) navigate('/', { replace: true })
    } catch (e) { setError(e.response?.data?.message || '동의를 저장하지 못했습니다. 연결을 확인하고 다시 시도해주세요.') }
    finally { setBusy(false) }
  }
  const logout = async () => {
    setBusy(true)
    try { await authApi.logout() }
    catch { setError('서버 로그아웃에 실패했습니다. 연결을 확인해주세요.'); setBusy(false); return }
    qc.clear(); clearAuth(); navigate('/login', { replace: true })
  }
  return <div className="mx-auto min-h-screen w-full max-w-mobile bg-white px-5 py-7 pb-24">
    <ShieldCheck className="mb-4 text-primary-600" size={32} aria-hidden="true" />
    <h1 className="text-2xl font-bold text-gray-900">함께 지키는 이용수칙</h1>
    <p className="mt-3 text-sm leading-relaxed text-gray-600">학생과 교사의 기록을 안전하게 나누기 위한 약속입니다.{required && ' 콘텐츠를 작성하기 전에 한 번 확인하고 동의해주세요.'}</p>
    {policy.isPending && <p role="status" className="py-8 text-gray-500">이용수칙을 불러오는 중입니다.</p>}
    {policy.isError && <div role="alert" className="my-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800">이용수칙을 불러오지 못했습니다.
      <button onClick={() => policy.refetch()} className="ml-3 min-h-11 underline">다시 시도</button></div>}
    {policy.data && <>
      <p className="mt-3 text-xs text-gray-500">시행일 2026년 10월 14일 · 버전 {policy.data.version}</p>
      <div className="mt-6 space-y-6">{policy.data.sections.map(section => <section key={section.title}>
        <h2 className="text-base font-semibold text-gray-900">{section.title}</h2>
        <p className="mt-2 text-sm leading-7 text-gray-600">{section.text}</p>
      </section>)}</div>
      {user && !agreement.data?.accepted && <div className="mt-7 rounded-2xl border border-gray-200 p-4">
        <label className="flex min-h-11 items-start gap-3 text-sm font-medium leading-6">
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
          <span>이용수칙을 읽었으며 콘텐츠 작성과 사진 등록 시 이 수칙을 지키겠습니다.</span>
        </label>
        <button onClick={accept} disabled={!checked || busy || agreement.isPending || agreement.isError}
          className="mt-4 min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-40">{busy ? '저장 중…' : '동의하고 계속하기'}</button>
      </div>}
      {agreement.data?.accepted && <p role="status" className="mt-6 rounded-2xl bg-green-50 p-4 text-sm text-green-800">현재 이용수칙에 동의했습니다.</p>}
    </>}
    {agreement.isError && <p role="alert" className="mt-4 text-sm text-red-700">동의 상태를 확인하지 못했습니다. <button className="min-h-11 underline" onClick={() => agreement.refetch()}>다시 시도</button></p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-primary-700">
      <Link className="inline-flex min-h-11 items-center" to="/safety/report">콘텐츠·사용자 신고</Link>
      <Link className="inline-flex min-h-11 items-center" to="/privacy">개인정보처리방침</Link>
      <Link className="inline-flex min-h-11 items-center" to="/support">지원 문의</Link>
      {user && required && <button disabled={busy} onClick={logout} className="min-h-11 text-gray-600">로그아웃</button>}
      {!required && <Link className="inline-flex min-h-11 items-center" to={user ? '/menu' : '/login'}>돌아가기</Link>}
    </div>
  </div>
}
