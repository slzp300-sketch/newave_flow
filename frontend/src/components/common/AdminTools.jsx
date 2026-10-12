import { RotateCcw, SearchX } from 'lucide-react'

export function AdminIntro({ title, description, action }) {
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="ui-admin-intro min-w-0 flex-1 basis-44">
      <h2 className="text-xl font-bold tracking-tight text-gray-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{description}</p>
    </div>
    {action}
  </div>
}

export function FilterResults({ count, total, unit = '명', filtered, onReset }) {
  return <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
    <p role="status" className="text-gray-500">{filtered ? '검색 결과' : '전체'} <strong className="text-gray-900">{count}{unit}</strong>
      {filtered && total != null && <span> / 전체 {total}{unit}</span>}
    </p>
    {filtered && onReset && <button type="button" onClick={onReset}
      className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-gray-500 hover:bg-gray-100">
      <RotateCcw size={13} aria-hidden="true" /> 필터 초기화
    </button>}
  </div>
}

export function AdminEmpty({ title = '조건에 맞는 결과가 없습니다', description = '검색어나 필터를 바꿔 다시 확인해 주세요.' }) {
  return <div className="brand-card rounded-2xl border border-gray-100 bg-white px-5 py-10 text-center">
    <SearchX size={28} className="mx-auto mb-3 text-gray-300" aria-hidden="true" />
    <p className="text-sm font-semibold text-gray-700">{title}</p>
    <p className="mt-2 text-xs leading-relaxed text-gray-500">{description}</p>
  </div>
}
