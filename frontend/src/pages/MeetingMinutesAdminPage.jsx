import { CollapsePanel } from '../components/common/Motion'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { AdminIntro, FilterResults } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import { useState, useEffect } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, CheckCircle2, XCircle, Play, Users, PenLine, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import Button from '../components/common/Button'
import { formatDate, toApiDate } from '../utils/date'
import client from '../api/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function MeetingMinutesAdminPage() {
  const [viewMode, setViewMode] = useViewMode('admin-minutes', 'large')
  const [statusView, setStatusView] = useViewMode('admin-minute-status', 'large')
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('all')
  const [loadError, setLoadError] = useState(false)
  const [minutes, setMinutes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedStatus, setSelectedStatus] = usePersistedState('selectedStatus', null)
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    videoLink: '',
    meetingDate: toApiDate(new Date()),
    isActive: true
  })

  useEffect(() => {
    fetchMinutes()
  }, [])

  const fetchMinutes = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await client.get('/minutes')
      setMinutes(res.data)
    } catch (err) {
      console.error('회의록 조회 실패:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.content) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    try {
      setSubmitting(true)
      if (editingId) {
        await client.put(`/minutes/${editingId}`, formData)
        alert('회의록이 수정되었습니다.')
      } else {
        await client.post('/minutes', formData)
        alert('회의록이 등록되었습니다.')
      }
      handleCloseForm()
      await fetchMinutes()
    } catch (err) {
      console.error('등록/수정 실패:', err)
      alert('오류가 발생했습니다: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (m) => {
    try {
      await client.put(`/minutes/${m.id}`, {
        ...m,
        isActive: !m.isActive
      })
      fetchMinutes()
    } catch (err) {
      console.error(err)
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  const handleEdit = (m) => {
    setEditingId(m.id)
    setFormData({
      title: m.title,
      content: m.content,
      videoLink: m.videoLink || '',
      meetingDate: m.meetingDate,
      isActive: m.isActive
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 이 회의록을 삭제하시겠습니까? 관련 확인 데이터도 모두 삭제됩니다.')) return
    
    try {
      await client.delete(`/minutes/${id}`)
      alert('삭제되었습니다.')
      fetchMinutes()
    } catch (err) {
      console.error(err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ title: '', content: '', videoLink: '', meetingDate: toApiDate(new Date()), isActive: true })
  }

  const fetchStatus = async (id) => {
    if (selectedStatus?.id === id) {
      setSelectedStatus(null)
      return
    }
    try {
      const res = await client.get(`/minutes/${id}/status`)
      setSelectedStatus({ id, data: res.data })
    } catch (err) {
      console.error(err)
    }
  }

  // 월별 그룹화 로직
  const filteredMinutes = minutes.filter(m => matchesAdminSearch(search, m.title, m.meetingDate) && (visibility === 'all' || (visibility === 'public' ? m.isActive : !m.isActive)))
  const groupedMinutes = filteredMinutes.reduce((acc, m) => {
    const month = format(new Date(m.meetingDate), 'yyyy년 M월', { locale: ko })
    if (!acc[month]) acc[month] = []
    acc[month].push(m)
    return acc
  }, {})



  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="회의록 관리" showBack />

      <div className="px-4 py-6">
        <div className="mb-5 flex flex-col gap-4">
          <AdminIntro title={editingId ? '회의록 수정' : '회의 기록과 영상을 한곳에'} description="회의록의 공개 여부와 교사별 확인 상태를 관리하세요."
            action={<Button size="sm" variant={showForm ? 'secondary' : 'primary'} onClick={() => showForm ? handleCloseForm() : setShowForm(true)}>{showForm ? '닫기' : <><Plus size={16} /> 등록하기</>}</Button>} />
          <SearchField label="관리할 회의록 검색" value={search} onChange={setSearch} placeholder="회의 제목 또는 날짜 검색" />
          <SegmentedControl label="회의록 공개 상태" value={visibility} onChange={setVisibility} selectedClassName="text-primary-600"
            options={[{value: 'all', label: '전체'}, {value: 'public', label: '공개'}, {value: 'private', label: '비공개'}]} />
          {!loading && !loadError && <FilterResults count={filteredMinutes.length} total={minutes.length} unit="건" filtered={!!search.trim() || visibility !== 'all'} onReset={() => { setSearch(''); setVisibility('all') }} />}
        </div>

        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="p-6 border-2 border-primary-100 shadow-xl shadow-primary-50">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">회의 제목</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="예: 4월 3주차 정기 교사 회의"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-primary-400 outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">회의 날짜</label>
                    <input 
                      type="date" 
                      value={formData.meetingDate}
                      onChange={e => setFormData({...formData, meetingDate: e.target.value})}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">영상 링크 (선택)</label>
                    <input 
                      type="url" 
                      value={formData.videoLink}
                      onChange={e => setFormData({...formData, videoLink: e.target.value})}
                      placeholder="YouTube 링크 등"
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="brand-card flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">교사 공개 여부</p>
                    <p className="text-xs text-gray-400 font-medium">활성화 시 일반 교사들이 이 회의록을 볼 수 있습니다.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                    className={`transition-colors ${formData.isActive ? 'text-primary-600' : 'text-gray-300'}`}
                  >
                    {formData.isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">회의 내용</label>
                  <textarea 
                    rows={6}
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    placeholder="회의 주요 내용을 입력해주세요"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" size="lg" loading={submitting}>
                    {editingId ? '수정 완료' : '등록 완료'}
                  </Button>
                  {editingId && (
                    <Button variant="ghost" onClick={handleCloseForm}>취소</Button>
                  )}
                </div>
              </form>
            </Card>
          </motion.div>
        )}

        <ViewModeToggle mode={viewMode} onChange={setViewMode} label="회의록 목록 보기 방식" />
        <div className="flex flex-col gap-8">
          {loading ? <p role="status" className="py-10 text-center text-sm text-gray-500">회의록을 불러오는 중…</p> : loadError ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">회의록을 불러오지 못했습니다.<Button variant="secondary" className="mt-3" onClick={fetchMinutes}>다시 불러오기</Button></div> : Object.keys(groupedMinutes).length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">{search.trim() || visibility !== 'all' ? '조건에 맞는 회의록이 없습니다.' : '등록된 회의록이 없습니다.'}</p>
            </div>
          ) : (
            <RecordViews mode={viewMode} rows={filteredMinutes} onRowClick={m => fetchStatus(m.id)} columns={[
              { label: '회의록', render: m => m.title },
              { label: '회의 일자', render: m => m.meetingDate },
              { label: '공개', render: m => m.isActive ? '공개' : '비공개' },
              { label: '내용', render: m => m.content },
              { label: '영상', render: m => m.videoLink ? <a href={m.videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary-700 underline">영상 열기</a> : '없음' },
              { label: '관리', action: true, render: m => <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleEdit(m)} className="min-h-11 rounded-xl bg-primary-50 px-3 font-semibold" aria-label={`${m.title} 수정`}>수정</button>
                <button type="button" onClick={() => handleToggleActive(m)} className="min-h-11 rounded-xl bg-gray-100 px-3 font-semibold">{m.isActive ? '비공개로 전환' : '공개로 전환'}</button>
                <button type="button" onClick={() => handleDelete(m.id)} className="min-h-11 rounded-xl bg-red-50 px-3 font-semibold text-red-600" aria-label={`${m.title} 삭제`}>삭제</button>
              </div> },
            ]}>
            {Object.entries(groupedMinutes).map(([month, items]) => (
              <div key={month} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1 h-4 bg-primary-500 rounded-full" />
                  <h3 className="text-sm font-bold text-gray-900">{month}</h3>
                  <span className="text-xs font-bold text-gray-400 ml-1">{items.length}건</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {items.map(m => (
                    <Card key={m.id} className={`p-4 flex flex-col gap-4 overflow-hidden group transition-all ${!m.isActive ? 'opacity-60 bg-gray-50' : 'hover:border-primary-200'}`}>
                      <div className="flex flex-wrap justify-between items-start gap-3">
                        <button type="button" aria-expanded={selectedStatus?.id === m.id} className="min-w-0 flex-1 basis-40 text-left" onClick={() => fetchStatus(m.id)}>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-bold text-primary-500 uppercase tracking-widest">{formatDate(m.meetingDate)}</p>
                            {!m.isActive && <span className="text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-500">비공개</span>}
                          </div>
                          <h3 className="font-bold text-gray-900 leading-tight group-hover:text-primary-600 transition-colors">{m.title}</h3>
                        </button>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleToggleActive(m)} 
                            title={m.isActive ? "비공개로 전환" : "공개로 전환"}
                            className={`min-h-11 min-w-11 p-2 rounded-lg transition-colors ${m.isActive ? 'text-primary-500 hover:bg-primary-50' : 'text-gray-400 hover:bg-gray-200'}`}
                          >
                            {m.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                          <button aria-label={`${m.title} 수정`} onClick={() => handleEdit(m)} className="min-h-11 min-w-11 p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                            <PenLine size={16} />
                          </button>
                          <button aria-label={`${m.title} 삭제`} onClick={() => handleDelete(m.id)} className="min-h-11 min-w-11 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button 
                          onClick={() => fetchStatus(m.id)}
                          className={`text-xs font-bold flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                            selectedStatus?.id === m.id 
                            ? 'bg-primary-600 text-white shadow-md shadow-primary-100' 
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <Users size={12} /> {selectedStatus?.id === m.id ? '상세 닫기' : '참석 및 확인 현황'}
                          {selectedStatus?.id === m.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {m.videoLink && (
                          <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                            <Play size={10} fill="currentColor" /> 영상 있음
                          </span>
                        )}
                      </div>

                      <AnimatePresence>
                        {selectedStatus?.id === m.id && (
                          <CollapsePanel
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-4 border-t border-gray-100 overflow-hidden"
                          >
                            <div className="flex flex-col gap-4 p-2">
                              <ViewModeToggle mode={statusView} onChange={setStatusView} label="회의록 참석 명단 보기 방식" />
                              <MinuteStatusViews mode={statusView} rows={selectedStatus.data}>
                              {(() => {
                                const GRADE_ORDER = ['유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '미분류']
                                const grouped = {}
                                selectedStatus.data.forEach(s => {
                                  const g = s.teacherGrade || '미분류'
                                  if (!grouped[g]) grouped[g] = []
                                  grouped[g].push(s)
                                })
                                const sortedGrades = Object.keys(grouped).sort((a, b) => {
                                  const ai = GRADE_ORDER.indexOf(a); const bi = GRADE_ORDER.indexOf(b)
                                  if (ai === -1 && bi === -1) return a.localeCompare(b)
                                  if (ai === -1) return 1
                                  if (bi === -1) return -1
                                  return ai - bi
                                })

                                return sortedGrades.map(grade => (
                                  <div key={grade} className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="w-1 h-3 bg-primary-300 rounded-full" />
                                      <h4 className="text-xs font-bold text-gray-700">{grade}</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {grouped[grade].map(s => (
                                        <div key={s.teacherId} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                                          <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-sm text-gray-900">{s.teacherName}</span>
                                              {s.attendanceStatus === 'ATTEND' ? (
                                                <span className="text-xs font-bold text-secondary-600 bg-secondary-50 px-1.5 py-0.5 rounded-md">참석</span>
                                              ) : s.attendanceStatus === 'ABSENT' ? (
                                                <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">불참</span>
                                              ) : (
                                                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">미제출</span>
                                              )}
                                            </div>
                                            {s.attendanceStatus === 'ABSENT' && s.attendanceReason && (
                                              <p className="text-xs text-gray-500 font-medium">사유: {s.attendanceReason}</p>
                                            )}
                                          </div>
                                          <div className="flex flex-col items-end gap-1">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">회의록 확인</p>
                                            {s.confirmed || s.attendanceStatus === 'ATTEND' ? (
                                              <div className="flex items-center gap-1 text-secondary-700">
                                                <CheckCircle2 size={14} />
                                                <span className="text-xs font-bold">{s.attendanceStatus === 'ATTEND' ? '참석자(면제)' : '확인 완료'}</span>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1 text-red-400">
                                                <XCircle size={14} />
                                                <span className="text-xs font-bold">미확인</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))
                              })()}
                              </MinuteStatusViews>
                            </div>
                          </CollapsePanel>
                        )}
                      </AnimatePresence>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            </RecordViews>
          )}
        </div>
        {viewMode !== 'large' && selectedStatus && <section aria-label="회의록 참석 및 확인 현황" className="space-y-3">
          <h2 className="brand-section-title text-sm font-semibold">{minutes.find(m => m.id === selectedStatus.id)?.title} · 참석 및 확인 현황</h2>
          <ViewModeToggle mode={statusView} onChange={setStatusView} label="회의록 참석 명단 보기 방식" />
          <MinuteStatusViews mode={statusView} rows={selectedStatus.data} />
        </section>}
      </div>
    </div>
  )
}

function MinuteStatusViews({ mode, rows, children }) {
  return <RecordViews mode={mode} rows={rows} rowKey={row => row.teacherId} columns={[
    { label: '교사', render: row => row.teacherName },
    { label: '학년', render: row => row.teacherGrade },
    { label: '참석', render: row => ({ ATTEND: '참석', ABSENT: '불참' }[row.attendanceStatus] || '미제출') },
    { label: '불참 사유', render: row => row.attendanceReason },
    { label: '회의록 확인', render: row => row.attendanceStatus === 'ATTEND' ? '참석자(면제)' : row.confirmed ? '확인 완료' : '미확인' },
  ]}>{children}</RecordViews>
}
