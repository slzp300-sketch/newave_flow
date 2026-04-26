import { useState } from 'react'

const DOMAINS = ['naver.com', 'gmail.com', 'kakao.com', 'hanmail.net', 'daum.net', 'nate.com']

const statusBorder = {
  available: 'border-emerald-300 focus:ring-emerald-500',
  duplicate: 'border-red-300 focus:ring-red-500',
}

export default function EmailInput({ onChange, status = 'idle' }) {
  const [local, setLocal]       = useState('')
  const [domain, setDomain]     = useState('naver.com')
  const [custom, setCustom]     = useState('')
  const [isCustom, setIsCustom] = useState(false)

  const colorCls = statusBorder[status] ?? 'border-gray-200 focus:ring-primary-500'
  const base = `px-4 py-3 rounded-xl bg-white border focus:outline-none focus:ring-2 focus:border-transparent text-sm font-medium transition ${colorCls}`

  const emit = (l, d, c, ic) => {
    if (!l) { onChange(''); return }
    const domainPart = ic ? c : d
    onChange(domainPart ? `${l}@${domainPart}` : l)
  }

  const handleLocal = e => {
    const v = e.target.value
    setLocal(v)
    emit(v, domain, custom, isCustom)
  }

  const handleDomain = e => {
    const v = e.target.value
    const ic = v === 'custom'
    setIsCustom(ic)
    if (!ic) {
      setDomain(v)
      emit(local, v, custom, false)
    } else {
      emit(local, domain, custom, true)
    }
  }

  const handleCustom = e => {
    const v = e.target.value
    setCustom(v)
    emit(local, domain, v, true)
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={local}
          onChange={handleLocal}
          placeholder="아이디"
          required
          className={`flex-1 min-w-0 ${base}`}
        />
        <span className="text-gray-400 font-medium shrink-0 select-none">@</span>
        <select
          value={isCustom ? 'custom' : domain}
          onChange={handleDomain}
          className={`flex-1 min-w-0 cursor-pointer ${base}`}
        >
          {DOMAINS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
          <option value="custom">직접입력</option>
        </select>
      </div>
      {isCustom && (
        <input
          type="text"
          value={custom}
          onChange={handleCustom}
          placeholder="도메인 주소 입력 (예: company.com)"
          required
          className={`mt-2 w-full ${base}`}
        />
      )}
    </div>
  )
}
