import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, User, Lock, CheckCircle, Copy } from 'lucide-react'
import { authApi } from '../api/auth'
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
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 flex flex-col items-center justify-center px-6">
      <div className="mb-8 text-center animate-[fadeIn_0.5s_ease]">
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur">
          <span className="text-2xl">⛪</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Newave Flow</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-[slideUp_0.4s_ease]">
        {/* 탭 */}
        <div className="flex">
          <button
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
          <button
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

        <div className="p-7">
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
        <CheckCircle className="text-green-500" size={44} />
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
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tempPw, setTempPw] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setTempPw(null)
    setLoading(true)
    try {
      const { data } = await authApi.resetPassword(form.email, form.name, form.phone)
      setTempPw(data.tempPassword)
    } catch (err) {
      setError(err.response?.data?.message ?? '비밀번호 재설정에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPw)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API 미지원 환경 무시
    }
  }

  if (tempPw) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <CheckCircle className="text-green-500" size={44} />
        <div className="w-full">
          <p className="text-gray-500 text-sm mb-3">임시 비밀번호가 발급되었습니다</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-bold text-gray-900 tracking-widest">{tempPw}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-gray-400 hover:text-primary-600 transition-colors shrink-0"
              title="복사"
            >
              {copied ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          이 비밀번호로 로그인 후<br />반드시 비밀번호를 변경해주세요.
        </p>
        <Button size="lg" onClick={() => navigate('/login')} className="w-full mt-1">
          로그인 하러 가기
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">아이디 (이메일)</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="가입 시 입력한 이메일"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base transition"
        />
      </div>
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
        임시 비밀번호 발급
      </Button>
    </form>
  )
}
