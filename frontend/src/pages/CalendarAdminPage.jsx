import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Plus, ChevronLeft, ChevronRight, PenLine, Trash2, 
  Calendar as CalendarIcon, Clock, Type, Palette, 
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react'
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek
} from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { motion, AnimatePresence } from 'framer-motion'
import { toApiDate } from '../utils/date'

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

export default function CalendarAdminPage() {
  const [current, setCurrent] = useState(new Date())
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

  const { data: events = [], refetch } = useQuery({
    queryKey: ['admin-events', format(current, 'yyyy-MM')],
    queryFn:  () => client.get('/events', {
      params: {
        from: format(startOfMonth(subMonths(current, 1)), 'yyyy-MM-dd'),
        to:   format(endOfMonth(addMonths(current, 1)),   'yyyy-MM-dd'),
      }
    }).then(r => r.data),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.eventDate) return

    try {
      setSubmitting(true)
      if (editingId) {
        await client.put(`/events/${editingId}`, formData)
        alert('일정이 수정되었습니다.')
      } else {
        await client.post('/events', formData)
        alert('일정이 등록되었습니다.')
      }
      handleCloseForm()
      refetch()
    } catch (err) {
      console.error(err)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (event) => {
    setEditingId(event.id)
    setFormData({
      title: event.title,
      description: event.description || '',
      eventDate: event.eventDate,
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      color: event.color || '',
      eventType: event.eventType
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return
    try {
      await client.delete(`/events/${id}`)
      alert('삭제되었습니다.')
      refetch()
    } catch (err) {
      console.error(err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      title: '',
      description: '',
      eventDate: toApiDate(new Date()),
      startTime: '',
      endTime: '',
      color: '',
      eventType: 'REGULAR'
    })
  }

  // 이번 달의 일정만 리스트로 표시
  const monthlyEvents = events
    .filter(e => isSameMonth(new Date(e.eventDate), current))
    .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="일정 관리" showBack />

      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-gray-900">
            {format(current, 'yyyy년 M월', { locale: ko })} 일정
          </h2>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={16} /> 일정 추가
          </Button>
        </div>

        {/* 월 선택 */}
        <div className="flex items-center gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm">
          <button onClick={() => setCurrent(subMonths(current, 1))} className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-1 flex justify-center">
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 text-sm font-black text-gray-900 min-w-[100px] text-center">
            {format(current, 'yyyy년 M월', { locale: ko })}
          </div>
          <button onClick={() => setCurrent(addMonths(current, 1))} className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-1 flex justify-center">
            <ChevronRight size={20} />
          </button>
        </div>

        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="p-6 border-2 border-primary-100 shadow-xl shadow-primary-50">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">일정 제목</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="예: 5월 성경 학교"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-primary-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">일자</label>
                    <input 
                      type="date" 
                      value={formData.eventDate}
                      onChange={e => setFormData({...formData, eventDate: e.target.value})}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">구분</label>
                    <select 
                      value={formData.eventType}
                      onChange={e => setFormData({...formData, eventType: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none appearance-none"
                    >
                      {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">시작 시간</label>
                    <input 
                      type="time" 
                      value={formData.startTime}
                      onChange={e => setFormData({...formData, startTime: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">종료 시간</label>
                    <input 
                      type="time" 
                      value={formData.endTime}
                      onChange={e => setFormData({...formData, endTime: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">색상 테마</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormData({...formData, color: c.value})}
                        className={`w-8 h-8 rounded-full border-4 transition-all ${c.class} 
                          ${formData.color === c.value ? 'border-white ring-2 ring-gray-900' : 'border-transparent opacity-60'}`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">설명 (선택)</label>
                  <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="일정 세부 사항을 입력해주세요"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" size="lg" loading={submitting}>
                    {editingId ? '수정 완료' : '등록 완료'}
                  </Button>
                  <Button variant="ghost" onClick={handleCloseForm}>취소</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}

        <div className="flex flex-col gap-3">
          {monthlyEvents.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <CalendarIcon size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">이번 달에 등록된 일정이 없습니다.</p>
            </div>
          ) : (
            monthlyEvents.map(event => (
              <Card key={event.id} className="p-4 flex flex-col gap-3 group hover:border-primary-200 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">
                        {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                      </span>
                      <Badge variant={event.eventType === 'SPECIAL' ? 'info' : event.eventType === 'CHURCH_WIDE' ? 'danger' : 'gray'}>
                        {EVENT_TYPES.find(t => t.value === event.eventType)?.label}
                      </Badge>
                    </div>
                    <h3 className="font-black text-gray-900 text-base">{event.title}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(event)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                      <PenLine size={16} />
                    </button>
                    <button onClick={() => handleDelete(event.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-black text-gray-400">
                  {(event.startTime || event.endTime) && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {event.startTime} {event.endTime && `~ ${event.endTime}`}
                    </span>
                  )}
                  {event.color && (
                    <span className="flex items-center gap-1">
                      <Palette size={12} /> {COLORS.find(c => c.value === event.color)?.name} 테마
                    </span>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
