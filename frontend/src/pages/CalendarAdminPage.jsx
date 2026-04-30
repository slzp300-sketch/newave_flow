import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  Plus, ChevronLeft, ChevronRight, PenLine, Trash2, 
  Calendar as CalendarIcon, Clock, Type, Palette, 
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2
} from 'lucide-react'
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek, getWeekOfMonth, getMonth 
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
  { name: '주황', value: 'amber', class: 'bg-amber-400' },
  { name: '분홍', value: 'rose', class: 'bg-rose-500' },
]

const EVENT_TYPES = [
  { label: '정기 일정', value: 'REGULAR' },
  { label: '특별 행사', value: 'SPECIAL' },
  { label: '회의', value: 'MEETING' },
  { label: '전체 일정', value: 'CHURCH_WIDE' },
]

const getEventColors = (color) => {
  const map = {
    blue: 'border-blue-500 bg-blue-50/30 text-blue-600',
    red: 'border-red-500 bg-red-50/30 text-red-600',
    emerald: 'border-emerald-500 bg-emerald-50/30 text-emerald-600',
    violet: 'border-violet-500 bg-violet-50/30 text-violet-600',
    amber: 'border-amber-400 bg-amber-50/30 text-amber-600',
    rose: 'border-rose-500 bg-rose-50/30 text-rose-600',
    indigo: 'border-indigo-500 bg-indigo-50/30 text-indigo-600',
  }
  return map[color] || 'border-primary-500 bg-primary-50/30 text-primary-600'
}

export default function CalendarAdminPage() {
  const qc = useQueryClient()
  const [current, setCurrent] = useState(new Date())
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

  const { data: events = [] } = useQuery({
    queryKey: ['events', format(current, 'yyyy-MM')],
    queryFn:  () => client.get('/events', {
      params: {
        from: format(startOfWeek(startOfMonth(current)), 'yyyy-MM-dd'),
        to:   format(endOfWeek(endOfMonth(current)),   'yyyy-MM-dd'),
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
      qc.invalidateQueries({ queryKey: ['events'] })
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
      endDate: event.endDate || event.eventDate,
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      color: event.color || '',
      eventType: event.eventType,
      attendanceRequired: event.attendanceRequired ?? false,
      attendanceDeadline: event.attendanceDeadline || '',
      attendanceTarget: event.attendanceTarget || 'STUDENT_ONLY',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return
    try {
      await client.delete(`/events/${id}`)
      alert('삭제되었습니다.')
      qc.invalidateQueries({ queryKey: ['events'] })
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
      endDate: toApiDate(new Date()),
      startTime: '12:00',
      endTime: '13:00',
      color: '',
      eventType: 'REGULAR',
      attendanceRequired: false,
      attendanceDeadline: '',
      attendanceTarget: 'STUDENT_ONLY',
    })
  }

  // 주차별 그룹화 로직
  const groupedEvents = useMemo(() => {
    return events
      .filter(e => isSameMonth(new Date(e.eventDate), current))
      .reduce((acc, event) => {
        const date = new Date(event.eventDate);
        const weekNum = getWeekOfMonth(date, { weekStartsOn: 0 });
        const month = getMonth(date) + 1;
        const key = `${month}월 ${weekNum}주차`;
        
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key).push(event);
        return acc;
      }, new Map());
  }, [events, current]);

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
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">시작일</label>
                      <input 
                        type="date" 
                        value={formData.eventDate}
                        onChange={e => {
                          const newDate = e.target.value;
                          setFormData({
                            ...formData, 
                            eventDate: newDate, 
                            // 종료일이 시작일보다 빠르거나 같았던 경우 함께 업데이트
                            endDate: formData.endDate < newDate ? newDate : formData.endDate
                          });
                        }}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">종료일</label>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">시작 시간</label>
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
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">구분</label>
                  <select 
                    value={formData.eventType}
                    onChange={e => setFormData({...formData, eventType: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none appearance-none"
                  >
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
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
                  <div className="flex flex-col gap-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                    <div>
                      <label className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2 block">출석 대상</label>
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
                      <label className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2 block">
                        출석 제출 마감일 <span className="text-gray-400 font-medium normal-case">(선택)</span>
                      </label>
                      <input
                        type="date"
                        value={formData.attendanceDeadline}
                        onChange={e => setFormData(d => ({ ...d, attendanceDeadline: e.target.value }))}
                        min={toApiDate(new Date())}
                        className="w-full px-4 py-3 rounded-xl border border-emerald-100 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                      {formData.attendanceDeadline && (
                        <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">
                          ✓ {formData.attendanceDeadline} 까지 출석 제출 가능합니다
                        </p>
                      )}
                      {!formData.attendanceDeadline && (
                        <p className="text-[11px] text-gray-400 mt-1.5">
                          미설정 시 마감 제한 없이 제출 가능합니다
                        </p>
                      )}
                    </div>
                  </div>
                )}

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

        <div className="flex flex-col gap-8">
          {groupedEvents.size === 0 ? (
            <div className="py-20 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
              <CalendarIcon size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">이번 달에 등록된 일정이 없습니다.</p>
            </div>
          ) : (
            Array.from(groupedEvents.keys()).map(weekKey => (
              <div key={weekKey} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-1">
                  <h3 className="text-sm font-black text-gray-900 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    {weekKey}
                  </h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-100 to-transparent" />
                </div>

                <div className="flex flex-col gap-4">
                  {groupedEvents.get(weekKey).map(event => {
                    const colors = getEventColors(event.color)
                    return (
                      <Card key={event.id} className={`p-0 overflow-hidden border-0 border-l-4 transition-all hover:shadow-lg ${colors.split(' ')[0]}`}>
                        <div className={`p-4 ${colors.split(' ')[1]}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white shadow-sm`}>
                                <CalendarIcon size={22} className={colors.split(' ')[2]} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <Badge variant={event.eventType === 'SPECIAL' ? 'info' : event.eventType === 'CHURCH_WIDE' ? 'danger' : 'gray'}>
                                    {EVENT_TYPES.find(t => t.value === event.eventType)?.label}
                                  </Badge>
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                    {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                                  </span>
                                </div>
                                <h3 className="font-black text-gray-900 text-base mb-1">{event.title}</h3>
                                {event.description && (
                                  <p className="text-gray-500 text-[11px] font-medium leading-relaxed mb-3">{event.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-gray-400">
                                  {(event.startTime || event.endTime) && (
                                    <span className="flex items-center gap-1">
                                      <Clock size={12} /> {event.startTime} {event.endTime && `~ ${event.endTime}`}
                                    </span>
                                  )}
                                  {event.attendanceRequired && (
                                    <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                      <CheckCircle2 size={10} /> 출석체크 활성
                                    </span>
                                  )}
                                  {event.attendanceRequired && event.attendanceDeadline && (
                                    <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                                      마감 {format(new Date(event.attendanceDeadline), 'M/d', { locale: ko })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <button onClick={() => handleEdit(event)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-white rounded-lg transition-colors bg-white/50 shadow-sm">
                                <PenLine size={16} />
                              </button>
                              <button onClick={() => handleDelete(event.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors bg-white/50 shadow-sm">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
