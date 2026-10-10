import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, CalendarPlus, CalendarRange } from 'lucide-react'
import { addDays, parseISO, differenceInCalendarDays } from 'date-fns'
import { eventApi } from '../../api/event'
import { toApiDate } from '../../utils/date'
import { DateRangeField, formatRange } from './DateRangePicker'

const MAX_ROWS = 30

const COLORS = [
  { value: '', class: 'bg-primary-500' },
  { value: 'blue', class: 'bg-blue-500' },
  { value: 'red', class: 'bg-red-500' },
  { value: 'emerald', class: 'bg-emerald-500' },
  { value: 'violet', class: 'bg-violet-500' },
  { value: 'amber', class: 'bg-amber-400' },
  { value: 'rose', class: 'bg-rose-500' },
]

const EVENT_TYPES = [
  { label: '정기', value: 'REGULAR' },
  { label: '특별', value: 'SPECIAL' },
  { label: '회의', value: 'MEETING' },
  { label: '전체', value: 'CHURCH_WIDE' },
]

const TARGETS = [
  { value: 'STUDENT_ONLY', label: '학생만' },
  { value: 'TEACHER_ONLY', label: '교사만' },
  { value: 'BOTH',         label: '학생 + 교사' },
]

function Switch({ on, color = 'bg-primary-500' }) {
  return (
    <div className={`w-10 h-[22px] rounded-full relative flex-shrink-0 transition-all ${on ? color : 'bg-gray-200'}`}>
      <div className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
    </div>
  )
}

/** + 버튼을 누르면 뜨는 선택창: 하나 추가 / 여러 개 한번에 추가 */
export function AddEventChoice({ open, onClose, onSingle, onBulk }) {
  if (!open) return null
  const item = 'w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-gray-50 active:bg-gray-100 text-left'
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white w-full max-w-sm rounded-3xl p-4 shadow-2xl flex flex-col gap-2">
          <p className="text-sm font-black text-gray-900 px-1 pb-1">일정 추가</p>
          <button type="button" className={item} onClick={() => { onClose(); onSingle() }}>
            <CalendarPlus size={20} className="text-primary-500" />
            <div>
              <p className="text-sm font-black text-gray-900">하나 추가</p>
              <p className="text-[11px] text-gray-400">시간·설명까지 자세히 입력</p>
            </div>
          </button>
          <button type="button" className={item} onClick={() => { onClose(); onBulk() }}>
            <CalendarRange size={20} className="text-primary-500" />
            <div>
              <p className="text-sm font-black text-gray-900">여러 개 한번에 추가</p>
              <p className="text-[11px] text-gray-400">날짜와 제목만 빠르게 여러 줄</p>
            </div>
          </button>
          <button type="button" onClick={onClose} className="py-3 text-sm font-bold text-gray-400">취소</button>
        </div>
      </div>
    </>,
    document.body
  )
}

let rowSeq = 0
const newRow = (eventDate, endDate = eventDate) => ({
  key: ++rowSeq,
  eventDate,
  endDate,
  title: '',
  attendanceRequired: false,
  attendanceTarget: 'STUDENT_ONLY',
})

