import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * 주 이동 바: 이번 주(offset 0)와 지난 주들(offset < 0)만 선택 가능
 * title: "10월 1주차" 같은 큰 글씨, sub: "26년 41주차" 같은 작은 표시(선택), range: "10/4 ~ 10/10" 같은 작은 글씨
 */
export default function WeekNavigator({ offset, onChange, title, sub, range }) {
  const isCurrent = offset === 0
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(offset - 1)}
        className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:scale-95 transition-transform"
        aria-label="이전 주"
      >
        <ChevronLeft size={18} className="text-gray-600" />
      </button>

      <div className="flex-1 text-center min-w-0">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-sm font-black text-gray-900">{title}</span>
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isCurrent ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-500'}`}>
            {isCurrent ? '이번 주' : `${-offset}주 전`}
          </span>
        </div>
        {sub && <p className="text-[10px] font-bold text-gray-400 mt-0.5">{sub}</p>}
        <p className="text-[11px] font-bold text-gray-400 mt-0.5">{range}</p>
      </div>

      {isCurrent ? (
        <button
          disabled
          className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center opacity-40"
          aria-label="다음 주"
        >
          <ChevronRight size={18} className="text-gray-400" />
        </button>
      ) : (
        <button
          onClick={() => onChange(offset + 1)}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="다음 주"
        >
          <ChevronRight size={18} className="text-gray-600" />
        </button>
      )}
    </div>
  )
}
