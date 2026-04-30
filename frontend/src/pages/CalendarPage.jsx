import { useState, useEffect, useMemo } from 'react'
import useSwipeMonth from '../hooks/useSwipeMonth'
import { useQuery } from '@tanstack/react-query'
import { 
  Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, MoreHorizontal, PenLine, Trash2, X, Palette
} from 'lucide-react'
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameMonth, isToday, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek, addDays, isWithinInterval, startOfDay
} from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import Button from '../components/common/Button'
import { motion, AnimatePresence } from 'framer-motion'
import useAuthStore from '../store/authStore'
import { toApiDate } from '../utils/date'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const COLORS = [
  { name: '기본', value: '', class: 'bg-primary-500' },
  { name: '파랑', value: 'blue', class: 'bg-blue-500' },
  { name: '빨강', value: 'red', class: 'bg-red-500' },
  { name: '초록', value: 'emerald', class: 'bg-emerald-500' },
  { name: '보라', value: 'violet', class: 'bg-violet-500' },
  { name: '주황', value: 'amber', class: 'bg-amber-400' },
  { name: '분홍', value: 'rose', class: 'bg-rose-500' },
]

const EVENT_TYPES = [
  { label: '정기 일정', value: 'REGULAR' },
  { label: '특별 행사', value: 'SPECIAL' },
  { label: '회의', value: 'MEETING' },
  { label: '전체 일정', value: 'CHURCH_WIDE' },
]

