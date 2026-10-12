import { useRef } from 'react'
import { Search, X } from 'lucide-react'

export default function SearchField({ label = '검색', value, onChange, placeholder = '검색어를 입력하세요' }) {
  const input = useRef(null)
  return (
    <div className="ui-search">
      <Search size={19} aria-hidden="true" className="shrink-0 text-gray-400" />
      <input ref={input} type="search" aria-label={label} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="min-w-0 flex-1 bg-transparent py-3 text-base text-gray-900 outline-none placeholder:text-gray-400" />
      {value && <button type="button" aria-label={`${label} 지우기`} className="icon-button shrink-0 -mr-2"
        onClick={() => { onChange(''); input.current?.focus() }}><X size={18} /></button>}
    </div>
  )
}
