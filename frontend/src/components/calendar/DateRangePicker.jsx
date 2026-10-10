import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth, differenceInCalendarDays
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { toApiDate } from '../../utils/date'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 'yyyy-MM-dd' 두 개 → "10/17 (금) ~ 10/19 (일)" */
export function formatRange(start, end) {
  const s = format(parseISO(start), 'M/d (EEE)', { locale: ko })
  if (!end || end === start) return s
  return `${s} ~ ${format(parseISO(end), 'M/d (EEE)', { locale: ko })}`
}

/**
 * 달력에서 날짜(기간)를 고르는 팝업.
 * 하루를 한 번 누르면 하루 일정, 두 날짜를 차례로 누르면 기간 일정.
 */
export default function DateRangePicker({ open, start, end, onConfirm, onClose }) {
  const [s, setS] = useState(start)
  const [e, setE] = useState(end || start)
  const [pickingEnd, setPickingEnd] = useState(false)
  const [month, setMonth] = useState(() => parseISO(start))

  useEffect(() => {
    if (!open) return
    setS(start)
    setE(end || start)
    setPickingEnd(false)
    setMonth(parseISO(start))
  }, [open, start, end])

  if (!open) return null

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })

  const handlePick = (day) => {
    const d = toApiDate(day)
    if (!pickingEnd || d < s) {
      // 시작일 선택 (또는 시작일보다 앞을 누르면 시작일을 다시 잡음)
      setS(d); setE(d); setPickingEnd(true)
    } else {
      setE(d); setPickingEnd(false)
    }
  }

  const dayCount = differenceInCalendarDays(parseISO(e), parseISO(s)) + 1

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setMonth(m => subMonths(m, 1))} className="p-2 rounded-lg active:bg-gray-100" aria-label="이전 달">
              <ChevronLeft size={18} />
            </button>
            <p className="text-base font-black text-gray-900">{format(month, 'yyyy년 M월', { locale: ko })}</p>
            <button type="button" onClick={() => setMonth(m => addMonths(m, 1))} className="p-2 rounded-lg active:bg-gray-100" aria-label="다음 달">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-[11px] font-black py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {days.map(day => {
              const d = toApiDate(day)
              const isStart = d === s
              const isEnd = d === e
              const inRange = d > s && d < e
              const isEdge = isStart || isEnd
              const dow = day.getDay()
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => handlePick(day)}
                  className={`relative h-10 text-sm font-bold ${inRange ? 'bg-primary-50' : ''}`}
                >
                  {isStart && e > s && <span className="absolute inset-y-0 right-0 w-1/2 bg-primary-50" />}
                  {isEnd && e > s && <span className="absolute inset-y-0 left-0 w-1/2 bg-primary-50" />}
                  <span className={`relative mx-auto w-9 h-9 rounded-full flex items-center justify-center
                    ${isEdge ? 'bg-primary-600 text-white' :
                      !isSameMonth(day, month) ? 'text-gray-300' :
                      dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-800'}`}>
                    {format(day, 'd')}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 px-3 py-2.5 rounded-xl bg-gray-50 text-center">
            <p className="text-sm font-black text-gray-900">
              {formatRange(s, e)}{dayCount > 1 && <span className="text-primary-600"> · {dayCount}일</span>}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {pickingEnd ? '끝나는 날을 누르세요 (하루 일정이면 바로 확인)' : '시작하는 날을 누르세요'}
            </p>
          </div>

          <div className="flex gap-2 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 active:bg-gray-200">취소</button>
            <button type="button" onClick={() => onConfirm(s, e)} className="flex-[2] py-3 rounded-xl text-sm font-black text-white bg-primary-600 active:bg-primary-700">확인</button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

/** 누르면 달력 팝업이 뜨는 날짜 칸 */
export function DateRangeField({ start, end, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 text-left ${className}`}
      >
        <CalendarDays size={16} className="text-primary-500 flex-shrink-0" />
        <span className="truncate">{formatRange(start, end)}</span>
      </button>
      <DateRangePicker
        open={open}
        start={start}
        end={end}
        onClose={() => setOpen(false)}
        onConfirm={(s, e) => { onChange(s, e); setOpen(false) }}
      />
    </>
  )
}
