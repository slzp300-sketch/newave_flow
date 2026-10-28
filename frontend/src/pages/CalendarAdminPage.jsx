import './SupportingReadability.css'
import { Collapse, CollapsePanel } from '../components/common/Motion'
import useToday from '../hooks/useToday'
import EventAttendanceFields from '../components/calendar/EventAttendanceFields'
import EventAttendanceStatus from '../components/calendar/EventAttendanceStatus'
import { eventToday, isEventEnded, validateAttendanceWindow } from '../utils/eventAttendance'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { AdminIntro, FilterResults, AdminEmpty } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import AdminReadGuard from '../components/common/AdminReadGuard'
import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, PenLine, Trash2, Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import { eventApi } from '../api/event'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { toApiDate } from '../utils/date'
import { DateRangeField } from '../components/calendar/DateRangePicker'
import BulkEventForm, { AddEventChoice } from '../components/calendar/BulkEventForm'

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
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('admin-calendar', 'large')
  const [period, setPeriod] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [showChoice, setShowChoice] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: toApiDate(new Date()),
    endDate: toApiDate(new Date()),
    allDay: false,
    startTime: '12:00',
    endTime: '13:00',
    color: '',
    eventType: 'REGULAR',
    attendanceRequired: false,
    attendanceDeadline: '',
    attendanceStartDate: '',
    attendanceTarget: 'STUDENT_ONLY',
  })

  const eventsQuery = useQuery({
    queryKey: ['events-all'],
    queryFn:  () => eventApi.getAllEvents().then(r => r.data),
  })
  const events = eventsQuery.data || []

  const handleSubmit = async (e) => {
    e.preventDefault()
    const windowError = validateAttendanceWindow(formData)
    if (windowError) { alert(windowError); return }
    if (!formData.title || !formData.eventDate) return

    try {
      setSubmitting(true)
      const { allDay, ...rest } = formData
      const submitData = {
        ...rest,
        startTime: allDay ? null : rest.startTime || null,
        endTime:   allDay ? null : rest.endTime   || null,
        // 마감일을 비워두면 일정 마지막 날까지
        attendanceDeadline: rest.attendanceRequired ? rest.attendanceDeadline : null,
        attendanceStartDate: rest.attendanceRequired ? rest.attendanceStartDate : null,
      }
      if (editingId) {
        await client.put(`/events/${editingId}`, submitData)
        alert('일정이 수정되었습니다.')
      } else {
        await client.post('/events', submitData)
        alert('일정이 등록되었습니다.')
      }
      handleCloseForm()
      qc.invalidateQueries({ queryKey: ['events-all'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['attendance-required-events'] })
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
      allDay: !event.startTime,
      startTime: event.startTime || '12:00',
      endTime: event.endTime || '13:00',
      color: event.color || '',
      eventType: event.eventType,
      attendanceRequired: event.attendanceRequired ?? false,
      attendanceDeadline: event.attendanceDeadline || event.endDate || event.eventDate,
      attendanceStartDate: event.attendanceStartDate || (eventToday() > (event.attendanceDeadline || event.endDate || event.eventDate) ? (event.attendanceDeadline || event.endDate || event.eventDate) : eventToday()),
      attendanceTarget: event.attendanceTarget || 'STUDENT_ONLY',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return
    try {
      await client.delete(`/events/${id}`)
      alert('삭제되었습니다.')
      qc.invalidateQueries({ queryKey: ['events-all'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['attendance-required-events'] })
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
      allDay: false,
      startTime: '12:00',
      endTime: '13:00',
      color: '',
      eventType: 'REGULAR',
      attendanceRequired: false,
      attendanceDeadline: '',
    attendanceStartDate: '',
      attendanceTarget: 'STUDENT_ONLY',
    })
  }

  // 다가올 / 진행중 / 지난 일정 분류
  const today = useToday(eventToday)
  const categorizedEvents = useMemo(() => {
    const upcoming = [], ongoing = [], past = []
    events.filter(e => matchesAdminSearch(search, e.title, e.description, e.eventDate)).forEach(e => {
      const end = e.endDate || e.eventDate
      if (period === 'upcoming' && end < today || period === 'past' && end >= today) return
      if (end < today) past.push(e)
      else if (e.eventDate <= today) ongoing.push(e)
      else upcoming.push(e)
    })
    upcoming.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    ongoing.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    past.sort((a, b) => b.eventDate.localeCompare(a.eventDate))
    return { upcoming, ongoing, past }
  }, [events, search, period, today])

  return (
    <div className="supporting-readable calendar-admin-readable readable-content flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="일정 관리" showBack />

      <div className="px-4 py-6">
        <div className="mb-5 flex flex-col gap-4">
          <AdminIntro title="부서 일정을 관리하세요" description="다가오는 일정과 지난 행사를 찾아 수정하거나 새 일정을 등록하세요."
            action={<Button size="sm" onClick={() => setShowChoice(true)}><Plus size={16} /> 일정 추가</Button>} />
          <SearchField label="관리할 일정 검색" value={search} onChange={setSearch} placeholder="일정 이름, 설명 또는 날짜 검색" />
          <ViewModeToggle mode={viewMode} onChange={setViewMode} label="일정 목록 보기 방식" />
          <SegmentedControl label="일정 기간" value={period} onChange={setPeriod}
            options={[{value: 'all', label: '전체'}, {value: 'upcoming', label: '진행·예정'}, {value: 'past', label: '종료된 일정'}]} />
        </div>

        <Collapse open={showForm} className="mb-8">
            <Card className="calendar-event-form-card p-6 border-2 border-primary-100 shadow-xl shadow-primary-50">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">일정 제목</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="예: 5월 성경 학교"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-primary-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">날짜 <span className="normal-case tracking-normal font-medium">(하루 또는 기간)</span></label>
                  <DateRangeField
                    start={formData.eventDate}
                    end={formData.endDate}
                    onChange={(s, e) => setFormData(f => ({ ...f, eventDate: s, endDate: e }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold text-gray-800"
                  />
                </div>

                {/* 하루종일 토글 */}
                <div
                  onClick={() => setFormData(d => ({ ...d, allDay: !d.allDay }))}
                  className={`supporting-toggle flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.allDay ? 'border-primary-300 bg-primary-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-bold ${formData.allDay ? 'text-primary-700' : 'text-gray-500'}`}>하루종일</p>
                    <p className="text-xs text-gray-400 mt-0.5">시간 없이 종일 일정으로 표시됩니다</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all flex-shrink-0 relative ${formData.allDay ? 'bg-primary-500' : 'bg-gray-200'}`}>
                    <motion.div
                      animate={{ x: formData.allDay ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
                    />
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {!formData.allDay && (
                    <CollapsePanel
                      key="time-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="supporting-form-grid gap-4">
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">시작 시간</label>
                          <input
                            type="time"
                            value={formData.startTime}
                            onChange={e => {
                              const newStartTime = e.target.value
                              let newEndTime = formData.endTime
                              if (newStartTime) {
                                const [h, m] = newStartTime.split(':').map(Number)
                                const d = new Date(); d.setHours(h + 1); d.setMinutes(m)
                                newEndTime = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
                              }
                              setFormData({...formData, startTime: newStartTime, endTime: newEndTime})
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">종료 시간</label>
                          <input
                            type="time"
                            value={formData.endTime}
                            onChange={e => setFormData({...formData, endTime: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                          />
                        </div>
                      </div>
                    </CollapsePanel>
                  )}
                </AnimatePresence>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">구분</label>
                  <select 
                    value={formData.eventType}
                    onChange={e => setFormData({...formData, eventType: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none appearance-none"
                  >
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">색상 테마</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormData({...formData, color: c.value})}
                        className={`brand-color-swatch w-8 h-8 rounded-full border-4 transition-all ${c.class}
                          ${formData.color === c.value ? 'border-white ring-2 ring-gray-900' : 'border-transparent opacity-60'}`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">설명 (선택)</label>
                  <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="일정 세부 사항을 입력해주세요"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none outline-none"
                  />
                </div>

                {/* 출석 체크 활성화 토글 */}
                <button type="button" role="switch" aria-checked={formData.attendanceRequired} aria-label="출석 체크 활성화"
                  onClick={() => setFormData(d => ({ ...d, attendanceRequired: !d.attendanceRequired,
                    attendanceStartDate: d.attendanceStartDate || (eventToday() > d.endDate ? d.endDate : eventToday()),
                    attendanceDeadline: d.attendanceDeadline || d.endDate }))}
                  className={`w-full text-left supporting-toggle flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.attendanceRequired
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-bold ${formData.attendanceRequired ? 'text-emerald-700' : 'text-gray-500'}`}>
                      출석 체크 활성화
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">출석 체크가 필요한 행사에 활성화하세요</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all flex-shrink-0 relative ${
                    formData.attendanceRequired ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                      formData.attendanceRequired ? 'left-5' : 'left-0.5'
                    }`} />
                  </div>
                </button>

                <Collapse open={formData.attendanceRequired}><EventAttendanceFields value={formData} onChange={patch => setFormData(d => ({ ...d, ...patch }))} /></Collapse>

                <div className="flex gap-3">
                  <Button type="submit" size="lg" loading={submitting}>
                    {editingId ? '수정 완료' : '등록 완료'}
                  </Button>
                  <Button variant="ghost" className="shrink-0 whitespace-nowrap" onClick={handleCloseForm}>취소</Button>
                </div>
              </form>
            </Card>
        </Collapse>

        <AdminReadGuard queries={[eventsQuery]} label="일정 목록">
        <FilterResults count={Object.values(categorizedEvents).flat().length} total={events.length} unit="건" filtered={!!search.trim() || period !== 'all'} onReset={() => { setSearch(''); setPeriod('all') }} />
        {events.length > 0 && Object.values(categorizedEvents).flat().length === 0 && <AdminEmpty />}
        {events.length === 0 ? (
          <div className="brand-card py-20 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
            <CalendarIcon size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">등록된 일정이 없습니다.</p>
          </div>
        ) : (
          <RecordViews mode={viewMode} rows={[...categorizedEvents.ongoing, ...categorizedEvents.upcoming, ...categorizedEvents.past]} rowClassName={event => isEventEnded(event, today) ? 'event-inactive' : ''} columns={[
            { label: '일정', render: event => event.title },
            { label: '기간', render: event => `${event.eventDate}${event.endDate && event.endDate !== event.eventDate ? ` ~ ${event.endDate}` : ''}` },
            { label: '시간', render: event => event.startTime ? `${event.startTime}${event.endTime ? ` ~ ${event.endTime}` : ''}` : '하루종일' },
            { label: '상태', render: event => isEventEnded(event, today) ? '종료된 일정' : event.eventDate <= today ? '진행 중' : '예정' },
            { label: '설명', render: event => event.description },
            { label: '출석 접수', render: event => <EventAttendanceStatus event={event} today={today} /> },
            { label: '관리', action: true, render: event => <div className="flex gap-2">
              <button type="button" onClick={() => handleEdit(event)} aria-label={`${event.title} 수정`} className="min-h-11 rounded-xl border border-primary-200 px-3 font-semibold">수정</button>
              <button type="button" onClick={() => handleDelete(event.id)} aria-label={`${event.title} 삭제`} className="min-h-11 rounded-xl border border-red-200 px-3 font-semibold text-red-600">삭제</button>
            </div> },
          ]}>
          <div className="flex flex-col gap-8">
            {[
              { key: 'ongoing', label: '진행중인 일정', dot: 'bg-emerald-500', list: categorizedEvents.ongoing },
              { key: 'upcoming', label: '다가올 일정', dot: 'bg-blue-500', list: categorizedEvents.upcoming },
              { key: 'past', label: '종료된 일정', dot: 'bg-gray-400', list: categorizedEvents.past },
            ].map(({ key, label, dot, list }) => list.length > 0 && (
              <div key={key} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-1">
                  <h3 className="text-sm font-bold text-gray-900 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-50 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    {label}
                    <span className="text-gray-400 font-medium">{list.length}</span>
                  </h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-100 to-transparent" />
                </div>
                <div className="flex flex-col gap-4">
                  {list.map(event => {
                    const colors = isEventEnded(event, today) ? 'border-gray-300 bg-gray-100 text-gray-600' : getEventColors(event.color)
                    return (
                      <Card key={event.id} className={`${isEventEnded(event, today) ? 'event-inactive' : ''} brand-custom-color p-0 overflow-hidden border-0 border-l-4 transition-all hover:shadow-lg ${colors.split(' ')[0]}`}>
                        <div className={`p-4 ${colors.split(' ')[1]}`}>
                          <div className="flex flex-wrap justify-between items-start gap-3">
                            <div className="supporting-event-heading flex min-w-0 flex-1 items-start gap-3">
                              <div className="supporting-event-icon w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white shadow-sm">
                                <CalendarIcon size={22} className={colors.split(' ')[2]} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <Badge variant={event.eventType === 'SPECIAL' ? 'info' : event.eventType === 'CHURCH_WIDE' ? 'danger' : 'gray'}>
                                    {EVENT_TYPES.find(t => t.value === event.eventType)?.label}
                                  </Badge>
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                                    {event.endDate && event.endDate !== event.eventDate && ` ~ ${format(new Date(event.endDate), 'M월 d일', { locale: ko })}`}
                                  </span>
                                </div>
                                <h3 className="font-bold text-gray-900 text-base mb-1">{event.title}</h3>
                                {isEventEnded(event, today) && <p className="mb-2 text-xs text-gray-600">종료된 일정 · 내용 조회</p>}
                                {event.description && (
                                  <p className="text-gray-500 text-xs font-medium leading-relaxed mb-3">{event.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-400">
                                  {!event.startTime ? (
                                    <span className="flex items-center gap-1 text-primary-500 bg-primary-50 px-1.5 py-0.5 rounded-md">하루종일</span>
                                  ) : (event.startTime || event.endTime) && (
                                    <span className="flex items-center gap-1">
                                      <Clock size={12} /> {event.startTime} {event.endTime && `~ ${event.endTime}`}
                                    </span>
                                  )}
                                  <EventAttendanceStatus event={event} today={today} />
                                  {event.attendanceRequired && event.attendanceDeadline && (
                                    <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                                      마감 {format(new Date(event.attendanceDeadline), 'M/d', { locale: ko })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="supporting-event-actions flex gap-1">
                              <button aria-label={`${event.title} 수정`} onClick={() => handleEdit(event)} className="min-h-11 min-w-11 p-2 text-gray-400 hover:text-primary-500 hover:bg-white rounded-lg transition-colors bg-white/50 shadow-sm">
                                <PenLine size={16} />
                              </button>
                              <button aria-label={`${event.title} 삭제`} onClick={() => handleDelete(event.id)} className="min-h-11 min-w-11 p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors bg-white/50 shadow-sm">
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
            ))}
          </div>
          </RecordViews>
        )}
        </AdminReadGuard>
      </div>

      <AddEventChoice open={showChoice} onClose={() => setShowChoice(false)} onSingle={() => setShowForm(true)} onBulk={() => setShowBulk(true)} />
      <BulkEventForm open={showBulk} onClose={() => setShowBulk(false)} />
    </div>
  )
}