/** 여러 일정 한번에 등록 */
export default function BulkEventForm({ open, onClose, defaultDate }) {
  const qc = useQueryClient()
  const [common, setCommon] = useState({ eventType: 'REGULAR', allDay: true, startTime: '12:00', endTime: '13:00', color: '' })
  const [rows, setRows] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const listEndRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const d = toApiDate(defaultDate || new Date())
    setCommon({ eventType: 'REGULAR', allDay: true, startTime: '12:00', endTime: '13:00', color: '' })
    setRows([newRow(d), newRow(toApiDate(addDays(parseISO(d), 7)))])
  }, [open])

  if (!open) return null

  const updateRow = (key, patch) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r))
  const removeRow = (key) => setRows(rs => rs.filter(r => r.key !== key))

  // 마지막 줄의 다음 주 같은 요일 (기간 일정이면 같은 길이로)
  const addRow = () => {
    setRows(rs => {
      if (rs.length >= MAX_ROWS) return rs
      const last = rs[rs.length - 1]
      if (!last) return [newRow(toApiDate(defaultDate || new Date()))]
      const len = differenceInCalendarDays(parseISO(last.endDate), parseISO(last.eventDate))
      const s = addDays(parseISO(last.eventDate), 7)
      return [...rs, newRow(toApiDate(s), toApiDate(addDays(s, len)))]
    })
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  const filled = rows.filter(r => r.title.trim())

  const handleSubmit = async () => {
    if (filled.length === 0) return
    try {
      setSubmitting(true)
      await eventApi.createEvents(filled.map(r => ({
        title: r.title.trim(),
        description: '',
        eventDate: r.eventDate,
        endDate: r.endDate,
        startTime: common.allDay ? null : common.startTime || null,
        endTime: common.allDay ? null : common.endTime || null,
        color: common.color,
        eventType: common.eventType,
        attendanceRequired: r.attendanceRequired,
        attendanceDeadline: r.attendanceRequired ? r.endDate : null, // 마감 = 일정 마지막 날
        attendanceTarget: r.attendanceTarget,
      })))
      qc.invalidateQueries({ queryKey: ['events-all'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['attendance-required-events'] })
      alert(`일정 ${filled.length}개가 등록되었습니다.`)
      onClose()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.message || '저장 중 오류가 발생했습니다. 아무 일정도 등록되지 않았습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const label = 'text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block'

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center px-5 pt-5 pb-3">
            <h3 className="text-lg font-black text-gray-900">여러 일정 한번에 추가</h3>
            <button type="button" onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400" aria-label="닫기"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-4">
            {/* 공통 설정 */}
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-gray-50">
              <p className="text-xs font-black text-gray-500">공통 설정 <span className="font-medium text-gray-400">· 모든 줄에 적용</span></p>
              <div>
                <span className={label}>구분</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {EVENT_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setCommon(c => ({ ...c, eventType: t.value }))}
                      className={`py-2 rounded-xl text-xs font-black border-2 transition-all ${common.eventType === t.value ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-transparent bg-white text-gray-400'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setCommon(c => ({ ...c, allDay: !c.allDay }))} className="flex items-center justify-between">
                <span className="text-sm font-black text-gray-600">하루종일</span>
                <Switch on={common.allDay} />
              </button>
              <AnimatePresence initial={false}>
                {!common.allDay && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="time" value={common.startTime} onChange={e => setCommon(c => ({ ...c, startTime: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-bold outline-none" aria-label="시작 시간" />
                      <input type="time" value={common.endTime} onChange={e => setCommon(c => ({ ...c, endTime: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-bold outline-none" aria-label="종료 시간" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-gray-600">색상</span>
                <div className="flex gap-1.5">
                  {COLORS.map(c => (
                    <button key={c.value} type="button" onClick={() => setCommon(cm => ({ ...cm, color: c.value }))}
                      className={`w-6 h-6 rounded-full ${c.class} ${common.color === c.value ? 'ring-2 ring-offset-2 ring-gray-900' : 'opacity-40'}`} />
                  ))}
                </div>
              </div>
            </div>

            {/* 일정 줄 */}
            <div className="flex flex-col gap-2">
              {rows.map(r => (
                <div key={r.key} className={`rounded-2xl border p-3 flex flex-col gap-2 ${r.title.trim() ? 'border-gray-200' : 'border-dashed border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <DateRangeField
                      start={r.eventDate}
                      end={r.endDate}
                      onChange={(s, e) => updateRow(r.key, { eventDate: s, endDate: e })}
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-gray-50 text-[13px] font-bold text-gray-800"
                    />
                    <button type="button" onClick={() => removeRow(r.key)} className="p-2 text-gray-300 active:text-red-500" aria-label="줄 삭제">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={r.title}
                    onChange={e => updateRow(r.key, { title: e.target.value })}
                    placeholder="일정 제목 (비우면 건너뜀)"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  <button type="button" onClick={() => updateRow(r.key, { attendanceRequired: !r.attendanceRequired })} className="flex items-center justify-between px-1">
                    <span className={`text-xs font-black ${r.attendanceRequired ? 'text-emerald-600' : 'text-gray-400'}`}>출석 체크 받기</span>
                    <Switch on={r.attendanceRequired} color="bg-emerald-500" />
                  </button>
                  <AnimatePresence initial={false}>
                    {r.attendanceRequired && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="flex gap-1.5 pt-0.5">
                          {TARGETS.map(t => (
                            <button key={t.value} type="button" onClick={() => updateRow(r.key, { attendanceTarget: t.value })}
                              className={`flex-1 py-2 rounded-xl text-[11px] font-black border-2 transition-all ${r.attendanceTarget === t.value ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-100 bg-white text-gray-400'}`}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-400 px-1 pt-1.5">출석 마감: {formatRange(r.endDate)}까지</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              <div ref={listEndRef} />
              {rows.length < MAX_ROWS ? (
                <button type="button" onClick={addRow} className="flex items-center justify-center gap-1.5 py-3 rounded-2xl border-2 border-dashed border-primary-200 text-sm font-black text-primary-600 active:bg-primary-50">
                  <Plus size={16} /> 줄 추가 <span className="font-medium text-primary-400">(다음 주 같은 요일)</span>
                </button>
              ) : (
                <p className="text-center text-xs text-gray-400 py-2">한 번에 최대 {MAX_ROWS}개까지 등록할 수 있습니다</p>
              )}
            </div>
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={filled.length === 0 || submitting}
              className="w-full py-4 rounded-xl text-[15px] font-black text-white bg-primary-600 active:bg-primary-700 disabled:opacity-40"
            >
              {submitting ? '등록 중…' : filled.length === 0 ? '제목을 입력하세요' : `일정 ${filled.length}개 등록하기`}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
