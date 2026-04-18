import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, MoreHorizontal, PenLine, Trash2, X, Palette
} from 'lucide-react'
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameMonth, isToday, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek, addDays
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
  { name: '주황', value: 'amber', class: 'bg-amber-500' },
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
  const isAdmin = user?.role === 'PASTOR' || user?.role === 'EXECUTIVE'
  
  const [current, setCurrent]   = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  
  // Form State
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: toApiDate(new Date()),
    startTime: '',
    endTime: '',
    color: '',
    eventType: 'REGULAR'
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

  const days = eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(current)), 
    end: endOfWeek(endOfMonth(current)) 
  })

  const eventsOnDay = (day) =>
    events.filter(e => isSameDay(new Date(e.eventDate), day))

  const selectedEvents = eventsOnDay(selected)

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData({
      title: '',
      description: '',
      eventDate: toApiDate(selected),
      startTime: '',
      endTime: '',
      color: '',
      eventType: 'REGULAR'
    })
    setShowForm(true)
  }

  const handleEdit = (e) => {
    setEditingId(e.id)
    setFormData({
      title: e.title,
      description: e.description || '',
      eventDate: e.eventDate,
      startTime: e.startTime || '',
      endTime: e.endTime || '',
      color: e.color || '',
      eventType: e.eventType
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
      if (editingId) {
        await client.put(`/events/${editingId}`, formData)
      } else {
        await client.post('/events', formData)
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
      blue: 'bg-blue-50 text-blue-700 border-blue-100',
      red: 'bg-red-50 text-red-700 border-red-100',
      emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      violet: 'bg-violet-50 text-violet-700 border-violet-100',
      amber: 'bg-amber-50 text-amber-700 border-amber-100',
      rose: 'bg-rose-50 text-rose-700 border-rose-100',
      indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    }
    return map[color] || 'bg-primary-50 text-primary-700 border-primary-100'
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

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-px bg-gray-50 border border-gray-50 rounded-2xl overflow-hidden shadow-inner">
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
                
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 2).map(e => (
                    <div key={e.id} className={`h-3 px-1 rounded-sm text-[8px] font-black truncate border-l-2 ${getEventBg(e.color)}`}>
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-[7px] font-black text-gray-400 pl-1">+{dayEvents.length - 2} more</div>}
                </div>
              </div>
            )
          })}
        </div>
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
                      {(e.startTime || e.endTime) && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-gray-400 mr-2">
                          <Clock size={12} /> {e.startTime} {e.endTime && `~ ${e.endTime}`}
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
                  {e.description && <p className="text-xs text-gray-500 font-medium leading-relaxed">{e.description}</p>}
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
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
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">날짜</label>
                    <input type="date" value={formData.eventDate} onChange={e => setFormData({...formData, eventDate: e.target.value})} required className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">구분</label>
                    <select value={formData.eventType} onChange={e => setFormData({...formData, eventType: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none appearance-none">
                      {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">시작 시간</label>
                    <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none" />
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