export default function CalendarPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PASTOR' || user?.role === 'EXECUTIVE'
  
  const [current, setCurrent]   = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const { swipeHandlers, direction } = useSwipeMonth(current, setCurrent)
  
  // Form State
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: toApiDate(new Date()),
    endDate: toApiDate(new Date()),
    startTime: '12:00',
    endTime: '13:00',
    color: '',
    eventType: 'REGULAR',
    attendanceRequired: false,
    attendanceDeadline: '',
    attendanceTarget: 'STUDENT_ONLY',
  })
  
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['events', format(current, 'yyyy-MM')],
    queryFn:  () => client.get('/events', {
      params: {
        from: format(startOfWeek(startOfMonth(current)), 'yyyy-MM-dd'),
        to:   format(endOfWeek(endOfMonth(current)),   'yyyy-MM-dd'),
      }
    }).then(r => r.data),
  })

  // Lane Allocation Logic
  const eventLanes = useMemo(() => {
    const lanes = {};
    const sorted = [...events].sort((a, b) => a.id - b.id);
    const occupied = {};

    sorted.forEach(ev => {
      let lane = 0;
      while (true) {
        let ok = true;
        const start = new Date(ev.eventDate);
        const end = ev.endDate ? new Date(ev.endDate) : start;
        const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) });

        for (const d of days) {
          const key = format(d, 'yyyy-MM-dd');
          if (occupied[key]?.[lane]) {
            ok = false;
            break;
          }
        }

        if (ok) {
          days.forEach(d => {
            const key = format(d, 'yyyy-MM-dd');
            if (!occupied[key]) occupied[key] = [];
            occupied[key][lane] = ev.id;
          });
          lanes[ev.id] = lane;
          break;
        }
        lane++;
      }
    });
    return lanes;
  }, [events]);

  const days = eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(current)), 
    end: endOfWeek(endOfMonth(current)) 
  })

  const eventsOnDay = (day) =>
    events.filter(e => {
      const start = new Date(e.eventDate);
      const end = e.endDate ? new Date(e.endDate) : start;
      return isWithinInterval(startOfDay(day), { 
        start: startOfDay(start), 
        end: startOfDay(end) 
      });
    }).sort((a, b) => a.id - b.id)

  const selectedEvents = eventsOnDay(selected)
    .sort((a, b) => {
      // 리스트는 시간순 정렬 (기존 요청 유지)
      const timeA = a.startTime || '23:59';
      const timeB = b.startTime || '23:59';
      return timeA.localeCompare(timeB);
    })

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData({
      title: '',
      description: '',
      eventDate: toApiDate(selected),
      endDate: toApiDate(selected),
      startTime: '12:00',
      endTime: '13:00',
      color: '',
      eventType: 'REGULAR',
      attendanceRequired: false,
      attendanceDeadline: '',
      attendanceTarget: 'STUDENT_ONLY',
    })
    setShowForm(true)
  }

  const handleEdit = (e) => {
    setEditingId(e.id)
    setFormData({
      title: e.title,
      description: e.description || '',
      eventDate: e.eventDate,
      endDate: e.endDate || e.eventDate,
      startTime: e.startTime || '',
      endTime: e.endTime || '',
      color: e.color || '',
      eventType: e.eventType,
      attendanceRequired: e.attendanceRequired ?? false,
      attendanceDeadline: e.attendanceDeadline || '',
      attendanceTarget: e.attendanceTarget || 'STUDENT_ONLY',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return
    try {
      await client.delete(`/events/${id}`)
      refetch()
    } catch (err) {
      console.error(err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const submitData = {
        ...formData,
        attendanceDeadline: formData.attendanceDeadline || null,
      }
      if (editingId) {
        await client.put(`/events/${editingId}`, submitData)
      } else {
        await client.post('/events', submitData)
      }
      setShowForm(false)
      refetch()
    } catch (err) {
      console.error(err)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const getEventBg = (color) => {
    const map = {
      blue: 'bg-blue-500 text-white border-blue-600',
      red: 'bg-red-500 text-white border-red-600',
      emerald: 'bg-emerald-500 text-white border-emerald-600',
      violet: 'bg-violet-500 text-white border-violet-600',
      amber: 'bg-amber-400 text-white border-amber-500',
      rose: 'bg-rose-500 text-white border-rose-600',
      indigo: 'bg-indigo-500 text-white border-indigo-600',
    }
    return map[color] || 'bg-primary-500 text-white border-primary-600'
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <Header title="캘린더" showBack />

      {/* Calendar Section */}
      <div className="bg-white px-2 pb-6 shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-2 py-4">
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-black text-gray-900">
              {format(current, 'yyyy년 M월', { locale: ko })}
            </h2>
            {isAdmin && (
              <button 
                onClick={handleOpenAdd}
                className="ml-2 w-7 h-7 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center hover:bg-primary-100 transition-colors"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button onClick={() => setCurrent(subMonths(current, 1))} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronLeft size={18} /></button>
            <button onClick={() => setCurrent(new Date())} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest hover:bg-white rounded-lg transition-all">Today</button>
            <button onClick={() => setCurrent(addMonths(current, 1))} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* 요일 */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-[10px] font-black py-1 uppercase tracking-widest
              ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 – 좌우 스와이프로 월 이동 + 슬라이드 애니메이션 */}
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={format(current, 'yyyy-MM')}
            custom={direction}
            variants={{
              enter: (dir) => ({ x: dir === 'left' ? '100%' : '-100%', opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit:  (dir) => ({ x: dir === 'left' ? '-100%' : '100%', opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
            {...swipeHandlers}
            className="grid grid-cols-7 gap-px bg-gray-50 border border-gray-50 rounded-2xl overflow-hidden shadow-inner select-none"
            style={{ touchAction: 'pan-y' }}
          >
          {days.map((day) => {
            const dayEvents = eventsOnDay(day)
            const isSelected = isSameDay(day, selected)
            const isCurrMonth = isSameMonth(day, current)
            const dayOfWeek = getDay(day)

            return (
              <div 
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                className={`min-h-[70px] bg-white p-1 flex flex-col gap-0.5 cursor-pointer relative transition-all
                  ${isSelected ? 'ring-2 ring-primary-500 ring-inset z-10' : ''}
                  ${!isCurrMonth ? 'bg-gray-50/50' : ''}`}
              >
                <div className="flex justify-between items-start mb-0.5">
                  <span className={`text-[11px] font-black w-5 h-5 flex items-center justify-center rounded-full
                    ${isToday(day) ? 'bg-primary-600 text-white shadow-md' : 
                      isSelected ? 'text-primary-600' :
                      !isCurrMonth ? 'text-gray-300' :
                      dayOfWeek === 0 ? 'text-red-400' : 
                      dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-900'}`}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="flex flex-col gap-0.5 mt-auto relative h-[50px] justify-end">
                  {[0, 1, 2].map(laneIndex => {
                    const e = dayEvents.find(ev => eventLanes[ev.id] === laneIndex);
                    if (!e) return <div key={`empty-${laneIndex}`} className="h-3.5" />; // Spacer

                    const isStartOfEvent = isSameDay(day, new Date(e.eventDate));
                    const isEndOfEvent = isSameDay(day, new Date(e.endDate));
                    const isStartOfWeek = getDay(day) === 0;
                    const isEndOfWeek = getDay(day) === 6;
                    const shouldShowTitle = isStartOfEvent || isStartOfWeek;

                    return (
                      <div 
                        key={e.id} 
                        className={`h-3.5 px-1 text-[8px] font-black truncate transition-all flex items-center shrink-0
                          ${getEventBg(e.color)}
                          ${(isStartOfEvent || isStartOfWeek) ? 'rounded-l-sm border-l-2' : 'rounded-l-none border-l-0'}
                          ${(isEndOfEvent || isEndOfWeek) ? 'rounded-r-sm' : 'rounded-r-none'}
                          ${!isStartOfEvent && !isStartOfWeek ? '-ml-1.5' : ''}
                          ${!isEndOfEvent && !isEndOfWeek ? '-mr-1.5' : ''}
                        `}
                      >
                        {shouldShowTitle && e.title}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="absolute -top-4 right-0 text-[7px] font-black text-gray-400 bg-white/80 px-1 rounded-full">
                      +{dayEvents.filter(ev => eventLanes[ev.id] >= 3).length}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Selected Day Details */}
      <div className="px-4 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <p className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] mb-0.5">Selected Day</p>
            <h3 className="text-lg font-black text-gray-900">{format(selected, 'M월 d일 (EEEE)', { locale: ko })}</h3>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus size={16} /> 일정 추가
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {selectedEvents.length === 0 ? (
            <Card className="py-12 flex flex-col items-center justify-center text-gray-400">
              <Clock size={32} strokeWidth={1} className="mb-2 opacity-20" />
              <p className="text-sm font-bold">등록된 일정이 없습니다</p>
            </Card>
          ) : (
            selectedEvents.map((e, idx) => (
              <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card className="p-4 border-l-4 overflow-hidden relative" style={{ borderLeftColor: e.color || '#6366f1' }}>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={e.eventType === 'SPECIAL' ? 'info' : e.eventType === 'CHURCH_WIDE' ? 'danger' : 'gray'}>
                      {EVENT_TYPES.find(t => t.value === e.eventType)?.label || '정기'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {(e.startTime || e.endTime || (e.endDate && e.endDate !== e.eventDate)) && (
                        <div className="flex flex-col items-end gap-0.5 mr-2">
                          <div className="flex items-center gap-1 text-[9px] font-black text-primary-500">
                            {format(new Date(e.eventDate), 'M/d')} 
                            {e.endDate && e.endDate !== e.eventDate && ` ~ ${format(new Date(e.endDate), 'M/d')}`}
                          </div>
                          {(e.startTime || e.endTime) && (
                            <div className="flex items-center gap-1 text-[10px] font-black text-gray-400">
                              <Clock size={12} /> {e.startTime} {e.endTime && `~ ${e.endTime}`}
                            </div>
                          )}
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(e)} className="p-1 text-gray-300 hover:text-primary-500 transition-colors"><PenLine size={14} /></button>
                          <button onClick={() => handleDelete(e.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h4 className="font-black text-gray-900 text-base mb-1">{e.title}</h4>
                  {e.description && <p className="text-xs text-gray-500 font-medium leading-relaxed mb-2">{e.description}</p>}
                  {e.attendanceRequired && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        ✓ 출석체크 활성
                      </span>
                      {e.attendanceDeadline && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                          마감 {format(new Date(e.attendanceDeadline), 'M월 d일', { locale: ko })}
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Admin Modal Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-900">{editingId ? '일정 수정' : '새 일정 등록'}</h3>
                <button onClick={() => setShowForm(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">제목</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">시작일</label>
                    <input 
                      type="date" 
                      value={formData.eventDate} 
                      onChange={e => {
                        const newDate = e.target.value;
                        setFormData({
                          ...formData, 
                          eventDate: newDate,
                          endDate: formData.endDate < newDate ? newDate : formData.endDate
                        });
                      }} 
                      required 
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">종료일</label>
                    <input 
                      type="date" 
                      value={formData.endDate} 
                      onChange={e => setFormData({...formData, endDate: e.target.value})} 
                      min={formData.eventDate}
                      required 
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">구분</label>
                  <select value={formData.eventType} onChange={e => setFormData({...formData, eventType: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none appearance-none">
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">시작 시간</label>
                    <input 
                      type="time" 
                      value={formData.startTime} 
                      onChange={e => {
                        const newStartTime = e.target.value
                        let newEndTime = formData.endTime
                        
                        if (newStartTime) {
                          const [h, m] = newStartTime.split(':').map(Number)
                          const date = new Date()
                          date.setHours(h + 1)
                          date.setMinutes(m)
                          newEndTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                        }
                        
                        setFormData({...formData, startTime: newStartTime, endTime: newEndTime})
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">종료 시간</label>
                    <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">색상</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button key={c.value} type="button" onClick={() => setFormData({...formData, color: c.value})} className={`w-7 h-7 rounded-full ${c.class} ${formData.color === c.value ? 'ring-2 ring-offset-2 ring-gray-900' : 'opacity-40'}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">설명</label>
                  <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none outline-none" />
                </div>
                {/* 출석 체크 활성화 토글 */}
                <div
                  onClick={() => setFormData(d => ({ ...d, attendanceRequired: !d.attendanceRequired }))}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.attendanceRequired
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-black ${formData.attendanceRequired ? 'text-emerald-700' : 'text-gray-500'}`}>
                      출석 체크 활성화
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">출석 체크가 필요한 행사에 활성화하세요</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all flex-shrink-0 relative ${
                    formData.attendanceRequired ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                      formData.attendanceRequired ? 'left-5' : 'left-0.5'
                    }`} />
                  </div>
                </div>

                {/* 출석 대상 선택 + 마감일 (출석 체크 활성화 시에만 표시) */}
                {formData.attendanceRequired && (
                  <div className="flex flex-col gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                    <div>
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 block">출석 대상</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'STUDENT_ONLY', label: '학생만' },
                          { value: 'TEACHER_ONLY', label: '교사만' },
                          { value: 'BOTH',         label: '학생 + 교사' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormData(d => ({ ...d, attendanceTarget: opt.value }))}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black border-2 transition-all ${
                              formData.attendanceTarget === opt.value
                                ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                                : 'border-gray-100 bg-white text-gray-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 block">
                        출석 제출 마감일 <span className="text-gray-400 font-medium normal-case">(선택)</span>
                      </label>
                      <input
                        type="date"
                        value={formData.attendanceDeadline}
                        onChange={e => setFormData(d => ({ ...d, attendanceDeadline: e.target.value }))}
                        min={toApiDate(new Date())}
                        className="w-full px-4 py-3 rounded-xl border border-emerald-100 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                      {formData.attendanceDeadline ? (
                        <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">
                          ✓ {format(new Date(formData.attendanceDeadline), 'M월 d일', { locale: ko })} 까지 출석 제출 가능합니다
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-1.5">
                          미설정 시 마감 제한 없이 제출 가능합니다
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <Button type="submit" loading={submitting} className="flex-1">저장하기</Button>
                  <Button variant="ghost" onClick={() => setShowForm(false)}>취소</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}