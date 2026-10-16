import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from './Button'
import { signupEligibilityMessage } from '../../auth/signupEligibility'

export default function SignupEligibility({ onConfirm, error, disabled = false }) {
  const [checked, setChecked] = useState(false)
  return <main className="px-6 py-8">
    <h2 className="text-2xl font-bold text-gray-900">가입 대상을 확인해 주세요</h2>
    <p className="mt-4 text-sm leading-6 text-gray-600">{signupEligibilityMessage}</p>
    <p className="mt-3 text-sm leading-6 text-gray-600">가입 신청 후 관리자가 교사·사역 담당자 여부를 확인하고 승인한 계정만 이용할 수 있습니다.</p>
    <form className="mt-6 space-y-5" onSubmit={event => { event.preventDefault(); if (checked && !disabled) onConfirm() }}>
      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6">
        <input type="checkbox" className="mt-1 size-5 shrink-0" checked={checked} onChange={event => setChecked(event.target.checked)} />
        <span>만 14세 이상이며, 교사·사역 담당자로 가입합니다. 학생·보호자 계정이 아님을 확인합니다.</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
      <Button type="submit" className="w-full" disabled={!checked || disabled}>확인하고 가입 정보 입력하기</Button>
    </form>
    <div className="mt-4 flex flex-col items-center text-sm">
      <Link to="/login" className="flex min-h-11 items-center text-primary-700 underline">로그인 화면으로</Link>
      <Link to="/account-deletion" className="flex min-h-11 items-center text-gray-600 underline">가입 신청 취소·계정 삭제</Link>
      <Link to="/privacy" className="flex min-h-11 items-center text-xs text-gray-500 underline">개인정보처리방침 보기</Link>
    </div>
  </main>
}
