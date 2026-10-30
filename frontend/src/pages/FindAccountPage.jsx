import './SupportingReadability.css'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, User, Lock, CheckCircle, Copy } from 'lucide-react'
import { authApi } from '../api/auth'
import Brand from '../components/common/Brand'
import Button from '../components/common/Button'

const TAB_ID = 'id'
const TAB_PW = 'pw'

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export default function FindAccountPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') === 'pw' ? TAB_PW : TAB_ID)

  return (
    <div className="supporting-readable readable-content safe-page-top min-h-screen bg-primary-900 flex flex-col items-center justify-center px-5 pb-8 max-w-mobile mx-auto" style={{ '--safe-page-space': '2rem' }}>
      <div className="mb-8 text-center animate-[fadeIn_0.5s_ease]">
        <h1><Brand emblem light /></h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl border border-gray-200 overflow-hidden animate-[slideUp_0.4s_ease]">
        {/* 탭 */}
        <div className="account-tabs flex">
          <button aria-pressed={tab === TAB_ID}
            type="button"
            onClick={() => setTab(TAB_ID)}
            className={`flex-1 py-4 text-sm font-bold transition-colors flex items-center justify-center gap-1.5
              ${tab === TAB_ID
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-400 border-b border-gray-100 hover:text-gray-600'
              }`}
          >
            <User size={15} />
            아이디 찾기
          </button>
          <button aria-pressed={tab === TAB_PW}
            type="button"
            onClick={() => setTab(TAB_PW)}
            className={`flex-1 py-4 text-sm font-bold transition-colors flex items-center justify-center gap-1.5
              ${tab === TAB_PW
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-400 border-b border-gray-100 hover:text-gray-600'
              }`}
          >
            <Lock size={15} />
            비밀번호 찾기
          </button>
        </div>

        <div className="account-form p-7">
          {tab === TAB_ID ? <FindIdTab /> : <FindPasswordTab />}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/login')}
        className="mt-6 text-primary-200 text-sm flex items-center gap-1 hover:text-white transition-colors"
      >
        <ChevronLeft size={16} />
        로그인으로 돌아가기
      </button>
    </div>
  )
}

function FindIdTab() {
  const [form, setForm] = useState({ name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const { data } = await authApi.findEmail(form.name, form.phone)
      setResult(data.maskedEmail)
    } catch (err) {
      setError(err.response?.data?.message ?? '아이디 찾기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <CheckCircle className="text-secondary-700" size={44} />
        <div>
          <p className="text-gray-500 text-sm mb-1">가입된 아이디(이메일)</p>
          <p className="text-lg font-bold text-gray-900 tracking-wide">{result}</p>
        </div>
        <p className="text-xs text-gray-400">보안상 일부 문자가 가려져 표시됩니다.</p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="text-primary-600 text-sm underline underline-offset-4 font-medium"
        >
          다시 찾기
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="가입 시 입력한 이름"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base transition"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">전화번호</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
          placeholder="010-0000-0000"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base transition"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      <Button type="submit" size="lg" loading={loading} className="mt-1">
        아이디 찾기
      </Button>
    </form>
  )
}

function FindPasswordTab() {
  return <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
    <p className="font-bold text-gray-900">관리자에게 비밀번호 재설정을 요청해주세요.</p>
    <p>관리자 본인 확인 후 임시 비밀번호 발급</p>
    <p>로그인 후 내 정보에서 비밀번호를 변경하세요.</p>
  </div>
}
